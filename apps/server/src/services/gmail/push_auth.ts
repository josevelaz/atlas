import {
	createRemoteJWKSet,
	errors as joseErrors,
	type JWTVerifyGetKey,
	jwtVerify,
} from "jose";

import { and, eq } from "drizzle-orm";

import { connectedAccount } from "../../db/schema.ts";
import { GMAIL_CATCH_UP_QUEUE, GMAIL_PROVIDER } from "../ingestion/connect.ts";

/**
 * Authentication and handling for Gmail Pub/Sub push notifications.
 *
 * Google Cloud Pub/Sub push subscriptions attach an OIDC identity token
 * (`Authorization: Bearer <jwt>`) to every delivery. We verify, in order:
 *
 *   1. Signature — against Google's OIDC JWKS (RS256, rotated keys).
 *   2. Issuer — exactly `https://accounts.google.com`.
 *   3. Audience — the configured `GMAIL_PUSH_AUDIENCE`.
 *   4. Expiry — enforced by `jose` (no clock tolerance).
 *   5. Identity — the `email` claim must equal the configured push
 *      service account (`GMAIL_PUSH_SERVICE_ACCOUNT`) and be verified.
 *
 * Trust model for the payload: the Pub/Sub envelope is a HINT, nothing
 * more. {@link decodePushEnvelope} extracts ONLY `emailAddress`; the
 * payload's `historyId` is deliberately discarded and must NEVER be used
 * as a sync cursor — the history-sync job reads its own persisted cursor
 * (`last_synced_history_id ?? checkpoint_history_id`) and advances it
 * forward-only (ADR 0011).
 *
 * Testability: no db/config/redis/network work at import time — the JWKS,
 * db, and job queue are resolved lazily and injectable.
 */

/** Required issuer for Pub/Sub OIDC identity tokens. */
export const GOOGLE_OIDC_ISSUER = "https://accounts.google.com";

/** Google's OIDC signing keys (JWKS) endpoint. */
export const GOOGLE_OIDC_JWKS_URL =
	"https://www.googleapis.com/oauth2/v3/certs";

type Db = typeof import("../../db/index.ts")["db"];

let defaultDb: Db | undefined;

const getDb = async (): Promise<Db> => {
	if (!defaultDb) {
		({ db: defaultDb } = await import("../../db/index.ts"));
	}
	return defaultDb;
};

/** Verification key: a fixed key (tests) or a JWKS resolver (production). */
export type PushVerificationKey = CryptoKey | Uint8Array | JWTVerifyGetKey;

let defaultJwks: JWTVerifyGetKey | undefined;

/** Cached remote JWKS for Google's OIDC keys (created on first use). */
const getDefaultJwks = (): JWTVerifyGetKey => {
	defaultJwks ??= createRemoteJWKSet(new URL(GOOGLE_OIDC_JWKS_URL));
	return defaultJwks;
};

export interface PushAuthConfig {
	/** Expected `aud` claim (`GMAIL_PUSH_AUDIENCE`). */
	audience: string;
	/** Expected `email` claim (`GMAIL_PUSH_SERVICE_ACCOUNT`). */
	serviceAccountEmail: string;
}

export type PushAuthFailureReason =
	| "missing_token"
	| "invalid_token"
	| "expired"
	| "wrong_audience"
	| "wrong_issuer"
	| "wrong_service_account";

export type PushAuthResult =
	| { ok: true; serviceAccountEmail: string }
	| { ok: false; reason: PushAuthFailureReason };

export interface VerifyPushAuthorizationDeps {
	/** Injectable verification key (defaults to Google's remote JWKS). */
	key?: PushVerificationKey;
}

const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

const failureReasonFromJoseError = (error: unknown): PushAuthFailureReason => {
	// JWTExpired extends JWTClaimValidationFailed — check it first.
	if (error instanceof joseErrors.JWTExpired) {
		return "expired";
	}
	if (error instanceof joseErrors.JWTClaimValidationFailed) {
		if (error.claim === "aud") {
			return "wrong_audience";
		}
		if (error.claim === "iss") {
			return "wrong_issuer";
		}
		return "invalid_token";
	}
	// Signature failures, malformed JWTs, unresolvable JWKS keys, …
	return "invalid_token";
};

