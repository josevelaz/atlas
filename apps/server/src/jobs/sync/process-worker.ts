/**
 * @file process-worker.ts — BullMQ worker for the `sync:process` queue.
 *
 * ## Responsibilities
 *
 * 1. **Resolve adapter** — Look up the provider adapter for the connected
 *    account's provider key.  Uses `FakeSyncAdapter` for all providers in
 *    this issue (real adapters are out of scope).
 *
 * 2. **Run the sync loop** — Call the adapter's `fetchInitialBatch` or
 *    `fetchIncrementalBatch` method in a loop until `hasMore` is false.
 *    Each batch is committed atomically with the cursor via
 *    `commitBatchWithCursor`.
 *
 * 3. **Mark run complete** — Update the `sync_job` row with the final status,
 *    observability counters, and error detail.
 *
 * 4. **Update sync health** — Call `updateSyncHealth` to reflect the run
 *    outcome in `sync_state.health`.
 *
 * ## Key invariants
 *
 * - `connected_account.status` is NEVER modified by this worker.
 * - Cursor advancement is a side-effect committed by the adapter via
 *   `ctx.commitCursor` — it is NOT returned as a job result.
 * - Worker registration is gated on `config.SYNC_WORKER_ENABLED`.
 * - DLQ retention: exhausted jobs are kept in the failed set (`removeOnFail: false`)
 *   so operators can inspect and replay them.
 */

import type { Worker } from "bullmq";

import { config } from "../../config.ts";
import { defineJob } from "../../services/jobify.ts";
import { markRunComplete } from "../../services/sync/runs.ts";
import {
	commitBatchWithCursor,
	updateSyncHealth,
} from "../../services/sync/state.ts";
import type { SyncAdapterContext } from "./provider.ts";
import { FakeSyncAdapter } from "./provider.ts";
import type { SyncProcessPayload, SyncProcessResult } from "./types.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUEUE_NAME = "sync:process";

// ---------------------------------------------------------------------------
// Adapter registry (FakeSyncAdapter for all providers in this issue)
// ---------------------------------------------------------------------------

/**
 * The adapter used for all sync runs in this issue.
 *
 * Real Gmail and Outlook adapters are out of scope — `FakeSyncAdapter` is the
 * only adapter registered here.  When real adapters are added, replace this
 * with a `resolveAdapter(registry, provider)` call.
 */
const fakeAdapter = new FakeSyncAdapter();

// ---------------------------------------------------------------------------
// Job definition
// ---------------------------------------------------------------------------

/**
 * `sync:process` job definition.
 *
 * The worker is registered via `.action()`.  Concurrency and retry options
 * are applied via `.options()`.
 */
