/**
 * @file state.ts — Sync state service: bootstrap, cursor advancement, and health.
 *
 * ## Responsibilities
 *
 * 1. **Bootstrap** — Ensure a `sync_state` row exists for a connected account.
 *    If missing, insert one with `syncMode = "initial"` and `health = "ok"`.
 *
 * 2. **Run type resolution** — Determine whether the next run should be
 *    `"initial"` (no cursor) or `"incremental"` (cursor present).
 *
 * 3. **Cursor advancement** — Atomically update `sync_state.syncCursor` and
 *    `sync_state.syncMode` within a caller-supplied transaction so that the
 *    cursor and the batch commit are durable together.
 *
 * 4. **Health tracking** — Update `sync_state.health` after a run completes
 *    without touching `connected_account.status`.
 *
 * ## Cursor atomicity guarantee
 *
 * `commitBatchWithCursor` accepts a callback that performs the batch DB writes
 * and then advances the cursor in the SAME transaction.  This ensures that:
 *   - A crash before the transaction commits leaves both the batch and the
 *     cursor un-persisted (safe to retry).
 *   - A crash after the transaction commits leaves both durable (no data loss,
 *     no cursor regression).\
 *
 * The cursor is NEVER advanced outside of a batch transaction.
 */

import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import type * as schema from "../../db/schema/index.ts";
import { syncState } from "../../db/schema/sync.ts";
import type { SyncRunType } from "../../jobs/sync/types.ts";

// ---------------------------------------------------------------------------
// DB type alias
// ---------------------------------------------------------------------------

