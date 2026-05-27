/**
 * @file orchestrator.ts — Trigger-agnostic enqueue orchestration for sync jobs.
 *
 * ## Responsibilities
 *
 * 1. **Single enqueue entry point** — `enqueueSyncTrigger` is the ONLY function
 *    that enqueues a `sync:trigger` job.  Manual triggers, the reconciliation
 *    scheduler, and future webhooks all call this function.
 *
 * 2. **Active-run deduplication** — Before enqueueing, the orchestrator checks
 *    for:
 *      a. An active `sync_job` row in the DB (status = "running").
 *      b. An active or waiting BullMQ job for the same connected account.
 *    If either exists, the enqueue is skipped and the existing run info is
 *    returned.  No `sync_job` row is created for deduplicated requests.
 *
 * 3. **Execution-time locking** — `acquireSyncLock` acquires a Verrou
 *    distributed lock keyed per connected account.  Workers call this before
 *    any cursor-mutating operation.  Lock collisions skip execution and log
 *    without creating a `sync_job` row.
 *
 * ## Key invariants
 *
 * - `sync_job` rows are created ONLY after the execution-time lock is acquired.
 * - Deduped enqueue attempts return existing run info and do NOT create rows.
 * - `connected_account.status` is NEVER modified by this service.
 * - The lock key is `sync:lock:{connectedAccountId}` — one lock per account.
 * - Lock TTL is controlled by `config.SYNC_LOCK_TTL_MS` (default 30 s).
 */

import { Queue } from "bullmq";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import type * as schema from "../../db/schema/index.ts";
import type {
	SyncTriggerPayload,
	SyncTriggerSource,
} from "../../jobs/sync/types.ts";
import { config } from "../../config.ts";
import { verrou } from "../locks.ts";
import { BULLMQ_PREFIX } from "../jobify.ts";

// ---------------------------------------------------------------------------
// DB type alias
// ---------------------------------------------------------------------------

/** Drizzle database instance type (with full schema). */
export type Db = LibSQLDatabase<typeof schema>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * BullMQ queue name for the sync trigger queue.
 * Must match the queue name used by the sync:trigger job definition.
 */
const SYNC_TRIGGER_QUEUE_NAME = "sync:trigger";

/**
 * Lock key prefix for per-account sync execution locks.
 * Full key: `sync:lock:{connectedAccountId}`
 */
const SYNC_LOCK_KEY_PREFIX = "sync:lock:";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Outcome of an `enqueueSyncTrigger` call. */
export type EnqueueOutcome =
	| {
			/** A new job was successfully enqueued. */
			status: "enqueued";
			/** The BullMQ job ID of the newly enqueued trigger job. */
			jobId: string;
	  }
	| {
			/**
			 * Skipped because a `sync_job` row with status="running" already
			 * exists for this connected account.
			 */
			status: "skipped_active_db_run";
			/** The ID of the existing running `sync_job` row. */
			existingSyncJobId: string;
	  }
	| {
			/**
			 * Skipped because an active or waiting BullMQ job already exists
			 * for this connected account in the trigger queue.
			 */
			status: "skipped_active_queue_job";
			/** The BullMQ job ID of the existing queued/active job. */
			existingBullMqJobId: string;
	  };

/** Options for `enqueueSyncTrigger`. */
export interface EnqueueSyncTriggerOptions {
	/** The connected account to sync. */
	connectedAccountId: string;
	/** Why this sync was triggered. */
	triggerSource: SyncTriggerSource;
}

/** Result of `acquireSyncLock`. */
export type LockAcquireResult =
	| {
			/** Lock was successfully acquired. */
			acquired: true;
			/** Release the lock when the cursor-mutating work is done. */
			release: () => Promise<void>;
	  }
	| {
			/** Lock was NOT acquired — another worker holds it. */
			acquired: false;
	  };

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
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a `sync_job` row with status="running" exists for the given
 * connected account.
 *
 * Returns the ID of the first running row found, or `null` if none.
 */
async function findActiveDbRun(
	connectedAccountId: string,
	db: Db,
): Promise<string | null> {
	const rows = await db.query.syncJob.findMany({
		where: (t, { and, eq: eqFn }) =>
			and(
				eqFn(t.connectedAccountId, connectedAccountId),
				eqFn(t.status, "running"),
			),
		columns: { id: true },
		limit: 1,
	});
	return rows[0]?.id ?? null;
}

/**
 * Check whether an active or waiting BullMQ job exists for the given connected
 * account in the sync:trigger queue.
 *
 * BullMQ deduplication via `deduplication.id` is best-effort — this function
 * provides an additional check by scanning active/waiting jobs for a matching
 * `connectedAccountId` in the job data.
 *
 * Returns the BullMQ job ID of the first matching job, or `null` if none.
 */
