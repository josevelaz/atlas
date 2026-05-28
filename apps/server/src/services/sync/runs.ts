/**
 * @file runs.ts — Sync job (run) persistence service.
 *
 * ## Responsibilities
 *
 * 1. **Create a sync_job row** — Insert a new `sync_job` row with status
 *    `"running"` at the start of a top-level cursor-moving run.
 *
 * 2. **Mark run outcome** — Update the `sync_job` row with the final status,
 *    counts, and error detail when the run completes.
 *
 * ## Design notes
 *
 * - `sync_job` rows are append-only.  They are NEVER updated after completion
 *   except by `markRunComplete` (which sets `finishedAt` and `status`).
 * - Only top-level cursor-moving runs create a `sync_job` row.  Sub-batch
 *   operations within a run do NOT create additional rows.
 * - `connected_account.status` is NEVER touched by this service.
 *   Account lifecycle is managed by a separate service.
 */

import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import type * as schema from "../../db/schema/index.ts";
import { syncJob } from "../../db/schema/sync.ts";
import type { SyncRunType } from "../../jobs/sync/types.ts";

// ---------------------------------------------------------------------------
// DB type alias
// ---------------------------------------------------------------------------

/** Drizzle database instance type (with full schema). */
export type Db = LibSQLDatabase<typeof schema>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of a `sync_job` row as returned by service functions. */
export interface SyncJobRow {
	id: string;
	connectedAccountId: string;
	jobType: "initial" | "incremental";
	status: "running" | "success" | "partial_success" | "failed" | "cancelled";
	startedAt: Date;
	finishedAt: Date | null;
	threadsProcessed: number;
	messagesProcessed: number;
	errorsEncountered: number;
	errorDetail: string | null;
	cursorSnapshot: string | null;
	createdAt: Date;
}

/** Options for `createSyncJob`. */
export interface CreateSyncJobOptions {
	/** The connected account this run belongs to. */
	connectedAccountId: string;
	/** The run type for this job. */
	jobType: SyncRunType;
	/**
	 * Optional snapshot of the cursor at the START of this run.
	 * Stored for replay / debugging; not used by the sync engine itself.
	 */
	cursorSnapshot?: string | null;
}

/** Options for `markRunComplete`. */
export interface MarkRunCompleteOptions {
	/** The `sync_job` row ID to update. */
	syncJobId: string;
	/** Final outcome of the run. */
	status: "success" | "partial_success" | "failed";
	/** Number of mail threads processed. */
	threadsProcessed: number;
	/** Number of individual messages processed. */
	messagesProcessed: number;
	/** Number of non-fatal errors encountered. */
	errorsEncountered: number;
	/**
	 * Sanitized error detail (JSON string or plain message).
	 * Only set when `status` is `"failed"` or `"partial_success"`.
	 */
	errorDetail?: string | null;
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
// Create
// ---------------------------------------------------------------------------

/**
 * Insert a new `sync_job` row with status `"running"`.
 *
 * Call this at the START of a top-level cursor-moving run (i.e. when the
 * `sync:process` worker begins execution).  The returned `id` is passed
 * through the job payload so the worker can update the row on completion.
 *
 * @returns The newly created `sync_job` row.
 */
export async function createSyncJob(
	opts: CreateSyncJobOptions,
	db?: Db,
): Promise<SyncJobRow> {
	const d = getDb(db);
	const id = crypto.randomUUID();
	const now = new Date();

	await d.insert(syncJob).values({
		id,
		connectedAccountId: opts.connectedAccountId,
		jobType: opts.jobType,
		status: "running",
		startedAt: now,
		finishedAt: null,
		threadsProcessed: 0,
		messagesProcessed: 0,
		errorsEncountered: 0,
		errorDetail: null,
		cursorSnapshot: opts.cursorSnapshot ?? null,
		createdAt: now,
	});

	const created = await d.query.syncJob.findFirst({
		where: eq(syncJob.id, id),
	});

	if (!created) {
		throw new Error(`Failed to create sync_job row (id=${id})`);
	}

	return created as SyncJobRow;
}

// ---------------------------------------------------------------------------
// Complete
// ---------------------------------------------------------------------------

/**
 * Mark a `sync_job` run as complete.
 *
 * Updates the row with the final status, observability counters, error detail,
 * and `finishedAt` timestamp.  This is the ONLY mutation allowed on a
 * `sync_job` row after creation.
 *
 * `connected_account.status` is NOT touched by this function.
 *
 * @param opts.syncJobId - The row to update.
 * @param opts.status - Final outcome.
 * @param opts.threadsProcessed - Total threads processed in this run.
 * @param opts.messagesProcessed - Total messages processed in this run.
 * @param opts.errorsEncountered - Non-fatal error count.
 * @param opts.errorDetail - Sanitized error detail (optional).
 */
export async function markRunComplete(
	opts: MarkRunCompleteOptions,
	db?: Db,
): Promise<void> {
	const d = getDb(db);
	const now = new Date();

	await d
		.update(syncJob)
		.set({
			status: opts.status,
			finishedAt: now,
			threadsProcessed: opts.threadsProcessed,
			messagesProcessed: opts.messagesProcessed,
			errorsEncountered: opts.errorsEncountered,
			errorDetail: opts.errorDetail ?? null,
		})
		.where(eq(syncJob.id, opts.syncJobId));
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/**
 * Load a `sync_job` row by its ID.
 *
 * Returns `null` if no row with the given ID exists.
 */
export async function getSyncJob(
	syncJobId: string,
	db?: Db,
): Promise<SyncJobRow | null> {
	const d = getDb(db);
	const row = await d.query.syncJob.findFirst({
		where: eq(syncJob.id, syncJobId),
	});
	return (row as SyncJobRow | undefined) ?? null;
}

/**
 * Load all `sync_job` rows for a connected account, ordered by `startedAt`
 * descending (most recent first).
 */
export async function listSyncJobs(
	connectedAccountId: string,
	db?: Db,
): Promise<SyncJobRow[]> {
	const d = getDb(db);
	const rows = await d.query.syncJob.findMany({
		where: eq(syncJob.connectedAccountId, connectedAccountId),
		orderBy: (t, { desc }) => [desc(t.startedAt)],
	});
	return rows as SyncJobRow[];
}
