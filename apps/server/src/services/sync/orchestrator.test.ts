/**
 * @file orchestrator.test.ts — Tests for the sync enqueue orchestration service.
 *
 * Proves:
 *   1. enqueueSyncTrigger returns "enqueued" when no active run exists.
 *   2. enqueueSyncTrigger returns "skipped_active_db_run" when a running
 *      sync_job row exists — no new row is created.
 *   3. enqueueSyncTrigger returns "skipped_active_queue_job" when a BullMQ
 *      job is already active/waiting — no new row is created.
 *   4. Concurrent manual + reconciliation triggers for the same account
 *      result in only one enqueue (the second is deduped).
 *   5. acquireSyncLock returns acquired=true on first call.
 *   6. acquireSyncLock returns acquired=false when the lock is already held
 *      (concurrent execution simulation).
 *   7. withSyncLock runs fn under the lock and releases it.
 *   8. withSyncLock calls onLockCollision and returns null when lock is held.
 *   9. Lock is keyed per connected account — two different accounts can hold
 *      their locks simultaneously.
 *  10. sync_job rows are NOT created by enqueueSyncTrigger (deduped or not).
 *  11. Lock release allows a subsequent acquireSyncLock to succeed.
 *
 * Uses:
 *   - A temp file-based SQLite database for DB checks (no external services).
 *   - The in-memory Verrou store (LOCK_STORE=memory) for lock tests.
 *   - A mock BullMQ Queue to avoid requiring a real Redis connection.
 *
 * BullMQ is mocked at the module level so tests run without Redis.
 */

import { unlinkSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "../../db/schema/index.ts";
import { connectedAccount } from "../../db/schema/connected_account.ts";
import { syncJob } from "../../db/schema/sync.ts";

// ---------------------------------------------------------------------------
// BullMQ Queue mock
//
// We mock the BullMQ Queue class so tests run without a real Redis connection.
// The mock tracks enqueued jobs and can be configured to return fake active jobs.
// ---------------------------------------------------------------------------

/** Jobs that the mock queue will report as active/waiting. */
const _mockActiveJobs: Array<{
	id: string;
	data: { connectedAccountId: string };
}> = [];

/** Jobs that have been added via queue.add(). */
const _enqueuedJobs: Array<{
	name: string;
	data: { connectedAccountId: string; triggerSource: string };
	opts: Record<string, unknown>;
}> = [];

let _mockAddShouldFail = false;

/** Reset mock state between tests. */
function resetMockQueue() {
	_mockActiveJobs.length = 0;
	_enqueuedJobs.length = 0;
	_mockAddShouldFail = false;
}

/** Inject a fake active job into the mock queue. */
function injectActiveJob(connectedAccountId: string, jobId = "mock-job-id") {
	_mockActiveJobs.push({ id: jobId, data: { connectedAccountId } });
}

// Mock the bullmq module so Queue uses our fake implementation.
mock.module("bullmq", () => {
	class MockQueue {
		constructor(_name: string, _opts?: Record<string, unknown>) {}

		async getJobs(
			_types: string[],
			_start?: number,
			_end?: number,
		): Promise<typeof _mockActiveJobs> {
			return [..._mockActiveJobs];
		}

		async add(
			name: string,
			data: { connectedAccountId: string; triggerSource: string },
			opts: Record<string, unknown>,
		): Promise<{ id: string }> {
			if (_mockAddShouldFail) {
				throw new Error("Mock queue add failure");
			}
			const job = { name, data, opts };
			_enqueuedJobs.push(job);
			return { id: `mock-enqueued-${_enqueuedJobs.length}` };
		}

		async close(): Promise<void> {}
	}

	return { Queue: MockQueue };
});

// Import orchestrator AFTER mocking bullmq so the mock is in effect.
import {
	acquireSyncLock,
	enqueueSyncTrigger,
	withSyncLock,
} from "./orchestrator.ts";

// ---------------------------------------------------------------------------
// DB setup / teardown
// ---------------------------------------------------------------------------

const dbPath = `/tmp/sync-orchestrator-test-${Date.now()}.db`;
let db: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(async () => {
	const client = createClient({ url: `file:${dbPath}` });
	db = drizzle({ client, schema, casing: "snake_case" });
	const migrationsFolder = new URL("../../../drizzle", import.meta.url)
		.pathname;
	await migrate(db, { migrationsFolder });
});

afterAll(() => {
	try {
		unlinkSync(dbPath);
	} catch {}
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _seedCounter = 0;

async function seedAccount(
	status: "active" | "disconnected" | "reactivating" | "error" = "active",
): Promise<string> {
	const tag = `o${++_seedCounter}`;
	const userId = `user-${tag}`;
	const caId = `ca-${tag}`;

	await db.insert(schema.user).values({
		id: userId,
		name: `Test User ${tag}`,
		email: `test-${tag}@example.com`,
		emailVerified: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	await db.insert(connectedAccount).values({
		id: caId,
		userId,
		providerAccountEmail: `mailbox-${tag}@example.com`,
		provider: "google",
		status,
		createdAt: new Date(),
		updatedAt: new Date(),
		connectedAt: new Date(),
	});

	return caId;
}

/** Insert a running sync_job row directly (simulates an in-progress run). */
async function insertRunningJob(caId: string): Promise<string> {
	const id = `job-${crypto.randomUUID()}`;
	const now = new Date();
	await db.insert(syncJob).values({
		id,
		connectedAccountId: caId,
		jobType: "initial",
		status: "running",
		startedAt: now,
		finishedAt: null,
		threadsProcessed: 0,
		messagesProcessed: 0,
		errorsEncountered: 0,
		errorDetail: null,
		cursorSnapshot: null,
		createdAt: now,
	});
	return id;
}

/** Count sync_job rows for a connected account. */
async function countSyncJobs(caId: string): Promise<number> {
	const rows = await db.query.syncJob.findMany({
		where: (t, { eq }) => eq(t.connectedAccountId, caId),
		columns: { id: true },
	});
	return rows.length;
}

// ---------------------------------------------------------------------------
// Tests: enqueueSyncTrigger
// ---------------------------------------------------------------------------

describe("enqueueSyncTrigger", () => {
	test("returns 'enqueued' when no active run exists", async () => {
		resetMockQueue();
		const caId = await seedAccount();

		const result = await enqueueSyncTrigger(
			{ connectedAccountId: caId, triggerSource: "manual" },
			db,
		);

		expect(result.status).toBe("enqueued");
		if (result.status === "enqueued") {
			expect(typeof result.jobId).toBe("string");
			expect(result.jobId.length).toBeGreaterThan(0);
		}
		expect(_enqueuedJobs.length).toBe(1);
		expect(_enqueuedJobs[0]?.data.connectedAccountId).toBe(caId);
		expect(_enqueuedJobs[0]?.data.triggerSource).toBe("manual");
	});

	test("does NOT create a sync_job row when enqueueing", async () => {
		resetMockQueue();
		const caId = await seedAccount();

		const before = await countSyncJobs(caId);
		expect(before).toBe(0);

		await enqueueSyncTrigger(
			{ connectedAccountId: caId, triggerSource: "reconciliation" },
			db,
		);

		const after = await countSyncJobs(caId);
		expect(after).toBe(0); // No sync_job row created by enqueue
	});

	test("returns 'skipped_active_db_run' when a running sync_job row exists", async () => {
		resetMockQueue();
		const caId = await seedAccount();
		const runningJobId = await insertRunningJob(caId);

		const result = await enqueueSyncTrigger(
			{ connectedAccountId: caId, triggerSource: "manual" },
			db,
		);

		expect(result.status).toBe("skipped_active_db_run");
		if (result.status === "skipped_active_db_run") {
			expect(result.existingSyncJobId).toBe(runningJobId);
		}
		// No new BullMQ job should have been enqueued.
		expect(_enqueuedJobs.length).toBe(0);
	});

	test("does NOT create extra sync_job rows when skipped due to active DB run", async () => {
		resetMockQueue();
		const caId = await seedAccount();
		await insertRunningJob(caId);

		const before = await countSyncJobs(caId);
		expect(before).toBe(1); // The running job we inserted

		await enqueueSyncTrigger(
			{ connectedAccountId: caId, triggerSource: "reconciliation" },
			db,
		);

		const after = await countSyncJobs(caId);
		expect(after).toBe(1); // Still only 1 — no extra row created
	});

	test("returns 'skipped_active_queue_job' when a BullMQ job is already active", async () => {
		resetMockQueue();
		const caId = await seedAccount();
		injectActiveJob(caId, "existing-bullmq-job-id");

		const result = await enqueueSyncTrigger(
			{ connectedAccountId: caId, triggerSource: "manual" },
			db,
		);

		expect(result.status).toBe("skipped_active_queue_job");
		if (result.status === "skipped_active_queue_job") {
			expect(result.existingBullMqJobId).toBe("existing-bullmq-job-id");
		}
		// No new BullMQ job should have been enqueued.
		expect(_enqueuedJobs.length).toBe(0);
	});

	test("does NOT create sync_job rows when skipped due to active queue job", async () => {
		resetMockQueue();
		const caId = await seedAccount();
		injectActiveJob(caId);

		const before = await countSyncJobs(caId);
		expect(before).toBe(0);

		await enqueueSyncTrigger(
			{ connectedAccountId: caId, triggerSource: "webhook" },
			db,
		);

		const after = await countSyncJobs(caId);
		expect(after).toBe(0); // No sync_job row created
	});

	test("concurrent manual + reconciliation triggers: only one enqueue succeeds", async () => {
		resetMockQueue();
		const caId = await seedAccount();

		// Simulate concurrent triggers by firing both before either resolves.
		// The first one to check the queue will find it empty and enqueue.
		// The second will find the first job in the active list (injected after
		// the first enqueue) — but since we're testing the DB-level dedup here,
		// we simulate by having the first trigger insert a running job.
		//
		// Real concurrency is tested via the lock (see acquireSyncLock tests).
		// Here we test the sequential dedup path.

		// First trigger: no active run → enqueues.
		const result1 = await enqueueSyncTrigger(
			{ connectedAccountId: caId, triggerSource: "manual" },
			db,
		);
		expect(result1.status).toBe("enqueued");

		// Simulate the job becoming active in the queue.
		injectActiveJob(caId, "enqueued-job-id");

		// Second trigger (reconciliation): finds active queue job → skips.
		const result2 = await enqueueSyncTrigger(
			{ connectedAccountId: caId, triggerSource: "reconciliation" },
			db,
		);
		expect(result2.status).toBe("skipped_active_queue_job");

		// Only one job was actually enqueued.
		expect(_enqueuedJobs.length).toBe(1);
		// No sync_job rows were created by either trigger.
		expect(await countSyncJobs(caId)).toBe(0);
	});

	test("different accounts can be enqueued independently", async () => {
		resetMockQueue();
		const caId1 = await seedAccount();
		const caId2 = await seedAccount();

		const result1 = await enqueueSyncTrigger(
			{ connectedAccountId: caId1, triggerSource: "manual" },
			db,
		);
		const result2 = await enqueueSyncTrigger(
			{ connectedAccountId: caId2, triggerSource: "reconciliation" },
			db,
		);

		expect(result1.status).toBe("enqueued");
		expect(result2.status).toBe("enqueued");
		expect(_enqueuedJobs.length).toBe(2);
	});

	test("active DB run for account A does not block account B", async () => {
		resetMockQueue();
		const caId1 = await seedAccount();
		const caId2 = await seedAccount();

		// Account A has a running job.
		await insertRunningJob(caId1);

		// Account A is skipped.
		const result1 = await enqueueSyncTrigger(
			{ connectedAccountId: caId1, triggerSource: "manual" },
			db,
		);
		expect(result1.status).toBe("skipped_active_db_run");

		// Account B is enqueued normally.
		const result2 = await enqueueSyncTrigger(
			{ connectedAccountId: caId2, triggerSource: "reconciliation" },
			db,
		);
		expect(result2.status).toBe("enqueued");
		expect(_enqueuedJobs.length).toBe(1);
		expect(_enqueuedJobs[0]?.data.connectedAccountId).toBe(caId2);
	});
});

// ---------------------------------------------------------------------------
// Tests: acquireSyncLock
// ---------------------------------------------------------------------------

describe("acquireSyncLock", () => {
	test("returns acquired=true on first call for an account", async () => {
		const caId = `lock-test-${crypto.randomUUID()}`;

		const result = await acquireSyncLock(caId);

		expect(result.acquired).toBe(true);
		if (result.acquired) {
			expect(typeof result.release).toBe("function");
			await result.release();
		}
	});

	test("returns acquired=false when lock is already held (concurrent execution)", async () => {
		const caId = `lock-concurrent-${crypto.randomUUID()}`;

		// First worker acquires the lock.
		const lock1 = await acquireSyncLock(caId);
		expect(lock1.acquired).toBe(true);

		// Second worker (concurrent) cannot acquire the same lock.
		const lock2 = await acquireSyncLock(caId);
		expect(lock2.acquired).toBe(false);

		// Release the first lock.
		if (lock1.acquired) {
			await lock1.release();
		}
	});

	test("lock release allows subsequent acquisition", async () => {
		const caId = `lock-release-${crypto.randomUUID()}`;

		// Acquire and release.
		const lock1 = await acquireSyncLock(caId);
		expect(lock1.acquired).toBe(true);
		if (lock1.acquired) {
			await lock1.release();
		}

		// After release, a new acquisition should succeed.
		const lock2 = await acquireSyncLock(caId);
		expect(lock2.acquired).toBe(true);
		if (lock2.acquired) {
			await lock2.release();
		}
	});

	test("locks are keyed per account — two accounts can hold locks simultaneously", async () => {
		const caId1 = `lock-account-a-${crypto.randomUUID()}`;
		const caId2 = `lock-account-b-${crypto.randomUUID()}`;

		// Both accounts acquire their own locks.
		const lock1 = await acquireSyncLock(caId1);
		const lock2 = await acquireSyncLock(caId2);

		expect(lock1.acquired).toBe(true);
		expect(lock2.acquired).toBe(true);

		// Cleanup.
		if (lock1.acquired) await lock1.release();
		if (lock2.acquired) await lock2.release();
	});

	test("concurrent triggers for same account: only one acquires the lock", async () => {
		const caId = `lock-race-${crypto.randomUUID()}`;

		// Simulate two workers racing to acquire the lock.
		const [result1, result2] = await Promise.all([
			acquireSyncLock(caId),
			acquireSyncLock(caId),
		]);

		// Exactly one should succeed.
		const acquiredCount = [result1, result2].filter((r) => r.acquired).length;
		expect(acquiredCount).toBe(1);

		// Cleanup.
		if (result1.acquired) await result1.release();
		if (result2.acquired) await result2.release();
	});
});

// ---------------------------------------------------------------------------
// Tests: withSyncLock
// ---------------------------------------------------------------------------

describe("withSyncLock", () => {
	test("runs fn under the lock and returns its result", async () => {
		const caId = `with-lock-${crypto.randomUUID()}`;
		let fnCalled = false;

		const result = await withSyncLock(caId, async () => {
			fnCalled = true;
			return "done";
		});

		expect(fnCalled).toBe(true);
		expect(result).toBe("done");
	});

	test("releases the lock after fn completes", async () => {
		const caId = `with-lock-release-${crypto.randomUUID()}`;

		await withSyncLock(caId, async () => "first");

		// After withSyncLock completes, the lock should be released.
		// A subsequent acquisition should succeed.
		const lock = await acquireSyncLock(caId);
		expect(lock.acquired).toBe(true);
		if (lock.acquired) await lock.release();
	});

	test("calls onLockCollision and returns null when lock is held", async () => {
		const caId = `with-lock-collision-${crypto.randomUUID()}`;
		let collisionCalled = false;

		// Hold the lock externally.
		const externalLock = await acquireSyncLock(caId);
		expect(externalLock.acquired).toBe(true);

		// withSyncLock should detect the collision.
		const result = await withSyncLock(
			caId,
			async () => "should-not-run",
			() => {
				collisionCalled = true;
			},
		);

		expect(result).toBeNull();
		expect(collisionCalled).toBe(true);

		// Release the external lock.
		if (externalLock.acquired) await externalLock.release();
	});

	test("releases lock even if fn throws", async () => {
		const caId = `with-lock-throw-${crypto.randomUUID()}`;

		await expect(
			withSyncLock(caId, async () => {
				throw new Error("fn error");
			}),
		).rejects.toThrow("fn error");

		// Lock should be released despite the error.
		const lock = await acquireSyncLock(caId);
		expect(lock.acquired).toBe(true);
		if (lock.acquired) await lock.release();
	});

	test("sync_job rows are only created inside fn (after lock is held)", async () => {
		resetMockQueue();
		const caId = await seedAccount();

		// Simulate the correct pattern: create sync_job INSIDE withSyncLock.
		let syncJobIdCreated: string | null = null;

		await withSyncLock(caId, async () => {
			// This is where a worker would call createSyncJob.
			const id = `job-inside-lock-${crypto.randomUUID()}`;
			const now = new Date();
			await db.insert(syncJob).values({
				id,
				connectedAccountId: caId,
				jobType: "initial",
				status: "running",
				startedAt: now,
				finishedAt: null,
				threadsProcessed: 0,
				messagesProcessed: 0,
				errorsEncountered: 0,
				errorDetail: null,
				cursorSnapshot: null,
				createdAt: now,
			});
			syncJobIdCreated = id;
		});

		expect(syncJobIdCreated).not.toBeNull();
		const count = await countSyncJobs(caId);
		expect(count).toBe(1);
	});

	test("lock collision prevents sync_job row creation", async () => {
		resetMockQueue();
		const caId = await seedAccount();

		// Hold the lock externally (simulates another worker running).
		const externalLock = await acquireSyncLock(caId);
		expect(externalLock.acquired).toBe(true);

		// A second worker tries to run — should be blocked.
		const result = await withSyncLock(
			caId,
			async () => {
				// This should NOT execute.
				await db.insert(syncJob).values({
					id: `should-not-exist-${crypto.randomUUID()}`,
					connectedAccountId: caId,
					jobType: "initial",
					status: "running",
					startedAt: new Date(),
					finishedAt: null,
					threadsProcessed: 0,
					messagesProcessed: 0,
					errorsEncountered: 0,
					errorDetail: null,
					cursorSnapshot: null,
					createdAt: new Date(),
				});
				return "ran";
			},
			() => {
				// Lock collision handler — no sync_job row created here.
			},
		);

		expect(result).toBeNull();
		// No sync_job row should have been created.
		expect(await countSyncJobs(caId)).toBe(0);

		if (externalLock.acquired) await externalLock.release();
	});
});
