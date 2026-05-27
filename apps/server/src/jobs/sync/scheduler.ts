/**
 * @file scheduler.ts — 5-minute reconciliation scheduler for sync jobs.
 *
 * ## Purpose
 *
 * Registers an idempotent BullMQ repeatable job scheduler that fires every
 * `config.SYNC_RECONCILIATION_CADENCE_MS` (default: 5 minutes).  On each
 * tick, it fans out to `enqueueSyncTrigger` for every `connected_account`
 * with `status = "active"`.
 *
 * ## Design invariants
 *
 * 1. **No `sync_job` rows created here.**
 *    The scheduler only calls `enqueueSyncTrigger`, which is the single enqueue
 *    entry point.  `sync_job` rows are created only after the execution-time
 *    lock is acquired inside the trigger worker.
 *
 * 2. **Idempotent registration.**
 *    `queue.upsertJobScheduler(SCHEDULER_ID, ...)` is used instead of
 *    `queue.add(...)`.  BullMQ upserts the scheduler by ID — calling
 *    `registerSyncScheduler` multiple times (e.g. on server restart) does NOT
 *    create duplicate schedulers.
 *
 * 3. **`SYNC_SCHEDULER_ENABLED=false` prevents registration.**
 *    When the flag is false, `registerSyncScheduler` returns immediately
 *    without touching BullMQ.  This is the mechanism by which test
 *    environments suppress the scheduler.
 *
 * 4. **Only `active` accounts are eligible.**
 *    Accounts with `status = "disconnected"`, `"reactivating"`, or `"error"`
 *    are skipped.  The scheduler queries the DB for active accounts on each
 *    tick.
 *
 * 5. **Missing `sync_state` bootstraps initial sync.**
 *    `enqueueSyncTrigger` → trigger worker → `resolveRunType` →
 *    `bootstrapSyncState` handles accounts that have never been synced.
 *    The scheduler does not need to distinguish initial vs incremental.
 *
 * ## Usage
 *
 * ```ts
 * import { registerSyncScheduler, removeSyncScheduler } from "./jobs/sync/scheduler.ts";
 *
 * // On server start (after workers are running):
 * await registerSyncScheduler();
 *
 * // On graceful shutdown (optional — scheduler persists in Redis):
 * await removeSyncScheduler();
 * ```
 */

import { Queue } from "bullmq";

import { config } from "../../config.ts";
import { BULLMQ_PREFIX } from "../../services/jobify.ts";
import { enqueueSyncTrigger } from "../../services/sync/orchestrator.ts";
import type { Db } from "../../services/sync/state.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The BullMQ queue that the scheduler fires into.
 * Must match the queue name used by the sync:trigger job definition.
 */
const SYNC_TRIGGER_QUEUE_NAME = "sync-trigger";

/**
 * Stable scheduler ID used for idempotent upsert.
 *
 * BullMQ identifies schedulers by this string.  Using a fixed ID means
 * calling `upsertJobScheduler` on every server start is safe — it updates
 * the existing scheduler rather than creating a duplicate.
 */
export const SCHEDULER_ID = "sync:reconciliation";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Load all `connected_account` rows with `status = "active"` from the DB.
 *
 * Returns only the IDs — the scheduler does not need any other fields.
 */
