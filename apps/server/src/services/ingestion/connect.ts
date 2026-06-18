import { and, eq } from "drizzle-orm";

import { connectedAccount } from "../../db/schema.ts";
import { createGmailClient, type GmailProfile } from "../gmail/client.ts";

/**
 * Connection-success semantics for Google OAuth completion.
 *
 * A mailbox connection is considered successful ONLY after a
 * `connected_account` row (status `active`, sync_state `pending`, with the
 * Gmail profile checkpoint) has been committed. Better Auth's
 * `databaseHooks.account.create.after` (wired in `auth.ts`) calls
 * {@link handleAccountCreated} once the OAuth `account` row is committed —
 * that hook fires for BOTH first sign-in account creation and the
 * `linkSocial` linking path, because both go through Better Auth's internal
 * `createAccount` → `createWithHooks` (verified against better-auth 1.6).
 *
 * Failure policy: if the Gmail profile fetch or the checkpoint persistence
 * fails we throw {@link ConnectionCheckpointError}. The error propagates out
 * of the after-hook toward the OAuth callback/onboarding flow, but the linked
 * Better Auth `account` row is NOT deleted — after-hooks run post-commit, so
 * auth state stays linked and the user can re-run connect.
 *
 * Idempotency: re-running connect is a no-op guarded by the
 * `connected_account_user_email_provider_uq` unique index on
 * (user_id, email_address, provider). A concurrent-duplicate insert that
 * slips past the in-transaction existence check is caught as a unique
 * constraint violation and resolved to the surviving row.
 *
 * Testability: no db/redis work happens at import time — the default db and
 * job queues are resolved lazily, and tests inject `db`, `gmail`, and `jobs`.
 */

/** Better Auth provider id for Google OAuth account rows. */
export const GOOGLE_PROVIDER_ID = "google";

/** `connected_account.provider` value for Gmail mailboxes. */
export const GMAIL_PROVIDER = "gmail" as const;

/** Queue name for the post-connect catch-up job (worker added later). */
export const GMAIL_CATCH_UP_QUEUE = "gmail-catch-up";

/** Queue name for the post-connect watch-setup job (worker added later). */
export const GMAIL_WATCH_SETUP_QUEUE = "gmail-watch-setup";

type Db = typeof import("../../db/index.ts")["db"];

let defaultDb: Db | undefined;

const getDb = async (): Promise<Db> => {
	if (!defaultDb) {
		({ db: defaultDb } = await import("../../db/index.ts"));
	}
	return defaultDb;
};

/** Payload shared by both post-connect jobs. */
export interface ConnectJobPayload {
	connectedAccountId: string;
}

/** Injectable job-enqueue seam (defaults to BullMQ queues via jobify). */
export interface ConnectJobs {
	enqueueCatchUp: (payload: ConnectJobPayload) => Promise<void>;
	enqueueWatchSetup: (payload: ConnectJobPayload) => Promise<void>;
}

let defaultJobsPromise: Promise<ConnectJobs> | undefined;

/**
 * Lazily build the default job queues. Deferred because `defineJob` creates
 * BullMQ queues against the shared Redis client, which must not happen at
 * import time (tests, config validation).
 *
 * `jobId` is keyed to the connected account so BullMQ also deduplicates
 * redundant enqueues at the queue level.
 */
const getDefaultJobs = (): Promise<ConnectJobs> => {
	defaultJobsPromise ??= (async () => {
		const { defineJob } = await import("../jobify.ts");
		// Retry policy (attempts + exponential backoff) is fixed at enqueue time
		// in BullMQ, so the watch-setup job options live with the worker module
		// and are spread into `add` here. Dynamic import keeps the module graph
		// acyclic (jobs/gmail_watch.ts statically imports this module).
		const { GMAIL_WATCH_SETUP_JOB_OPTIONS } = await import(
			"../../jobs/gmail_watch.ts"
		);
		const catchUp = defineJob(GMAIL_CATCH_UP_QUEUE).input<ConnectJobPayload>();
		const watchSetup = defineJob(
			GMAIL_WATCH_SETUP_QUEUE,
		).input<ConnectJobPayload>();

		return {
			enqueueCatchUp: async (payload) => {
				await catchUp.add(GMAIL_CATCH_UP_QUEUE, payload, {
					jobId: `${GMAIL_CATCH_UP_QUEUE}:${payload.connectedAccountId}`,
				});
			},
			enqueueWatchSetup: async (payload) => {
				await watchSetup.add(GMAIL_WATCH_SETUP_QUEUE, payload, {
					jobId: `${GMAIL_WATCH_SETUP_QUEUE}:${payload.connectedAccountId}`,
					...GMAIL_WATCH_SETUP_JOB_OPTIONS,
				});
			},
		};
	})();
	return defaultJobsPromise;
};

/**
 * Gmail profile fetch or checkpoint persistence failed — the connection is
 * NOT established. The linked Better Auth account row is left intact so the
 * user can re-run connect.
 */
export class ConnectionCheckpointError extends Error {
	readonly code = "CONNECTION_CHECKPOINT_FAILED";

	constructor(authAccountId: string, cause: unknown) {
		super(
			`Failed to establish Gmail connection checkpoint for auth account ${authAccountId}`,
			{ cause },
		);
		this.name = "ConnectionCheckpointError";
	}
}

/** SQLite/libsql unique-index violation (any driver message shape). */
const isUniqueConstraintViolation = (error: unknown): boolean =>
	error instanceof Error &&
	/UNIQUE constraint failed|SQLITE_CONSTRAINT/i.test(error.message);