export const syncProcessJob = defineJob(QUEUE_NAME)
	.input<SyncProcessPayload>()
	.options({
		concurrency: config.SYNC_WORKER_CONCURRENCY,
	})
	.action(async (job): Promise<SyncProcessResult> => {
		const { connectedAccountId, runType, triggerSource, syncJobId } = job.data;

		console.log(
			`[sync:process] job=${job.id} syncJobId=${syncJobId} connectedAccountId=${connectedAccountId} runType=${runType} triggerSource=${triggerSource} attempt=${job.attemptsMade + 1}/${config.SYNC_MAX_ATTEMPTS}`,
		);

		// Observability counters accumulated across all batches in this run.
		let threadsProcessed = 0;
		let messagesProcessed = 0;
		let errorsEncountered = 0;

		try {
			// ── Sync loop ──────────────────────────────────────────────────────
			let hasMore = true;
			let batchIndex = 0;

			while (hasMore) {
				batchIndex++;

				console.log(
					`[sync:process] job=${job.id} syncJobId=${syncJobId} batch=${batchIndex} runType=${runType}`,
				);

				// Build the adapter context for this batch.
				// The cursor is read from the DB inside commitBatchWithCursor;
				// we pass a lazy reader here so the adapter always sees the
				// latest committed cursor.
				let currentCursor: string | null = null;

				// Read the current cursor from sync_state before each batch.
				// We do this outside the adapter context so the adapter receives
				// the value directly (not a DB call).
				const { getSyncState } = await import("../../services/sync/state.ts");
				const stateRow = await getSyncState(connectedAccountId);
				currentCursor = stateRow?.syncCursor ?? null;

				const ctx: SyncAdapterContext = {
					connectedAccountId,
					cursor: currentCursor,
					commitCursor: async (nextCursor: string | null) => {
						// Commit the cursor atomically with an empty batch write.
						// Real adapters would pass their batch items here; the fake
						// adapter has no items to persist, so batchFn is a no-op.
						await commitBatchWithCursor({
							connectedAccountId,
							nextCursor,
							batchFn: async (_tx) => {
								// No-op: FakeSyncAdapter does not persist mail items.
								// Real adapters would insert mail items here.
							},
						});

						console.log(
							`[sync:process] job=${job.id} syncJobId=${syncJobId} batch=${batchIndex} cursor committed nextCursor=${nextCursor}`,
						);
					},
				};

				// Call the appropriate adapter method based on run type.
				const batchResult =
					runType === "initial"
						? await fakeAdapter.fetchInitialBatch(ctx)
						: await fakeAdapter.fetchIncrementalBatch(ctx);

				// Accumulate counters.
				threadsProcessed += batchResult.items.length;
				messagesProcessed += batchResult.items.length;
				errorsEncountered += batchResult.errorsEncountered;

				console.log(
					`[sync:process] job=${job.id} syncJobId=${syncJobId} batch=${batchIndex} items=${batchResult.items.length} errorsEncountered=${batchResult.errorsEncountered} hasMore=${batchResult.hasMore}`,
				);

				hasMore = batchResult.hasMore;
			}

			// ── Mark run complete (success) ────────────────────────────────────
			const finalStatus = errorsEncountered > 0 ? "partial_success" : "success";

			await markRunComplete({
				syncJobId,
				status: finalStatus,
				threadsProcessed,
				messagesProcessed,
				errorsEncountered,
			});

			await updateSyncHealth(connectedAccountId, "ok");

			console.log(
				`[sync:process] job=${job.id} syncJobId=${syncJobId} completed status=${finalStatus} threadsProcessed=${threadsProcessed} messagesProcessed=${messagesProcessed} errorsEncountered=${errorsEncountered}`,
			);

			return {
				syncJobId,
				status: finalStatus,
				threadsProcessed,
				messagesProcessed,
				errorsEncountered,
			};
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);

			console.error(
				`[sync:process] job=${job.id} syncJobId=${syncJobId} failed error=${errorMessage}`,
			);

			// Mark the run as failed in the DB.
			await markRunComplete({
				syncJobId,
				status: "failed",
				threadsProcessed,
				messagesProcessed,
				errorsEncountered,
				errorDetail: errorMessage,
			});

			// Update sync health to reflect the failure.
			// Note: connected_account.status is NEVER touched here.
			await updateSyncHealth(connectedAccountId, "degraded");

			// Re-throw so BullMQ can apply retry/backoff logic.
			throw err;
		}
	});

// ---------------------------------------------------------------------------
// Worker lifecycle
// ---------------------------------------------------------------------------

/**
 * Start the `sync:process` worker.
 *
 * Returns the underlying BullMQ `Worker` instance so the caller can close it
 * on graceful shutdown.
 *
 * **No-op when `config.SYNC_WORKER_ENABLED` is `false`.**
 */
export function startSyncProcessWorker(): Worker | null {
	if (!config.SYNC_WORKER_ENABLED) {
		console.log(
			"[sync:process] SYNC_WORKER_ENABLED=false — worker not started",
		);
		return null;
	}

	// Access the underlying BullMQ Worker created by jobify.
	const worker = syncProcessJob.worker as Worker;

	worker.on("completed", (job, result: SyncProcessResult) => {
		console.log(
			`[sync:process] completed job=${job.id} syncJobId=${result.syncJobId} status=${result.status} threadsProcessed=${result.threadsProcessed} messagesProcessed=${result.messagesProcessed}`,
		);
	});

	worker.on("failed", (job, err) => {
		console.error(
			`[sync:process] failed job=${job?.id} attempt=${job?.attemptsMade} error=${err.message}`,
		);
	});

	worker.on("error", (err) => {
		console.error(`[sync:process] worker error: ${err.message}`);
	});

	console.log(
		`[sync:process] worker started concurrency=${config.SYNC_WORKER_CONCURRENCY}`,
	);

	return worker;
}

/**
 * Stop the `sync:process` worker gracefully.
 *
 * Waits for in-flight jobs to complete before closing.
 */
export async function stopSyncProcessWorker(worker: Worker): Promise<void> {
	console.log("[sync:process] stopping worker...");
	await worker.close();
	console.log("[sync:process] worker stopped");
}