async function loadActiveAccountIds(db?: Db): Promise<string[]> {
	// Lazy-load the DB to avoid circular imports at module evaluation time.
	const d: Db = db ?? ((await import("../../db/index.ts")) as { db: Db }).db;

	const rows = await d.query.connectedAccount.findMany({
		where: (t, { eq }) => eq(t.status, "active"),
		columns: { id: true },
		orderBy: (t, { asc }) => [asc(t.createdAt)],
	});

	return rows.map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register (or update) the 5-minute reconciliation scheduler in BullMQ.
 *
 * Uses `queue.upsertJobScheduler` so repeated calls are idempotent — the
 * scheduler is created on first call and updated (not duplicated) on
 * subsequent calls.
 *
 * **No-op when `config.SYNC_SCHEDULER_ENABLED` is `false`.**
 *
 * The scheduler fires a repeatable job at the configured cadence.  Each tick
 * fans out to `enqueueSyncTrigger` for every active connected account.
 *
 * The `db` parameter is accepted for API symmetry with `runReconciliation`
 * but is not used here — the scheduler registration does not query the DB.
 */
export async function registerSyncScheduler(_db?: Db): Promise<void> {
	if (!config.SYNC_SCHEDULER_ENABLED) {
		console.log(
			"[sync:scheduler] SYNC_SCHEDULER_ENABLED=false — scheduler not registered",
		);
		return;
	}

	const queue = new Queue(SYNC_TRIGGER_QUEUE_NAME, {
		connection: (await import("../../services/redis.ts")).redis,
		prefix: BULLMQ_PREFIX,
	});

	try {
		// Upsert the scheduler — idempotent by SCHEDULER_ID.
		// If a scheduler with this ID already exists, BullMQ updates it in place.
		// If it does not exist, BullMQ creates it.
		await queue.upsertJobScheduler(
			SCHEDULER_ID,
			{
				// Repeat every N milliseconds (default: 300 000 ms = 5 minutes).
				every: config.SYNC_RECONCILIATION_CADENCE_MS,
			},
			{
				// Template job data — the actual fan-out happens inside the
				// repeatable job's processor (runReconciliation).
				// We store a sentinel payload so the worker knows this is a
				// scheduler tick, not a direct enqueue.
				name: SCHEDULER_ID,
				data: { _schedulerTick: true },
				opts: {
					removeOnComplete: { count: 10 },
					removeOnFail: { count: 10 },
				},
			},
		);

		console.log(
			`[sync:scheduler] registered scheduler id=${SCHEDULER_ID} every=${config.SYNC_RECONCILIATION_CADENCE_MS}ms`,
		);
	} finally {
		await queue.close();
	}
}

/**
 * Remove the reconciliation scheduler from BullMQ.
 *
 * Safe to call even if the scheduler does not exist (no-op in that case).
 * Typically called during graceful shutdown or in test teardown.
 *
 * **No-op when `config.SYNC_SCHEDULER_ENABLED` is `false`.**
 */
export async function removeSyncScheduler(): Promise<void> {
	if (!config.SYNC_SCHEDULER_ENABLED) {
		return;
	}

	const queue = new Queue(SYNC_TRIGGER_QUEUE_NAME, {
		connection: (await import("../../services/redis.ts")).redis,
		prefix: BULLMQ_PREFIX,
	});

	try {
		await queue.removeJobScheduler(SCHEDULER_ID);
		console.log(`[sync:scheduler] removed scheduler id=${SCHEDULER_ID}`);
	} finally {
		await queue.close();
	}
}

/**
 * Execute one reconciliation tick: fan out to `enqueueSyncTrigger` for every
 * active connected account.
 *
 * This function is the core logic of the scheduler.  It is called by the
 * repeatable job processor on each tick.  It can also be called directly in
 * tests to verify fan-out behaviour without requiring a running BullMQ
 * scheduler.
 *
 * **Key invariants:**
 * - Only accounts with `status = "active"` are eligible.
 * - `enqueueSyncTrigger` handles deduplication — if a run is already active
 *   for an account, the enqueue is skipped.
 * - No `sync_job` rows are created here.
 * - Missing `sync_state` rows are bootstrapped by the trigger worker.
 *
 * @param db - Optional DB instance (injected in tests).
 * @returns A summary of the tick: how many accounts were found, enqueued,
 *          and skipped.
 */
export async function runReconciliation(
	db?: Db,
): Promise<ReconciliationResult> {
	const accountIds = await loadActiveAccountIds(db);

	console.log(
		`[sync:scheduler] reconciliation tick: found ${accountIds.length} active account(s)`,
	);

	let enqueued = 0;
	let skipped = 0;
	let errors = 0;

	for (const connectedAccountId of accountIds) {
		try {
			const outcome = await enqueueSyncTrigger(
				{ connectedAccountId, triggerSource: "reconciliation" },
				db,
			);

			if (outcome.status === "enqueued") {
				enqueued++;
				console.log(
					`[sync:scheduler] enqueued connectedAccountId=${connectedAccountId} jobId=${outcome.jobId}`,
				);
			} else {
				skipped++;
				console.log(
					`[sync:scheduler] skipped connectedAccountId=${connectedAccountId} reason=${outcome.status}`,
				);
			}
		} catch (err) {
			errors++;
			console.error(
				`[sync:scheduler] error enqueueing connectedAccountId=${connectedAccountId}:`,
				err,
			);
		}
	}

	const result: ReconciliationResult = {
		accountsFound: accountIds.length,
		enqueued,
		skipped,
		errors,
	};

	console.log(
		`[sync:scheduler] reconciliation tick complete: accountsFound=${result.accountsFound} enqueued=${result.enqueued} skipped=${result.skipped} errors=${result.errors}`,
	);

	return result;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Summary of a single reconciliation tick. */
export interface ReconciliationResult {
	/** Total number of active connected accounts found. */
	accountsFound: number;
	/** Number of accounts for which a sync:trigger job was enqueued. */
	enqueued: number;
	/** Number of accounts skipped (already running or queued). */
	skipped: number;
	/** Number of accounts that encountered an error during enqueue. */
	errors: number;
}
