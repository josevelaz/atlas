/**
 * @file sync_fakes.ts — Shared test helpers: fake BullMQ queue and lock store.
 *
 * Provides reusable in-memory fakes for the two external dependencies used by
 * the sync infrastructure:
 *
 *   1. **FakeBullMQQueue** — a mock BullMQ Queue that tracks enqueued jobs and
 *      can be pre-loaded with fake active/waiting jobs for deduplication tests.
 *      Use with `mock.module("bullmq", ...)` before importing any module that
 *      transitively imports bullmq.
 *
 *   2. **FakeLockStore** — an in-memory Verrou-compatible lock store that
 *      exercises the real acquireSyncLock / withSyncLock logic without Redis.
 *      The sync orchestrator already uses LOCK_STORE=memory when the env var
 *      is set; this helper documents that contract and provides a reset helper.
 *
 * Usage (BullMQ mock):
 *
 *   import { createFakeBullMQ } from "../../test/sync_fakes.ts";
 *
 *   const fakeQueue = createFakeBullMQ();
 *
 *   mock.module("bullmq", () => fakeQueue.module);
 *
 *   // In tests:
 *   fakeQueue.reset();
 *   fakeQueue.injectActiveJob("ca-123");
 *   expect(fakeQueue.enqueuedJobs.length).toBe(1);
 *
 * Usage (lock store):
 *
 *   // The sync orchestrator reads LOCK_STORE from config.ts.
 *   // In tests, set process.env.LOCK_STORE = "memory" before importing
 *   // orchestrator.ts (or rely on the default, which is "memory" when
 *   // REDIS_URL is not set).
 *   //
 *   // No additional setup is needed — the in-memory store is self-contained.
 */

// ---------------------------------------------------------------------------
// Fake BullMQ Queue
// ---------------------------------------------------------------------------

export interface FakeActiveJob {
	id: string;
	data: { connectedAccountId: string };
}

export interface FakeEnqueuedJob {
	name: string;
	data: { connectedAccountId: string; triggerSource: string };
	opts: Record<string, unknown>;
}

export interface FakeBullMQ {
	/** The mock module export — pass to `mock.module("bullmq", () => this)`. */
	module: {
		Queue: new (
			name: string,
			opts?: Record<string, unknown>,
		) => FakeBullMQQueueInstance;
		Worker: new (
			name: string,
			processor: unknown,
			opts?: Record<string, unknown>,
		) => FakeBullMQWorkerInstance;
	};

	/** Jobs that have been added via queue.add(). */
	enqueuedJobs: FakeEnqueuedJob[];

	/** Jobs that the mock queue will report as active/waiting. */
	activeJobs: FakeActiveJob[];

	/** When true, queue.add() throws an error. */
	addShouldFail: boolean;

	/** Reset all state between tests. */
	reset(): void;

	/** Inject a fake active job so enqueueSyncTrigger skips the account. */
	injectActiveJob(connectedAccountId: string, jobId?: string): void;
}

interface FakeBullMQQueueInstance {
	getJobs(
		types: string[],
		start?: number,
		end?: number,
	): Promise<FakeActiveJob[]>;
	add(
		name: string,
		data: { connectedAccountId: string; triggerSource: string },
		opts: Record<string, unknown>,
	): Promise<{ id: string }>;
	upsertJobScheduler(
		id: string,
		repeatOpts: Record<string, unknown>,
		template?: Record<string, unknown>,
	): Promise<void>;
	removeJobScheduler(id: string): Promise<void>;
	close(): Promise<void>;
}

interface FakeBullMQWorkerInstance {
	close(): Promise<void>;
	on(event: string, handler: unknown): this;
}

/**
 * Create a self-contained fake BullMQ module.
 *
 * Call this once per test file, then pass `fake.module` to `mock.module`.
 * Call `fake.reset()` in `beforeEach` to clear state between tests.
 */
export function createFakeBullMQ(): FakeBullMQ {
	const state: FakeBullMQ = {
		enqueuedJobs: [],
		activeJobs: [],
		addShouldFail: false,

		reset() {
			state.enqueuedJobs.length = 0;
			state.activeJobs.length = 0;
			state.addShouldFail = false;
		},

		injectActiveJob(connectedAccountId: string, jobId = "mock-job-id") {
			state.activeJobs.push({ id: jobId, data: { connectedAccountId } });
		},

		module: null as unknown as FakeBullMQ["module"],
	};

	// Scheduler upsert/remove call tracking (for idempotency tests).
	const upsertCalls: Array<{
		id: string;
		repeatOpts: Record<string, unknown>;
	}> = [];
	const removeCalls: Array<{ id: string }> = [];

	// Expose scheduler call tracking on the state object for scheduler tests.
	(state as FakeBullMQ & { upsertCalls: typeof upsertCalls }).upsertCalls =
		upsertCalls;
	(state as FakeBullMQ & { removeCalls: typeof removeCalls }).removeCalls =
		removeCalls;

	const originalReset = state.reset.bind(state);
	state.reset = () => {
		originalReset();
		upsertCalls.length = 0;
		removeCalls.length = 0;
	};

	class MockQueue implements FakeBullMQQueueInstance {
		constructor(_name: string, _opts?: Record<string, unknown>) {}

		async getJobs(
			_types: string[],
			_start?: number,
			_end?: number,
		): Promise<FakeActiveJob[]> {
			return [...state.activeJobs];
		}

		async add(
			name: string,
			data: { connectedAccountId: string; triggerSource: string },
			opts: Record<string, unknown>,
		): Promise<{ id: string }> {
			if (state.addShouldFail) {
				throw new Error("Mock queue add failure");
			}
			const job = { name, data, opts };
			state.enqueuedJobs.push(job);
			return { id: `mock-enqueued-${state.enqueuedJobs.length}` };
		}

		async upsertJobScheduler(
			id: string,
			repeatOpts: Record<string, unknown>,
			_template?: Record<string, unknown>,
		): Promise<void> {
			upsertCalls.push({ id, repeatOpts });
		}

		async removeJobScheduler(id: string): Promise<void> {
			removeCalls.push({ id });
		}

		async close(): Promise<void> {}
	}

	class MockWorker implements FakeBullMQWorkerInstance {
		constructor(
			_name: string,
			_processor: unknown,
			_opts?: Record<string, unknown>,
		) {}

		async close(): Promise<void> {}

		on(_event: string, _handler: unknown): this {
			return this;
		}
	}

	state.module = {
		Queue: MockQueue as unknown as FakeBullMQ["module"]["Queue"],
		Worker: MockWorker as unknown as FakeBullMQ["module"]["Worker"],
	};

	return state;
}

// ---------------------------------------------------------------------------
// Lock store helpers
// ---------------------------------------------------------------------------

/**
 * The sync orchestrator uses an in-memory Verrou lock store when
 * `LOCK_STORE=memory` (or when Redis is unavailable). This is the default
 * in test environments.
 *
 * This helper documents the contract and provides a no-op reset function
 * (the in-memory store is per-process and resets naturally between test runs).
 *
 * For tests that need to verify lock behaviour, use `acquireSyncLock` and
 * `withSyncLock` directly from `../services/sync/orchestrator.ts` — they
 * already use the in-memory store in test environments.
 */
export const lockStoreHelpers = {
	/**
	 * Ensure the in-memory lock store is used for tests.
	 * Call this before importing orchestrator.ts if you need to be explicit.
	 */
	useMemoryStore() {
		if (!process.env.LOCK_STORE) {
			process.env.LOCK_STORE = "memory";
		}
	},
} as const;
