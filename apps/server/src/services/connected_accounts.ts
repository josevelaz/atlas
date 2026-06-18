import { and, asc, eq, ne } from "drizzle-orm";

import { account, connectedAccount, user } from "../db/schema.ts";
import { createGmailClient } from "./gmail/client.ts";

/**
 * Connected-accounts service.
 *
 * "Connected accounts" are the OAuth provider rows in the `account` table
 * (Google, etc.), enriched with the product-level `connected_account`
 * domain row (sync status, checkpoints, disconnect state) joined on
 * `connected_account.auth_account_id`. Credential rows
 * (`providerId === "credential"` — email + password) are NOT connected
 * accounts and are always excluded.
 *
 * The domain row is nullable in the list DTO: an OAuth `account` row can
 * exist without a `connected_account` row when the post-OAuth connection
 * checkpoint (`services/ingestion/connect.ts`) has not committed (yet).
 *
 * Testability: this module performs NO db work at import time. The default
 * db client is resolved lazily (importing `../db/index.ts` eagerly would
 * trigger `config.ts` env validation, which requires BETTER_AUTH_SECRET).
 * Both query functions also accept an injectable `dbClient` so tests can
 * pass a stub or an in-memory database.
 */

/** Better Auth's provider id for email/password rows. */
export const CREDENTIAL_PROVIDER_ID = "credential";

type Db = typeof import("../db/index.ts")["db"];

let defaultDb: Db | undefined;

const getDb = async (): Promise<Db> => {
	if (!defaultDb) {
		({ db: defaultDb } = await import("../db/index.ts"));
	}
	return defaultDb;
};

/** Product-level connection status (`connected_account.status`). */
export type ConnectedAccountStatus =
	(typeof connectedAccount.$inferSelect)["status"];

/** Product-level sync state (`connected_account.sync_state`). */
export type ConnectedAccountSyncState =
	(typeof connectedAccount.$inferSelect)["syncState"];

/**
 * Minimal shape of an `account` row — left-joined with its
 * `connected_account` domain row — needed by the pure helpers. The sync
 * fields are null when no domain row exists for the account.
 */
export interface ConnectedAccountRow {
	id: string;
	providerId: string;
	idToken: string | null;
	isPrimary: boolean;
	createdAt: Date;
	status: ConnectedAccountStatus | null;
	syncState: ConnectedAccountSyncState | null;
	lastSyncedAt: Date | null;
}

export interface ConnectedAccountDto {
	id: string;
	providerId: string;
	/** Provider account email (from the id token), or the user's email. */
	email: string;
	isPrimary: boolean;
	/** ISO 8601 timestamp. */
	createdAt: string;
	/** Null when the connection checkpoint has not committed (yet). */
	status: ConnectedAccountStatus | null;
	/** Null when the connection checkpoint has not committed (yet). */
	syncState: ConnectedAccountSyncState | null;
	/** ISO 8601 timestamp of the last completed sync, or null. */
	lastSyncedAt: string | null;
}

/** Target account does not exist or does not belong to the user. */
export class ConnectedAccountNotFoundError extends Error {
	readonly code = "CONNECTED_ACCOUNT_NOT_FOUND";

	constructor(accountId: string) {
		super(`Connected account not found: ${accountId}`);
		this.name = "ConnectedAccountNotFoundError";
	}
}

/** Target account is a credential (email/password) row, not an OAuth one. */
export class ConnectedAccountForbiddenError extends Error {
	readonly code = "CONNECTED_ACCOUNT_FORBIDDEN";

	constructor(accountId: string) {
		super(`Account is not a connected OAuth account: ${accountId}`);
		this.name = "ConnectedAccountForbiddenError";
	}
}

/**
 * Decode a JWT payload WITHOUT signature verification.
 *
 * Safe here because the id token was stored by our own server-side OAuth
 * flow — we only read a display email from it, we grant nothing based on it.
 * Returns null for anything that isn't a well-formed JWT payload.
 */
