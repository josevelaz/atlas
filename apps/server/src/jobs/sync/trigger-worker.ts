/**
 * @file trigger-worker.ts — BullMQ worker for the `sync:trigger` queue.
 *
 * ## Responsibilities
 *
 * 1. **Resolve run type** — Read `sync_state` to determine whether the next
 *    run is `"initial"` (no cursor) or `"incremental"` (cursor present).
 *
 * 2. **Acquire execution-time lock** — Call `withSyncLock` to acquire a
 *    per-account distributed lock before any cursor-mutating work.
 *
 * 3. **Create sync_job row** — Inside the lock, insert a `sync_job` row with
 *    `status = "running"`.  This is the ONLY place `sync_job` rows are created.
 *
 * 4. **Dispatch to sync:process** — Enqueue a `sync:process` job with the
 *    resolved `runType`, `syncJobId`, and `triggerSource`.
 *
 * ## Key invariants
 *
 * - `sync_job` rows are created ONLY after the execution-time lock is acquired.
 * - Deduped/lock-collision paths return `{ enqueued: false }` and do NOT
 *   create `sync_job` rows.
 * - `connected_account.status` is NEVER modified by this worker.
 * - Worker registration is gated on `config.SYNC_WORKER_ENABLED`.
 */

import { Queue, type Worker } from "bullmq";

import { config } from "../../config.ts";
import { BULLMQ_PREFIX, defineJob } from "../../services/jobify.ts";
import { redis } from "../../services/redis.ts";
import { withSyncLock } from "../../services/sync/orchestrator.ts";
import { createSyncJob } from "../../services/sync/runs.ts";
import { resolveRunType } from "../../services/sync/state.ts";
import type {
	SyncProcessPayload,
	SyncTriggerPayload,
	SyncTriggerResult,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUEUE_NAME = "sync:trigger";
const PROCESS_QUEUE_NAME = "sync:process";

// ---------------------------------------------------------------------------
// Job definition
// ---------------------------------------------------------------------------

/**
 * `sync:trigger` job definition.
 *
 * The worker is registered via `.action()`.  Concurrency and retry options
 * are applied via `.options()`.  The job is exported so the orchestrator can
 * enqueue via `syncTriggerJob.add(...)` or directly via `job.queue`.
 */
export const syncTriggerJob = defineJob(QUEUE_NAME)
	.input<SyncTriggerPayload>()
	.options({
		concurrency: config.SYNC_WORKER_CONCURRENCY,
	})
	.action(async (job): Promise<SyncTriggerResult> => {
		const { connectedAccountId, triggerSource } = job.data;

		console.log(
			`[sync:trigger] job=${job.id} connectedAccountId=${connectedAccountId} triggerSource=${triggerSource} attempt=${job.attemptsMade + 1}/${config.SYNC_MAX_ATTEMPTS}`,
		);

		// ── Step 1: Resolve run type from sync_state ──────────────────────────
		const resolvedRunType = await resolveRunType(connectedAccountId);

		console.log(
			`[sync:trigger] job=${job.id} connectedAccountId=${connectedAccountId} resolvedRunType=${resolvedRunType}`,
		);

		// ── Step 2: Acquire execution-time lock and create sync_job row ───────
		const result = await withSyncLock(
			connectedAccountId,
			async () => {
				// Inside the lock: create the sync_job row.
				const syncJobRow = await createSyncJob({
					connectedAccountId,
					jobType: resolvedRunType,
					cursorSnapshot: null,
				});

				console.log(
					`[sync:trigger] job=${job.id} created sync_job row syncJobId=${syncJobRow.id} jobType=${resolvedRunType}`,
				);

				// ── Step 3: Dispatch to sync:process ──────────────────────────────
				const processQueue = new Queue(PROCESS_QUEUE_NAME, {
					connection: redis,
					prefix: BULLMQ_PREFIX,
				});

				try {
					const processPayload: SyncProcessPayload = {
						connectedAccountId,
						runType: resolvedRunType,
						triggerSource,
						syncJobId: syncJobRow.id,
					};

					const processJob = await processQueue.add(
						PROCESS_QUEUE_NAME,
						processPayload,
						{
							attempts: config.SYNC_MAX_ATTEMPTS,
							backoff: {
								type: "exponential",
								delay: config.SYNC_BACKOFF_DELAY_MS,
							},
							// DLQ retention: keep failed jobs indefinitely for inspection.
							// Do NOT auto-delete exhausted jobs — they must be retained in
							// the failed set so operators can inspect and replay them.
							removeOnComplete: { count: 100 },
							removeOnFail: false,
						},
					);

					console.log(
						`[sync:trigger] job=${job.id} enqueued sync:process processJobId=${processJob.id} syncJobId=${syncJobRow.id}`,
					);

					return {
						enqueued: true,
						resolvedRunType,
						processJobId: processJob.id ?? null,
					} satisfies SyncTriggerResult;
				} finally {
					await processQueue.close();
				}
			},
			() => {
				console.warn(
					`[sync:trigger] job=${job.id} lock collision for connectedAccountId=${connectedAccountId} — skipping execution`,
				);
			},
		);

		// Lock was not acquired — return skipped result.
		if (result === null) {
			return {
				enqueued: false,
				resolvedRunType,
				processJobId: null,
			};
		}

		return result;
	});

// ---------------------------------------------------------------------------
// Worker lifecycle
// ---------------------------------------------------------------------------

/**
 * Start the `sync:trigger` worker.
 *
 * Returns the underlying BullMQ `Worker` instance so the caller can close it
 * on graceful shutdown.
 *
 * **No-op when `config.SYNC_WORKER_ENABLED` is `false`.**
 */
export function startSyncTriggerWorker(): Worker | null {
	if (!config.SYNC_WORKER_ENABLED) {
		console.log(
			"[sync:trigger] SYNC_WORKER_ENABLED=false — worker not started",
		);
		return null;
	}

	// Access the underlying BullMQ Worker created by jobify.
	const worker = syncTriggerJob.worker as Worker;

	worker.on("completed", (job, result: SyncTriggerResult) => {
		console.log(
			`[sync:trigger] completed job=${job.id} enqueued=${result.enqueued} resolvedRunType=${result.resolvedRunType} processJobId=${result.processJobId}`,
		);
	});

	worker.on("failed", (job, err) => {
		console.error(
			`[sync:trigger] failed job=${job?.id} attempt=${job?.attemptsMade} error=${err.message}`,
		);
	});

	worker.on("error", (err) => {
		console.error(`[sync:trigger] worker error: ${err.message}`);
	});

	console.log(
		`[sync:trigger] worker started concurrency=${config.SYNC_WORKER_CONCURRENCY}`,
	);

	return worker;
}

/**
 * Stop the `sync:trigger` worker gracefully.
 *
 * Waits for in-flight jobs to complete before closing.
 */
export async function stopSyncTriggerWorker(worker: Worker): Promise<void> {
	console.log("[sync:trigger] stopping worker...");
	await worker.close();
	console.log("[sync:trigger] worker stopped");
}