async function findActiveQueueJob(
	connectedAccountId: string,
): Promise<string | null> {
	const queue = new Queue(SYNC_TRIGGER_QUEUE_NAME, {
		connection: (await import("../redis.ts")).redis,
		prefix: BULLMQ_PREFIX,
	});

	try {
		// Check active + waiting + delayed states.
		const jobs = await queue.getJobs(
			["active", "waiting", "delayed", "prioritized"],
			0,
			100,
		);

		for (const job of jobs) {
			const data = job.data as SyncTriggerPayload | undefined;
			if (data?.connectedAccountId === connectedAccountId) {
				return job.id ?? null;
			}
		}

		return null;
	} finally {
		await queue.close();
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Enqueue a `sync:trigger` job for the given connected account.
 *
 * This is the SINGLE entry point for all sync triggers — manual, reconciliation,
 * webhook, and system.  It performs deduplication checks before enqueueing:
 *
 * 1. If a `sync_job` row with `status="running"` exists → skip, return info.
 * 2. If an active/waiting BullMQ job exists for this account → skip, return info.
 * 3. Otherwise → enqueue a new `sync:trigger` job with BullMQ deduplication.
 *
 * **No `sync_job` row is created by this function.**  Rows are created only
 * after the execution-time lock is acquired inside the worker.
 *
 * @param opts.connectedAccountId - The account to sync.
 * @param opts.triggerSource - Why the sync was triggered (for observability).
 * @param db - Optional DB instance (defaults to the shared production DB).
 * @returns An `EnqueueOutcome` describing what happened.
 */
export async function enqueueSyncTrigger(
	opts: EnqueueSyncTriggerOptions,
	db?: Db,
): Promise<EnqueueOutcome> {
	const d = getDb(db);
	const { connectedAccountId, triggerSource } = opts;

	// ── Step 1: Check for an active DB run ──────────────────────────────────
	const activeDbRunId = await findActiveDbRun(connectedAccountId, d);
	if (activeDbRunId !== null) {
		return {
			status: "skipped_active_db_run",
			existingSyncJobId: activeDbRunId,
		};
	}

	// ── Step 2: Check for an active/waiting BullMQ job ──────────────────────
	const activeQueueJobId = await findActiveQueueJob(connectedAccountId);
	if (activeQueueJobId !== null) {
		return {
			status: "skipped_active_queue_job",
			existingBullMqJobId: activeQueueJobId,
		};
	}

	// ── Step 3: Enqueue with BullMQ deduplication ───────────────────────────
	const queue = new Queue(SYNC_TRIGGER_QUEUE_NAME, {
		connection: (await import("../redis.ts")).redis,
		prefix: BULLMQ_PREFIX,
	});

	try {
		const payload: SyncTriggerPayload = {
			connectedAccountId,
			triggerSource,
		};

		const job = await queue.add(SYNC_TRIGGER_QUEUE_NAME, payload, {
			// BullMQ deduplication: collapse duplicate enqueues within the TTL window.
			// If a job with this deduplication ID already exists, BullMQ returns the
			// existing job without creating a new one.
			deduplication: {
				id: `sync-trigger:${connectedAccountId}`,
				ttl: config.SYNC_ENQUEUE_DEDUPE_TTL_MS,
			},
			attempts: config.SYNC_MAX_ATTEMPTS,
			backoff: {
				type: "exponential",
				delay: config.SYNC_BACKOFF_DELAY_MS,
			},
			removeOnComplete: { count: 100 },
			removeOnFail: { count: 50 },
		});

		return {
			status: "enqueued",
			jobId: job.id ?? `${connectedAccountId}-${Date.now()}`,
		};
	} finally {
		await queue.close();
	}
}

/**
 * Acquire a distributed lock for cursor-mutating sync execution.
 *
 * Workers MUST call this before creating a `sync_job` row or advancing the
 * cursor.  The lock is keyed per connected account:
 *   `sync:lock:{connectedAccountId}`
 *
 * Lock TTL is `config.SYNC_LOCK_TTL_MS` (default 30 s).  If the lock cannot
 * be acquired (another worker holds it), this function returns
 * `{ acquired: false }` — the caller should skip execution and log.
 *
 * **No `sync_job` row should be created if the lock is not acquired.**
 *
 * @param connectedAccountId - The account to lock.
 * @returns A `LockAcquireResult` with `acquired` flag and optional `release` fn.
 */
export async function acquireSyncLock(
	connectedAccountId: string,
): Promise<LockAcquireResult> {
	const lockKey = `${SYNC_LOCK_KEY_PREFIX}${connectedAccountId}`;

	const lock = verrou.createLock(lockKey, `${config.SYNC_LOCK_TTL_MS}ms`);

	const acquired = await lock.acquireImmediately();

	if (!acquired) {
		return { acquired: false };
	}

	return {
		acquired: true,
		release: async () => {
			try {
				await lock.release();
			} catch {
				// Best-effort release — lock will expire via TTL if release fails.
			}
		},
	};
}

/**
 * Run a cursor-mutating sync operation under a per-account distributed lock.
 *
 * This is a convenience wrapper around `acquireSyncLock` that:
 *   1. Acquires the lock for `connectedAccountId`.
 *   2. If acquired, calls `fn` and releases the lock when done.
 *   3. If NOT acquired, calls `onLockCollision` (or logs) and returns `null`.
 *
 * **`sync_job` rows must be created INSIDE `fn`, after the lock is held.**
 *
 * @param connectedAccountId - The account to lock.
 * @param fn - The cursor-mutating work to perform under the lock.
 * @param onLockCollision - Optional callback when the lock cannot be acquired.
 * @returns The return value of `fn`, or `null` if the lock was not acquired.
 */
export async function withSyncLock<T>(
	connectedAccountId: string,
	fn: () => Promise<T>,
	onLockCollision?: () => void,
): Promise<T | null> {
	const result = await acquireSyncLock(connectedAccountId);

	if (!result.acquired) {
		if (onLockCollision) {
			onLockCollision();
		} else {
			console.warn(
				`[sync:orchestrator] Lock collision for connectedAccountId=${connectedAccountId} — skipping execution`,
			);
		}
		return null;
	}

	try {
		return await fn();
	} finally {
		await result.release();
	}
}
