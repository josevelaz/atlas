/**
 * @file status.ts — Synthesized sync status view service.
 *
 * ## Purpose
 *
 * Provides a single read function that joins `sync_state` and the most recent
 * `sync_job` row for a connected account into a synthesized status object.
 * This is the canonical read path for displaying sync health in the UI or
 * returning it via the API.
 *
 * ## Design notes
 *
 * - This service is READ-ONLY.  It never writes to the DB.
 * - The synthesized view is computed on the fly — there is no materialized
 *   view or separate table.
 * - Returns `null` when no `sync_state` row exists (account never synced).
 */

import { desc, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import type * as schema from "../../db/schema/index.ts";
import { syncJob, syncState } from "../../db/schema/sync.ts";

// ---------------------------------------------------------------------------
// DB type alias
// ---------------------------------------------------------------------------

/** Drizzle database instance type (with full schema). */
export type Db = LibSQLDatabase<typeof schema>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Synthesized sync status for a connected account.
 *
 * Combines the durable stream state (`sync_state`) with the most recent run
 * record (`sync_job`) into a single view object.
 */
export interface SyncStatus {
	/** The connected account this status belongs to. */
	connectedAccountId: string;

	/** Current sync mode: "initial" (no cursor) or "incremental" (cursor set). */
	syncMode: "initial" | "incremental";

	/** Overall sync health. */
	health: "ok" | "degraded" | "failed";

	/** The current sync cursor (null if no cursor has been established). */
	syncCursor: string | null;

	/** Timestamp of the last successful sync completion. */
	lastSyncedAt: Date | null;

	/** Timestamp of the last sync attempt (success or failure). */
	lastAttemptedAt: Date | null;

	/** Most recent sync job, or null if no jobs have been created yet. */
	lastJob: LastJobSummary | null;
}

/** Summary of the most recent `sync_job` row. */
export interface LastJobSummary {
	id: string;
	jobType: "initial" | "incremental";
	status: "running" | "success" | "partial_success" | "failed" | "cancelled";
	startedAt: Date;
	finishedAt: Date | null;
	threadsProcessed: number;
	messagesProcessed: number;
	errorsEncountered: number;
	errorDetail: string | null;
}

// ---------------------------------------------------------------------------
// Default DB accessor (lazy — avoids importing config at module load time)
// ---------------------------------------------------------------------------

let _defaultDb: Db | undefined;

function getDb(db?: Db): Db {
	if (db) return db;
	if (!_defaultDb) {
		// biome-ignore lint/suspicious/noExplicitAny: intentional lazy load
		_defaultDb = (require("../../db/index.ts") as any).db as Db;
	}
	return _defaultDb;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Read the synthesized sync status for a connected account.
 *
 * Joins `sync_state` with the most recent `sync_job` row (by `startedAt`).
 *
 * @returns The synthesized status, or `null` if no `sync_state` row exists.
 */
export async function getSyncStatus(
	connectedAccountId: string,
	db?: Db,
): Promise<SyncStatus | null> {
	const d = getDb(db);

	// Load the sync_state row.
	const stateRow = await d.query.syncState.findFirst({
		where: eq(syncState.connectedAccountId, connectedAccountId),
	});

	if (!stateRow) {
		return null;
	}

	// Load the most recent sync_job row (may not exist yet).
	const jobRows = await d
		.select()
		.from(syncJob)
		.where(eq(syncJob.connectedAccountId, connectedAccountId))
		.orderBy(desc(syncJob.startedAt))
		.limit(1);

	const lastJobRow = jobRows[0] ?? null;

	const lastJob: LastJobSummary | null = lastJobRow
		? {
				id: lastJobRow.id,
				jobType: lastJobRow.jobType as "initial" | "incremental",
				status: lastJobRow.status as
					| "running"
					| "success"
					| "partial_success"
					| "failed"
					| "cancelled",
				startedAt: lastJobRow.startedAt as Date,
				finishedAt: (lastJobRow.finishedAt as Date | null) ?? null,
				threadsProcessed: lastJobRow.threadsProcessed ?? 0,
				messagesProcessed: lastJobRow.messagesProcessed ?? 0,
				errorsEncountered: lastJobRow.errorsEncountered ?? 0,
				errorDetail: lastJobRow.errorDetail ?? null,
			}
		: null;

	return {
		connectedAccountId,
		syncMode: stateRow.syncMode as "initial" | "incremental",
		health: stateRow.health as "ok" | "degraded" | "failed",
		syncCursor: stateRow.syncCursor ?? null,
		lastSyncedAt: (stateRow.lastSyncedAt as Date | null) ?? null,
		lastAttemptedAt: (stateRow.lastAttemptedAt as Date | null) ?? null,
		lastJob,
	};
}

/**
 * Read synthesized sync statuses for multiple connected accounts in one query.
 *
 * Returns a map of `connectedAccountId → SyncStatus`.  Accounts with no
 * `sync_state` row are omitted from the result.
 *
 * @param connectedAccountIds - The account IDs to look up.
 */
export async function getSyncStatuses(
	connectedAccountIds: string[],
	db?: Db,
): Promise<Map<string, SyncStatus>> {
	if (connectedAccountIds.length === 0) {
		return new Map();
	}

	const result = new Map<string, SyncStatus>();

	// Fetch statuses individually — SQLite in-memory is fast enough for the
	// expected cardinality (tens of accounts per user, not thousands).
	await Promise.all(
		connectedAccountIds.map(async (id) => {
			const status = await getSyncStatus(id, db);
			if (status) {
				result.set(id, status);
			}
		}),
	);

	return result;
}