/** Minimal Gmail client surface this module needs. */
export type ConnectGmailClient = {
	getProfile: () => Promise<GmailProfile>;
};

export interface ConnectGoogleAccountDeps {
	/** Injectable db (defaults to the app db, resolved lazily). */
	db?: Db;
	/** Injectable Gmail client (defaults to `createGmailClient(authAccountId)`). */
	gmail?: ConnectGmailClient;
	/** Injectable job enqueueing (defaults to BullMQ queues). */
	jobs?: ConnectJobs;
	/** Sink for post-commit enqueue failures (defaults to console.error). */
	onEnqueueError?: (error: unknown) => void;
}

export interface ConnectGoogleAccountParams extends ConnectGoogleAccountDeps {
	/** Better Auth `account.id` of the Google OAuth row. */
	authAccountId: string;
	/** Owning Better Auth user id. */
	userId: string;
}

export interface ConnectGoogleAccountResult {
	connectedAccountId: string;
	/** false when an equivalent connection already existed (idempotent no-op). */
	created: boolean;
}

/**
 * Establish (or idempotently re-establish) a Gmail mailbox connection.
 *
 * 1. Fetch the Gmail profile — its `historyId` is the sync checkpoint and
 *    its `emailAddress` identifies the mailbox.
 * 2. In ONE transaction: if a `connected_account` already exists for
 *    (user, mailbox email, provider) return it unchanged; otherwise insert
 *    the row with `status: "active"`, `sync_state: "pending"`, and the
 *    checkpoint. Connection success === this transaction committing.
 * 3. After commit (only for newly created rows) enqueue the catch-up and
 *    watch-setup jobs WITHOUT blocking the caller; enqueue failures are
 *    reported to `onEnqueueError`, never thrown.
 */
export const connectGoogleAccount = async (
	params: ConnectGoogleAccountParams,
): Promise<ConnectGoogleAccountResult> => {
	const db = params.db ?? (await getDb());
	const gmail = params.gmail ?? createGmailClient(params.authAccountId);

	let profile: GmailProfile;
	try {
		profile = await gmail.getProfile();
	} catch (error) {
		throw new ConnectionCheckpointError(params.authAccountId, error);
	}

	const emailAddress = profile.emailAddress.toLowerCase();
	const checkpointHistoryId = String(profile.historyId);
	const uniqueKey = and(
		eq(connectedAccount.userId, params.userId),
		eq(connectedAccount.emailAddress, emailAddress),
		eq(connectedAccount.provider, GMAIL_PROVIDER),
	);

	let result: ConnectGoogleAccountResult;
	try {
		result = await db.transaction(async (tx) => {
			const existing = await tx
				.select({ id: connectedAccount.id })
				.from(connectedAccount)
				.where(uniqueKey)
				.limit(1);

			const existingRow = existing[0];
			if (existingRow) {
				return { connectedAccountId: existingRow.id, created: false };
			}

			const inserted = await tx
				.insert(connectedAccount)
				.values({
					userId: params.userId,
					authAccountId: params.authAccountId,
					provider: GMAIL_PROVIDER,
					emailAddress,
					status: "active",
					syncState: "pending",
					checkpointHistoryId,
					checkpointAt: new Date(),
				})
				.returning({ id: connectedAccount.id });

			const insertedRow = inserted[0];
			if (!insertedRow) {
				throw new Error("connected_account insert returned no row");
			}
			return { connectedAccountId: insertedRow.id, created: true };
		});
	} catch (error) {
		if (!isUniqueConstraintViolation(error)) {
			throw new ConnectionCheckpointError(params.authAccountId, error);
		}

		// A concurrent connect won the insert race — resolve to its row.
		const existing = await db
			.select({ id: connectedAccount.id })
			.from(connectedAccount)
			.where(uniqueKey)
			.limit(1);
		const existingRow = existing[0];
		if (!existingRow) {
			throw new ConnectionCheckpointError(params.authAccountId, error);
		}
		result = { connectedAccountId: existingRow.id, created: false };
	}

	if (result.created) {
		const onEnqueueError =
			params.onEnqueueError ??
			((error: unknown) =>
				console.error(
					"[ingestion/connect] failed to enqueue post-connect job",
					error,
				));
		const payload: ConnectJobPayload = {
			connectedAccountId: result.connectedAccountId,
		};

		// Fire-and-forget: enqueueing must never block or fail the connection.
		void (async () => {
			const jobs = params.jobs ?? (await getDefaultJobs());
			const settled = await Promise.allSettled([
				jobs.enqueueCatchUp(payload),
				jobs.enqueueWatchSetup(payload),
			]);
			for (const outcome of settled) {
				if (outcome.status === "rejected") {
					onEnqueueError(outcome.reason);
				}
			}
		})();
	}

	return result;
};

/** Shape of the Better Auth `account` row delivered to database hooks. */
export interface AuthAccountCreatedEvent {
	id: string;
	providerId: string;
	userId: string;
}

/**
 * `databaseHooks.account.create.after` handler: connect the Gmail mailbox
 * for newly created/linked Google accounts; ignore every other provider
 * (e.g. `credential` email/password rows).
 *
 * Returns null when skipped, the connect result otherwise. Errors propagate
 * to the OAuth callback — see module docs for the failure policy.
 */
export const handleAccountCreated = async (
	authAccount: AuthAccountCreatedEvent,
	deps: ConnectGoogleAccountDeps = {},
): Promise<ConnectGoogleAccountResult | null> => {
	if (authAccount.providerId !== GOOGLE_PROVIDER_ID) {
		return null;
	}
	return connectGoogleAccount({
		authAccountId: authAccount.id,
		userId: authAccount.userId,
		...deps,
	});
};
