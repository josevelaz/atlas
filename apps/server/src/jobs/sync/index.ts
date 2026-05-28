/**
 * @file index.ts — Sync job worker registry and lifecycle management.
 *
 * ## Purpose
 *
 * This module is the single entry point for starting and stopping all sync
 * BullMQ workers.  It is imported by the server startup code to register
 * workers when the process boots.
 *
 * ## Worker registration
 *
 * Workers are only registered when `config.SYNC_WORKER_ENABLED` is `true`.
 * Set `SYNC_WORKER_ENABLED=false` in test environments to prevent background
 * workers from interfering with unit/integration tests.
 *
 * ## Graceful shutdown
 *
 * Call `stopSyncWorkers()` during process shutdown (SIGINT/SIGTERM) to wait
 * for in-flight jobs to complete before the process exits.
 *
 * ## DLQ retention
 *
 * Both workers configure `removeOnFail: false` on the jobs they enqueue.
 * This means exhausted (fully-retried) jobs are retained in the BullMQ
 * `failed` set indefinitely for operator inspection and manual replay.
 * They are NOT auto-deleted.
 *
 * ## Usage
 *
 * ```ts
 * import { startSyncWorkers, stopSyncWorkers } from "./jobs/sync/index.ts";
 *
 * // On server start:
 * const workers = startSyncWorkers();
 *
 * // On SIGINT/SIGTERM:
 * await stopSyncWorkers(workers);
 * ```
 */

import type { Worker } from "bullmq";

import { config } from "../../config.ts";
import {
	startSyncProcessWorker,
	stopSyncProcessWorker,
} from "./process-worker.ts";
import {
	startSyncTriggerWorker,
	stopSyncTriggerWorker,
} from "./trigger-worker.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Handle returned by `startSyncWorkers`. Pass to `stopSyncWorkers`. */
export interface SyncWorkerHandles {
	triggerWorker: Worker | null;
	processWorker: Worker | null;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Start all sync BullMQ workers.
 *
 * When `config.SYNC_WORKER_ENABLED` is `false`, both workers are skipped and
 * the returned handles are `null`.  This is the mechanism by which
 * `SYNC_WORKER_ENABLED=false` prevents worker registration — the flag is
 * checked inside each `start*Worker()` function, and this function propagates
 * the `null` handles to the caller.
 *
 * @returns Handles to the started workers (or `null` if disabled).
 */
export function startSyncWorkers(): SyncWorkerHandles {
	if (!config.SYNC_WORKER_ENABLED) {
		console.log(
			"[sync:workers] SYNC_WORKER_ENABLED=false — all sync workers disabled",
		);
		return { triggerWorker: null, processWorker: null };
	}

	console.log("[sync:workers] starting sync workers...");

	const triggerWorker = startSyncTriggerWorker();
	const processWorker = startSyncProcessWorker();

	console.log("[sync:workers] all sync workers started");

	return { triggerWorker, processWorker };
}

/**
 * Stop all sync BullMQ workers gracefully.
 *
 * Waits for in-flight jobs to complete before closing each worker.
 * Safe to call with `null` handles (no-op for disabled workers).
 *
 * @param handles - The handles returned by `startSyncWorkers`.
 */
export async function stopSyncWorkers(
	handles: SyncWorkerHandles,
): Promise<void> {
	console.log("[sync:workers] stopping sync workers...");

	const stops: Promise<void>[] = [];

	if (handles.triggerWorker) {
		stops.push(stopSyncTriggerWorker(handles.triggerWorker));
	}

	if (handles.processWorker) {
		stops.push(stopSyncProcessWorker(handles.processWorker));
	}

	await Promise.all(stops);

	console.log("[sync:workers] all sync workers stopped");
}

// ---------------------------------------------------------------------------
// Re-exports (job definitions for use by orchestrator / scheduler)
// ---------------------------------------------------------------------------

export { syncProcessJob } from "./process-worker.ts";
export { syncTriggerJob } from "./trigger-worker.ts";
