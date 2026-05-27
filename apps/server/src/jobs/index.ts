/**
 * @file jobs/index.ts — Top-level job lifecycle barrel.
 *
 * ## Purpose
 *
 * This module is the single import point for starting and stopping all
 * background job workers and schedulers.  It is imported ONLY by
 * `src/index.ts` (the runtime entrypoint) — never by `src/server.ts` or any
 * route/plugin file.
 *
 * ## Isolation guarantee
 *
 * Importing `src/server.ts` (e.g. in tests) does NOT start any workers or
 * schedulers because `server.ts` never imports this module.  Workers and
 * schedulers are started exclusively from `src/index.ts`.
 *
 * ## Env flags
 *
 * - `SYNC_WORKER_ENABLED=false`    — prevents sync workers from starting
 * - `SYNC_SCHEDULER_ENABLED=false` — prevents the reconciliation scheduler
 *   from registering
 *
 * Both flags default to `true` in production and should be set to `false` in
 * test environments (via `bunfig.toml` or `.env.test`).
 */

export {
	startSyncWorkers,
	stopSyncWorkers,
	type SyncWorkerHandles,
} from "./sync/index.ts";

export {
	registerSyncScheduler,
	removeSyncScheduler,
} from "./sync/scheduler.ts";