/** Drizzle database instance type (with full schema). */
export type Db = LibSQLDatabase<typeof schema>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of a `sync_state` row as returned by service functions. */
export interface SyncStateRow {
	id: string;
	connectedAccountId: string;
	syncCursor: string | null;
	syncMode: "initial" | "incremental";
	health: "ok" | "degraded" | "failed";
	lastSyncedAt: Date | null;
	lastAttemptedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

/** Options for `commitBatchWithCursor`. */
export interface CommitBatchOptions {
	/** The connected account whose cursor is being advanced. */
	connectedAccountId: string;
	/** The new cursor value to persist. Pass `null` to clear the cursor. */
	nextCursor: string | null;
	/**
	 * Callback that performs the batch DB writes.
	 * Receives the same transaction so all writes are atomic with the cursor
	 * update.  The callback MUST use the provided `tx` for all DB operations.
	 */
	batchFn: (tx: Db) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Default DB accessor (lazy — avoids importing config at module load time)
// ---------------------------------------------------------------------------

let _defaultDb: Db | undefined;

function getDb(db?: Db): Db {
	if (db) return db;
	if (!_defaultDb) {
		// Dynamic import is not available synchronously; use a synchronous
		// require-style workaround via Bun's module cache.
		// biome-ignore lint/suspicious/noExplicitAny: intentional lazy load
		_defaultDb = (require("../../db/index.ts") as any).db as Db;
	}
	return _defaultDb;
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

/**
 * Ensure a `sync_state` row exists for the given connected account.
 *
 * If no row exists, inserts one with:
 *   - `syncMode = "initial"` (no cursor yet)
 *   - `health = "ok"`
 *   - `syncCursor = null`
 *
 * If a row already exists, returns it unchanged.
 *
 * @returns The existing or newly created `sync_state` row.
 */
export async function bootstrapSyncState(
	connectedAccountId: string,
	db?: Db,
): Promise<SyncStateRow> {
	const d = getDb(db);

	// Try to find an existing row first.
	const existing = await d.query.syncState.findFirst({
		where: eq(syncState.connectedAccountId, connectedAccountId),
	});

	if (existing) {
		return existing as SyncStateRow;
	}

	// Insert a fresh row.
	const id = crypto.randomUUID();
	const now = new Date();

	await d.insert(syncState).values({
		id,
		connectedAccountId,
		syncCursor: null,
		syncMode: "initial",
		health: "ok",
		lastSyncedAt: null,
		lastAttemptedAt: null,
		createdAt: now,
		updatedAt: now,
	});

	const created = await d.query.syncState.findFirst({
		where: eq(syncState.connectedAccountId, connectedAccountId),
	});

	if (!created) {
		throw new Error(
			`Failed to bootstrap sync_state for connectedAccountId=${connectedAccountId}`,
		);
	}

	return created as SyncStateRow;
}

// ---------------------------------------------------------------------------
// Run type resolution
// ---------------------------------------------------------------------------

/**
 * Determine the run type for the next sync of a connected account.
 *
 * - `"initial"`     — `sync_state.syncCursor` is null (no cursor established).
 * - `"incremental"` — `sync_state.syncCursor` is non-null.
 *
 * Bootstraps the `sync_state` row if it does not yet exist.
 *
 * @returns The resolved `SyncRunType`.
 */
export async function resolveRunType(
	connectedAccountId: string,
	db?: Db,
): Promise<SyncRunType> {
	const state = await bootstrapSyncState(connectedAccountId, db);
	return state.syncCursor === null ? "initial" : "incremental";
}

// ---------------------------------------------------------------------------
// Cursor advancement (atomic with batch)
// ---------------------------------------------------------------------------

/**
 * Persist a provider batch and advance the sync cursor in a single atomic
 * transaction.
 *
 * The caller supplies a `batchFn` callback that performs all batch DB writes
 * using the transaction handle provided.  After the callback completes, the
 * cursor is updated in the same transaction.
 *
 * **Atomicity guarantee**: either both the batch writes and the cursor update
 * commit together, or neither does.  This prevents cursor regression on crash.
 *
 * After a successful commit:
 *   - `sync_state.syncCursor` is set to `nextCursor`.
 *   - `sync_state.syncMode` is set to `"incremental"` (cursor is now set).
 *   - `sync_state.lastAttemptedAt` is updated to now.
 *
 * @param opts.connectedAccountId - The account whose cursor is being advanced.
 * @param opts.nextCursor - The new cursor value. Pass `null` to clear.
 * @param opts.batchFn - Callback that performs batch writes using the tx.
 */
export async function commitBatchWithCursor(
	opts: CommitBatchOptions,
	db?: Db,
): Promise<void> {
	const d = getDb(db);
	const { connectedAccountId, nextCursor, batchFn } = opts;

	await d.transaction(async (tx) => {
		// Run the caller's batch writes first.
		await batchFn(tx as unknown as Db);

		// Advance the cursor in the same transaction.
		const now = new Date();
		await tx
			.update(syncState)
			.set({
				syncCursor: nextCursor,
				// Once a cursor is established, the mode becomes incremental.
				syncMode: nextCursor !== null ? "incremental" : "initial",
				lastAttemptedAt: now,
				updatedAt: now,
			})
			.where(eq(syncState.connectedAccountId, connectedAccountId));
	});
}

// ---------------------------------------------------------------------------
// Health tracking
// ---------------------------------------------------------------------------

/**
 * Update `sync_state.health` after a run completes.
 *
 * This function ONLY touches `sync_state` — it does NOT modify
 * `connected_account.status`.  Health degradation is a sync-layer concern;
 * account lifecycle is managed separately.
 *
 * Also updates `lastAttemptedAt` on every call, and `lastSyncedAt` when the
 * outcome is `"ok"` (i.e. the run succeeded).
 *
 * @param connectedAccountId - The account to update.
 * @param health - The new health value.
 */
export async function updateSyncHealth(
	connectedAccountId: string,
	health: "ok" | "degraded" | "failed",
	db?: Db,
): Promise<void> {
	const d = getDb(db);
	const now = new Date();

	await d
		.update(syncState)
		.set({
			health,
			lastAttemptedAt: now,
			// Only advance lastSyncedAt on a successful run.
			...(health === "ok" ? { lastSyncedAt: now } : {}),
			updatedAt: now,
		})
		.where(eq(syncState.connectedAccountId, connectedAccountId));
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/**
 * Load the `sync_state` row for a connected account.
 *
 * Returns `null` if no row exists (i.e. the account has never been synced and
 * `bootstrapSyncState` has not yet been called).
 */
export async function getSyncState(
	connectedAccountId: string,
	db?: Db,
): Promise<SyncStateRow | null> {
	const d = getDb(db);
	const row = await d.query.syncState.findFirst({
		where: eq(syncState.connectedAccountId, connectedAccountId),
	});
	return (row as SyncStateRow | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// Ownership loader
// ---------------------------------------------------------------------------

/** Shape of a `connected_account` row as returned by ownership helpers. */
export interface ConnectedAccountRow {
	id: string;
	userId: string;
	providerAccountEmail: string;
	provider: string;
	status: "active" | "disconnected" | "reactivating" | "error";
	displayName: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Load all `connected_account` rows owned by a user.
 *
 * Returns only the accounts that belong to the given `userId`.  This is the
 * canonical entry point for the sync scheduler to discover which accounts
 * need syncing — it never returns accounts owned by other users.
 *
 * @param userId - The Better Auth user ID.
 * @param statusFilter - Optional status filter (defaults to all statuses).
 * @returns Array of connected account rows, ordered by `createdAt` ascending.
 */
export async function loadOwnedConnectedAccounts(
	userId: string,
	statusFilter?: Array<"active" | "disconnected" | "reactivating" | "error">,
	db?: Db,
): Promise<ConnectedAccountRow[]> {
	const d = getDb(db);

	const rows = await d.query.connectedAccount.findMany({
		where: (t, { eq: eqFn, and, inArray }) => {
			const ownershipClause = eqFn(t.userId, userId);
			if (statusFilter && statusFilter.length > 0) {
				return and(ownershipClause, inArray(t.status, statusFilter));
			}
			return ownershipClause;
		},
		orderBy: (t, { asc }) => [asc(t.createdAt)],
	});

	return rows as ConnectedAccountRow[];
}