/**
 * Verify the `Authorization` header of a Pub/Sub push delivery.
 *
 * Returns a discriminated result instead of throwing — the route maps
 * `missing_token` to 401 and every other failure to 403.
 */
export const verifyPushAuthorization = async (
	authorizationHeader: string | null | undefined,
	config: PushAuthConfig,
	deps: VerifyPushAuthorizationDeps = {},
): Promise<PushAuthResult> => {
	const token = authorizationHeader?.match(BEARER_PATTERN)?.[1];
	if (!token) {
		return { ok: false, reason: "missing_token" };
	}

	const key = deps.key ?? getDefaultJwks();
	const options = {
		issuer: GOOGLE_OIDC_ISSUER,
		audience: config.audience,
	};

	let payload: Record<string, unknown>;
	try {
		// Branch keeps both jwtVerify overloads (key vs getKey) typed.
		({ payload } =
			typeof key === "function"
				? await jwtVerify(token, key, options)
				: await jwtVerify(token, key, options));
	} catch (error) {
		return { ok: false, reason: failureReasonFromJoseError(error) };
	}

	const email = payload.email;
	if (
		typeof email !== "string" ||
		email.toLowerCase() !== config.serviceAccountEmail.toLowerCase() ||
		payload.email_verified !== true
	) {
		return { ok: false, reason: "wrong_service_account" };
	}

	return { ok: true, serviceAccountEmail: email };
};

/**
 * The ONLY information we accept from a push payload: which mailbox to
 * re-check. Everything else (notably `historyId`) is untrusted and dropped.
 */
export interface PushEnvelopeHint {
	emailAddress: string;
}

/**
 * Decode a Pub/Sub push envelope body into a mailbox hint.
 *
 * Expected shape: `{ message: { data: base64("{\"emailAddress\":…}") } }`.
 * Returns null for anything malformed — the route still acks (204) so
 * Pub/Sub does not redeliver garbage forever.
 */
export const decodePushEnvelope = (body: unknown): PushEnvelopeHint | null => {
	if (typeof body !== "object" || body === null) {
		return null;
	}
	const message = (body as Record<string, unknown>).message;
	if (typeof message !== "object" || message === null) {
		return null;
	}
	const data = (message as Record<string, unknown>).data;
	if (typeof data !== "string" || data.length === 0) {
		return null;
	}

	let decoded: unknown;
	try {
		decoded = JSON.parse(Buffer.from(data, "base64").toString("utf-8"));
	} catch {
		return null;
	}

	if (typeof decoded !== "object" || decoded === null) {
		return null;
	}
	const emailAddress = (decoded as Record<string, unknown>).emailAddress;
	if (typeof emailAddress !== "string" || emailAddress.length === 0) {
		return null;
	}

	// Hint only: the payload's historyId is deliberately NOT returned — the
	// sync job reads its own persisted forward-only cursor.
	return { emailAddress: emailAddress.toLowerCase() };
};

/** Payload of the enqueued sync job — keyed by account id, nothing else. */
export interface PushSyncJobPayload {
	connectedAccountId: string;
}

/** Injectable enqueue seam (defaults to the BullMQ `gmail-catch-up` queue). */
export interface PushSyncJobs {
	enqueueCatchUp: (payload: PushSyncJobPayload) => Promise<void>;
}

let defaultJobsPromise: Promise<PushSyncJobs> | undefined;

/**
 * Lazily build the default catch-up queue. Deferred because `defineJob`
 * opens Redis connections, which must not happen at import time. The
 * `jobId` keyed to the account lets BullMQ deduplicate notification bursts.
 */
