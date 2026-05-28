/**
 * @file index.ts — Runtime entrypoint.
 *
 * This is the ONLY file that starts background workers and the reconciliation
 * scheduler.  `server.ts` (the Elysia app) is kept free of any worker/scheduler
 * imports so that importing `app` in tests does not start background processes.
 *
 * ## Startup sequence
 *
 * 1. Register SIGINT / SIGTERM handlers (before anything else).
 * 2. Start the HTTP server.
 * 3. Start sync workers (gated on `SYNC_WORKER_ENABLED`).
 * 4. Register the reconciliation scheduler (gated on `SYNC_SCHEDULER_ENABLED`).
 *
 * ## Graceful shutdown sequence (SIGINT / SIGTERM)
 *
 * 1. Stop sync workers (drain in-flight jobs).
 * 2. Remove the reconciliation scheduler from BullMQ.
 * 3. Disconnect the shared Redis client.
 * 4. Stop the Elysia HTTP server.
 * 5. Flush PostHog analytics.
 * 6. Exit with code 0.
 */

import { config } from "./config.ts";
import {
	registerSyncScheduler,
	removeSyncScheduler,
	startSyncWorkers,
	stopSyncWorkers,
	type SyncWorkerHandles,
} from "./jobs/index.ts";
import { app } from "./server.ts";
import { posthog } from "./services/posthog.ts";
import { disconnectRedis } from "./services/redis.ts";

// ---------------------------------------------------------------------------
// Worker / scheduler handles (populated after startup)
// ---------------------------------------------------------------------------

let syncWorkerHandles: SyncWorkerHandles = {
	triggerWorker: null,
	processWorker: null,
};

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
	if (isShuttingDown) return;
	isShuttingDown = true;

	console.log(`Received ${signal}. Initiating graceful shutdown...`);

	try {
		// 1. Stop sync workers — drain in-flight jobs before closing.
		await stopSyncWorkers(syncWorkerHandles);

		// 2. Remove the reconciliation scheduler from BullMQ.
		await removeSyncScheduler();

		// 3. Disconnect the shared Redis client (after workers + queues are closed).
		await disconnectRedis();

		// 4. Stop the HTTP server.
		await app.stop();

		// 5. Flush PostHog analytics.
		await posthog.shutdown();
	} catch (err) {
		console.error("Error during graceful shutdown:", err);
	}

	process.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, () => shutdown(signal));
}

// ---------------------------------------------------------------------------
// Unhandled error logging
// ---------------------------------------------------------------------------

process.on("uncaughtException", (error) => {
	console.error(error);
});

process.on("unhandledRejection", (error) => {
	console.error(error);
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

// Start the HTTP server first so health checks pass immediately.
app.listen(config.PORT, () =>
	console.log(`🦊 Server started at ${app.server?.url.origin}`),
);

// Start sync workers (no-op when SYNC_WORKER_ENABLED=false).
syncWorkerHandles = startSyncWorkers();

// Register the reconciliation scheduler (no-op when SYNC_SCHEDULER_ENABLED=false).
// Awaited so any BullMQ connection errors surface at startup rather than silently.
await registerSyncScheduler();