export const decodeJwtPayload = (
	token: string,
): Record<string, unknown> | null => {
	const payloadPart = token.split(".")[1];
	if (!payloadPart) {
		return null;
	}

	try {
		const json = Buffer.from(payloadPart, "base64url").toString("utf8");
		const payload: unknown = JSON.parse(json);
		return typeof payload === "object" && payload !== null
			? (payload as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
};

/**
 * Map an account row to its public DTO.
 *
 * Email resolution: the `email` claim of the stored id token, falling back
 * to the owning user's email when the token is absent or unreadable.
 */
export const toConnectedAccountDto = (
	row: ConnectedAccountRow,
	userEmail: string,
): ConnectedAccountDto => {
	const claims = row.idToken ? decodeJwtPayload(row.idToken) : null;
	const emailClaim = claims?.email;
	const email =
		typeof emailClaim === "string" && emailClaim.length > 0
			? emailClaim
			: userEmail;

	return {
		id: row.id,
		providerId: row.providerId,
		email,
		isPrimary: row.isPrimary,
		createdAt: row.createdAt.toISOString(),
		status: row.status,
		syncState: row.syncState,
		lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
	};
};

/**
 * Pick the effective primary account:
 * the explicitly flagged row when one exists, otherwise the oldest by
 * `createdAt` with a deterministic tiebreak on `id`.
 *
 * Returns null only for an empty list — never null when ≥1 account exists.
 */
export const pickEffectivePrimary = <
	T extends Pick<ConnectedAccountRow, "id" | "isPrimary" | "createdAt">,
>(
	accounts: readonly T[],
): T | null => {
	const flagged = accounts.find((row) => row.isPrimary);
	if (flagged) {
		return flagged;
	}

	let oldest: T | null = null;
	for (const row of accounts) {
		if (
			!oldest ||
			row.createdAt.getTime() < oldest.createdAt.getTime() ||
			(row.createdAt.getTime() === oldest.createdAt.getTime() &&
				row.id < oldest.id)
		) {
			oldest = row;
		}
	}
	return oldest;
};

/**
 * List a user's connected (OAuth) accounts as DTOs, with the effective
 * primary marked — even when no row is explicitly flagged yet.
 */
export const listConnectedAccounts = async (
	userId: string,
	dbClient?: Db,
): Promise<ConnectedAccountDto[]> => {
	const db = dbClient ?? (await getDb());

	const [owner, rows] = await Promise.all([
		db
			.select({ email: user.email })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1),
		db
			.select({
				id: account.id,
				providerId: account.providerId,
				idToken: account.idToken,
				isPrimary: account.isPrimary,
				createdAt: account.createdAt,
				status: connectedAccount.status,
				syncState: connectedAccount.syncState,
				lastSyncedAt: connectedAccount.lastSyncedAt,
			})
			.from(account)
			.leftJoin(
				connectedAccount,
				eq(connectedAccount.authAccountId, account.id),
			)
			.where(
				and(
					eq(account.userId, userId),
					ne(account.providerId, CREDENTIAL_PROVIDER_ID),
				),
			)
			.orderBy(asc(account.createdAt), asc(account.id)),
	]);

	const userEmail = owner[0]?.email ?? "";
	const effectivePrimary = pickEffectivePrimary(rows);

	return rows.map((row) => ({
		...toConnectedAccountDto(row, userEmail),
		isPrimary: row.id === effectivePrimary?.id,
	}));
};

/**
 * Atomically flag `accountId` as the user's primary connected account.
 *
 * Throws {@link ConnectedAccountNotFoundError} when the account does not
 * exist or is not owned by `userId` (deliberately indistinguishable, to
 * avoid leaking other users' account ids), and
 * {@link ConnectedAccountForbiddenError} for credential rows.
 *
 * The previous primary is cleared first so the partial unique index
 * (`account_user_primary_uq`) is never violated mid-transaction.
 */
export const setPrimaryConnectedAccount = async (
	userId: string,
	accountId: string,
	dbClient?: Db,
): Promise<void> => {
	const db = dbClient ?? (await getDb());

	await db.transaction(async (tx) => {
		const targets = await tx
			.select({
				id: account.id,
				userId: account.userId,
				providerId: account.providerId,
			})
			.from(account)
			.where(eq(account.id, accountId))
			.limit(1);

		const target = targets[0];
		if (!target || target.userId !== userId) {
			throw new ConnectedAccountNotFoundError(accountId);
		}
		if (target.providerId === CREDENTIAL_PROVIDER_ID) {
			throw new ConnectedAccountForbiddenError(accountId);
		}

		await tx
			.update(account)
			.set({ isPrimary: false })
			.where(
				and(
					eq(account.userId, userId),
					ne(account.id, accountId),
					eq(account.isPrimary, true),
				),
			);

		await tx
			.update(account)
			.set({ isPrimary: true })
			.where(eq(account.id, accountId));
	});
};

/** Minimal Gmail client surface the disconnect flow needs. */
export type StopGmailClient = {
	stop: () => Promise<void>;
};

/** What happened to the Gmail watch during disconnect. */
export type DisconnectWatchStopOutcome =
	/** `users.stop` succeeded. */
	| "stopped"
	/** No watch to stop (never watching), or already disconnected. */
	| "skipped"
	/** `users.stop` failed — best-effort only, disconnect still succeeded. */
	| "failed";

export interface DisconnectConnectedAccountResult {
	alreadyDisconnected: boolean;
	watchStop: DisconnectWatchStopOutcome;
}

export interface DisconnectConnectedAccountDeps {
	/** Injectable db (defaults to the app db, resolved lazily). */
	db?: Db;
	/** Injectable Gmail client (defaults to `createGmailClient(authAccountId)`). */
	gmail?: StopGmailClient;
	/** Sink for best-effort watch-stop failures (defaults to console.error). */
	onStopError?: (error: unknown) => void;
}

/**
 * Disconnect a connected account, keyed by its Better Auth `account.id`
 * (the same `id` the list DTO and the primary-account endpoint use).
 *
 * Semantics (per the ingestion plan glossary — disconnected sources become
 * read-only, retained data stays):
 *
 *   1. The `connected_account` domain row gets `status: "disconnected"` and
 *      `disconnected_at` — this is the authoritative kill switch: every sync
 *      job runner (e.g. `jobs/gmail_watch.ts`) skips disconnected accounts,
 *      so no future sync work happens for the mailbox.
 *   2. Gmail watch is stopped BEST-EFFORT, after the status flip commits: a
 *      Gmail outage must never block a disconnect. Failures go to
 *      `onStopError`; an un-stopped watch lapses at `watch_expiration`
 *      anyway. The stop call is skipped entirely when the account never had
 *      a watch (no `watching` sync state and no recorded expiration).
 *   3. All existing threads/messages are RETAINED — nothing is deleted.
 *
 * Idempotent: disconnecting an already-disconnected account is a no-op
 * (`alreadyDisconnected: true`, no second stop call, timestamps untouched).
 *
 * Throws {@link ConnectedAccountNotFoundError} when the account does not
 * exist, is not owned by `userId` (indistinguishable on purpose), or has no
 * `connected_account` domain row (nothing was ever connected), and
 * {@link ConnectedAccountForbiddenError} for credential rows.
 */
export const disconnectConnectedAccount = async (
	userId: string,
	accountId: string,
	deps: DisconnectConnectedAccountDeps = {},
): Promise<DisconnectConnectedAccountResult> => {
	const db = deps.db ?? (await getDb());

	const targets = await db
		.select({
			id: account.id,
			userId: account.userId,
			providerId: account.providerId,
		})
		.from(account)
		.where(eq(account.id, accountId))
		.limit(1);

	const target = targets[0];
	if (!target || target.userId !== userId) {
		throw new ConnectedAccountNotFoundError(accountId);
	}
	if (target.providerId === CREDENTIAL_PROVIDER_ID) {
		throw new ConnectedAccountForbiddenError(accountId);
	}

	const domainRows = await db
		.select({
			id: connectedAccount.id,
			authAccountId: connectedAccount.authAccountId,
			status: connectedAccount.status,
			syncState: connectedAccount.syncState,
			watchExpiration: connectedAccount.watchExpiration,
		})
		.from(connectedAccount)
		.where(
			and(
				eq(connectedAccount.authAccountId, accountId),
				eq(connectedAccount.userId, userId),
			),
		)
		.limit(1);

	const domain = domainRows[0];
	if (!domain) {
		throw new ConnectedAccountNotFoundError(accountId);
	}

	if (domain.status === "disconnected") {
		return { alreadyDisconnected: true, watchStop: "skipped" };
	}

	// Flip the status FIRST — the disconnect must succeed regardless of
	// Gmail availability. Threads/messages are deliberately untouched.
	await db
		.update(connectedAccount)
		.set({ status: "disconnected", disconnectedAt: new Date() })
		.where(eq(connectedAccount.id, domain.id));

	const hadWatch =
		domain.syncState === "watching" || domain.watchExpiration !== null;
	if (!hadWatch) {
		return { alreadyDisconnected: false, watchStop: "skipped" };
	}

	const gmail = deps.gmail ?? createGmailClient(domain.authAccountId);
	try {
		await gmail.stop();
		return { alreadyDisconnected: false, watchStop: "stopped" };
	} catch (error) {
		const onStopError =
			deps.onStopError ??
			((stopError: unknown) =>
				console.error(
					"[connected_accounts] best-effort Gmail watch stop failed",
					stopError,
				));
		onStopError(error);
		return { alreadyDisconnected: false, watchStop: "failed" };
	}
};