const getDefaultJobs = (): Promise<PushSyncJobs> => {
	defaultJobsPromise ??= (async () => {
		const { defineJob } = await import("../jobify.ts");
		const catchUp = defineJob(GMAIL_CATCH_UP_QUEUE).input<PushSyncJobPayload>();
		return {
			enqueueCatchUp: async (payload) => {
				await catchUp.add(GMAIL_CATCH_UP_QUEUE, payload, {
					jobId: `${GMAIL_CATCH_UP_QUEUE}:${payload.connectedAccountId}`,
				});
			},
		};
	})();
	return defaultJobsPromise;
};

export interface ProcessPushNotificationDeps {
	/** Injectable db (defaults to the app db, resolved lazily). */
	db?: Db;
	/** Injectable job enqueueing (defaults to the BullMQ catch-up queue). */
	jobs?: PushSyncJobs;
}

export interface ProcessPushNotificationResult {
	/** Active connected accounts a history sync was enqueued for. */
	enqueuedConnectedAccountIds: string[];
}

/**
 * Act on a (verified) push hint: find every ACTIVE Gmail connected_account
 * for the mailbox email and enqueue the same `gmail-catch-up` history-sync
 * job the connect flow uses. The job syncs from its own persisted cursor —
 * this function only signals "this mailbox probably has news".
 */
export const processPushNotification = async (
	emailAddress: string,
	deps: ProcessPushNotificationDeps = {},
): Promise<ProcessPushNotificationResult> => {
	const db = deps.db ?? (await getDb());

	const rows = await db
		.select({ id: connectedAccount.id })
		.from(connectedAccount)
		.where(
			and(
				eq(connectedAccount.emailAddress, emailAddress.toLowerCase()),
				eq(connectedAccount.provider, GMAIL_PROVIDER),
				eq(connectedAccount.status, "active"),
			),
		);

	if (rows.length === 0) {
		return { enqueuedConnectedAccountIds: [] };
	}

	const jobs = deps.jobs ?? (await getDefaultJobs());
	const enqueuedConnectedAccountIds: string[] = [];
	for (const row of rows) {
		await jobs.enqueueCatchUp({ connectedAccountId: row.id });
		enqueuedConnectedAccountIds.push(row.id);
	}

	return { enqueuedConnectedAccountIds };
};

export type GmailPushOutcome =
	| { status: 401 | 403; reason: PushAuthFailureReason }
	| { status: 204; enqueuedConnectedAccountIds: string[] };

export interface HandleGmailPushParams {
	/** Raw `Authorization` header value (null when absent). */
	authorization: string | null;
	/** Raw request body text (parsed defensively here, never by the route). */
	rawBody: string;
}

export type HandleGmailPushDeps = VerifyPushAuthorizationDeps &
	ProcessPushNotificationDeps;

/**
 * Full push-delivery flow, pure of Elysia: verify OIDC auth, decode the
 * envelope hint, enqueue syncs. On valid auth the answer is ALWAYS 204 —
 * unparsable envelopes and unknown mailboxes are acked so Pub/Sub stops
 * redelivering them.
 */
export const handleGmailPush = async (
	params: HandleGmailPushParams,
	config: PushAuthConfig,
	deps: HandleGmailPushDeps = {},
): Promise<GmailPushOutcome> => {
	const auth = await verifyPushAuthorization(params.authorization, config, {
		key: deps.key,
	});
	if (!auth.ok) {
		return {
			status: auth.reason === "missing_token" ? 401 : 403,
			reason: auth.reason,
		};
	}

	let body: unknown;
	try {
		body = JSON.parse(params.rawBody);
	} catch {
		body = null;
	}

	const hint = decodePushEnvelope(body);
	if (!hint) {
		return { status: 204, enqueuedConnectedAccountIds: [] };
	}

	const { enqueuedConnectedAccountIds } = await processPushNotification(
		hint.emailAddress,
		{ db: deps.db, jobs: deps.jobs },
	);
	return { status: 204, enqueuedConnectedAccountIds };
};
