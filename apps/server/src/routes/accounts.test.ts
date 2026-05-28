/**
 * @file accounts.test.ts — Route tests for POST /api/accounts/:id/sync
 *   and GET /api/accounts/:id/sync/status.
 *
 * Covers:
 *   1. Unauthenticated access → 401
 *   2. Account not found → 404
 *   3. Account owned by another user → 403
 *   4. Inactive account (disconnected) → 422
 *   5. Inactive account (reactivating) → 422
 *   6. Inactive account (error) → 422
 *   7. First enqueue (no active run) → 202 + status "enqueued"
 *   8. Duplicate manual trigger (active DB run) → 200 + status "already_running"
 *   9. Duplicate manual trigger (active queue job) → 200 + status "already_queued"
 *  10. GET status: missing sync_state → syncState: null
 *  11. GET status: synthesized status response shape (no jobs)
 *  12. GET status: synthesized status response shape (active run)
 *  13. GET status: synthesized status response shape (completed run)
 *  14. GET status: synthesized status response shape (failed run)
 *  15. GET status: unauthenticated → 401
 *  16. GET status: wrong owner → 403
 *
 * Uses:
 *   - Temp file-based SQLite for DB (no external services).
 *   - BullMQ mocked at module level (no Redis required).
 *   - Elysia test client (app.handle) for HTTP-level testing.
 */

import { unlinkSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { Elysia, t } from "elysia";

import * as schema from "../db/schema/index.ts";
import { connectedAccount } from "../db/schema/connected_account.ts";
import { syncJob, syncState } from "../db/schema/sync.ts";

// ---------------------------------------------------------------------------
// BullMQ mock — must be declared before any import that transitively uses bullmq
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

function resetMockQueue() {
	_mockActiveJobs.length = 0;
	_enqueuedJobs.length = 0;
}

function injectActiveJob(connectedAccountId: string, jobId = "mock-job-id") {
	_mockActiveJobs.push({ id: jobId, data: { connectedAccountId } });
}

// Mock bullmq — export both Queue and Worker so all transitive imports work.
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
			const job = { name, data, opts };
			_enqueuedJobs.push(job);
			return { id: `mock-enqueued-${_enqueuedJobs.length}` };
		}

		async close(): Promise<void> {}
	}

	class MockWorker {
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

	return { Queue: MockQueue, Worker: MockWorker };
});

// ---------------------------------------------------------------------------
// Import service modules AFTER mocking bullmq
// ---------------------------------------------------------------------------

import { enqueueSyncTrigger } from "../services/sync/orchestrator.ts";
import { getSyncStatus } from "../services/sync/status.ts";

// ---------------------------------------------------------------------------
// DB setup / teardown
// ---------------------------------------------------------------------------

const dbPath = `/tmp/accounts-route-test-${Date.now()}.db`;
let db: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(async () => {
	const client = createClient({ url: `file:${dbPath}` });
	db = drizzle({ client, schema, casing: "snake_case" });
	const migrationsFolder = new URL("../../drizzle", import.meta.url).pathname;
	await migrate(db, { migrationsFolder });
});

afterAll(() => {
	try {
		unlinkSync(dbPath);
	} catch {}
});

// ---------------------------------------------------------------------------
// Test app factory
//
// Builds a minimal Elysia app that mirrors the production routes but uses
// the test DB and a fake auth session. Services are called directly with
// the test DB injected — no module-level singleton is used.
// ---------------------------------------------------------------------------

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

function buildTestApp(opts: {
	db: TestDb;
	authUser: { id: string; email: string } | null;
}) {
	const { authUser } = opts;
	const testDb = opts.db;

	return (
		new Elysia()
			// Inject fake auth context
			.derive({ as: "global" }, () => ({
				authSession: authUser ? { id: "session-1", userId: authUser.id } : null,
				authUser: authUser ?? null,
			}))
			// Auth guard
			.onBeforeHandle({ as: "global" }, ({ authSession, set }) => {
				if (!authSession) {
					set.status = 401;
					return { error: "Unauthorized" };
				}
			}) // POST /api/accounts/:id/sync
			.post(
				"/api/accounts/:id/sync",
				async ({ params, set }) => {
					const { id } = params;

					const account = await testDb.query.connectedAccount.findFirst({
						where: eq(connectedAccount.id, id),
						columns: { id: true, userId: true, status: true },
					});

					if (!account) {
						set.status = 404;
						return { error: "Account not found" };
					}

					if (account.userId !== authUser!.id) {
						set.status = 403;
						return { error: "Forbidden" };
					}

					if (account.status !== "active") {
						set.status = 422;
						return {
							error: "Account is not active",
							status: account.status,
						};
					}

					const outcome = await enqueueSyncTrigger(
						{ connectedAccountId: id, triggerSource: "manual" },
						testDb,
					);

					switch (outcome.status) {
						case "enqueued":
							set.status = 202;
							return { status: "enqueued", jobId: outcome.jobId };
						case "skipped_active_db_run":
							set.status = 200;
							return {
								status: "already_running",
								existingSyncJobId: outcome.existingSyncJobId,
							};
						case "skipped_active_queue_job":
							set.status = 200;
							return {
								status: "already_queued",
								existingBullMqJobId: outcome.existingBullMqJobId,
							};
					}
				},
				{ params: t.Object({ id: t.String() }) },
			)
			// GET /api/accounts/:id/sync/status
			.get(
				"/api/accounts/:id/sync/status",
				async ({ params, set }) => {
					const { id } = params;

					const account = await testDb.query.connectedAccount.findFirst({
						where: eq(connectedAccount.id, id),
						columns: { id: true, userId: true, status: true },
					});

					if (!account) {
						set.status = 404;
						return { error: "Account not found" };
					}

					if (account.userId !== authUser!.id) {
						set.status = 403;
						return { error: "Forbidden" };
					}

					const syncStatusResult = await getSyncStatus(id, testDb);

					return {
						accountId: id,
						accountStatus: account.status,
						syncState: syncStatusResult
							? {
									syncMode: syncStatusResult.syncMode,
									health: syncStatusResult.health,
									syncCursor: syncStatusResult.syncCursor,
									lastSyncedAt: syncStatusResult.lastSyncedAt,
									lastAttemptedAt: syncStatusResult.lastAttemptedAt,
								}
							: null,
						activeRun:
							syncStatusResult?.lastJob?.status === "running"
								? syncStatusResult.lastJob
								: null,
						latestCompletedRun:
							syncStatusResult?.lastJob &&
							syncStatusResult.lastJob.status !== "running"
								? syncStatusResult.lastJob
								: null,
					};
				},
				{ params: t.Object({ id: t.String() }) },
			)
	);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _seedCounter = 0;

async function seedUser(): Promise<string> {
	const tag = `u${++_seedCounter}`;
	const userId = `user-${tag}`;
	await db.insert(schema.user).values({
		id: userId,
		name: `Test User ${tag}`,
		email: `test-${tag}@example.com`,
		emailVerified: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
	return userId;
}

async function seedAccount(
	userId: string,
	status: "active" | "disconnected" | "reactivating" | "error" = "active",
): Promise<string> {
	const tag = `ca${++_seedCounter}`;
	const caId = `ca-${tag}`;
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

async function seedSyncState(caId: string): Promise<void> {
	await db.insert(syncState).values({
		id: `ss-${caId}`,
		connectedAccountId: caId,
		syncMode: "initial",
		health: "ok",
		syncCursor: null,
		lastSyncedAt: null,
		lastAttemptedAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
}

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

async function insertCompletedJob(
	caId: string,
	status: "success" | "failed" = "success",
): Promise<string> {
	const id = `job-${crypto.randomUUID()}`;
	const now = new Date();
	await db.insert(syncJob).values({
		id,
		connectedAccountId: caId,
		jobType: "initial",
		status,
		startedAt: now,
		finishedAt: now,
		threadsProcessed: 10,
		messagesProcessed: 50,
		errorsEncountered: 0,
		errorDetail: null,
		cursorSnapshot: null,
		createdAt: now,
	});
	return id;
}

async function req(
	app: ReturnType<typeof buildTestApp>,
	method: string,
	path: string,
): Promise<{ status: number; body: unknown }> {
	const res = await app.handle(
		new Request(`http://localhost${path}`, { method }),
	);
	const body = await res.json().catch(() => null);
	return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Tests: POST /api/accounts/:id/sync
// ---------------------------------------------------------------------------

describe("POST /api/accounts/:id/sync", () => {
	test("unauthenticated request → 401", async () => {
		const app = buildTestApp({ db, authUser: null });
		const { status, body } = await req(
			app,
			"POST",
			"/api/accounts/any-id/sync",
		);
		expect(status).toBe(401);
		expect((body as { error: string }).error).toBe("Unauthorized");
	});

	test("account not found → 404", async () => {
		const userId = await seedUser();
		const app = buildTestApp({
			db,
			authUser: { id: userId, email: "x@x.com" },
		});
		const { status, body } = await req(
			app,
			"POST",
			"/api/accounts/nonexistent-id/sync",
		);
		expect(status).toBe(404);
		expect((body as { error: string }).error).toBe("Account not found");
	});

	test("account owned by another user → 403", async () => {
		const owner = await seedUser();
		const requester = await seedUser();
		const caId = await seedAccount(owner);

		const app = buildTestApp({
			db,
			authUser: { id: requester, email: "r@x.com" },
		});
		const { status, body } = await req(
			app,
			"POST",
			`/api/accounts/${caId}/sync`,
		);
		expect(status).toBe(403);
		expect((body as { error: string }).error).toBe("Forbidden");
	});

	test("inactive account (disconnected) → 422", async () => {
		const userId = await seedUser();
		const caId = await seedAccount(userId, "disconnected");

		const app = buildTestApp({
			db,
			authUser: { id: userId, email: "u@x.com" },
		});
		const { status, body } = await req(
			app,
			"POST",
			`/api/accounts/${caId}/sync`,
		);
		expect(status).toBe(422);
		expect((body as { error: string }).error).toBe("Account is not active");
		expect((body as { status: string }).status).toBe("disconnected");
	});

	test("inactive account (reactivating) → 422", async () => {
		const userId = await seedUser();
		const caId = await seedAccount(userId, "reactivating");

		const app = buildTestApp({
			db,
			authUser: { id: userId, email: "u@x.com" },
		});
		const { status, body } = await req(
			app,
			"POST",
			`/api/accounts/${caId}/sync`,
		);
		expect(status).toBe(422);
		expect((body as { error: string }).error).toBe("Account is not active");
	});

	test("inactive account (error) → 422", async () => {
		const userId = await seedUser();
		const caId = await seedAccount(userId, "error");

		const app = buildTestApp({
			db,
			authUser: { id: userId, email: "u@x.com" },
		});
		const { status, body } = await req(
			app,
			"POST",
			`/api/accounts/${caId}/sync`,
		);
		expect(status).toBe(422);
		expect((body as { error: string }).error).toBe("Account is not active");
	});

	test("first enqueue (no active run) → 202 + status 'enqueued'", async () => {
		resetMockQueue();
		const userId = await seedUser();
		const caId = await seedAccount(userId, "active");

		const app = buildTestApp({
			db,
			authUser: { id: userId, email: "u@x.com" },
		});
		const { status, body } = await req(
			app,
			"POST",
			`/api/accounts/${caId}/sync`,
		);
		expect(status).toBe(202);
		expect((body as { status: string }).status).toBe("enqueued");
		expect(typeof (body as { jobId: string }).jobId).toBe("string");
		expect(_enqueuedJobs.length).toBe(1);
		expect(_enqueuedJobs[0]?.data.connectedAccountId).toBe(caId);
		expect(_enqueuedJobs[0]?.data.triggerSource).toBe("manual");
	});

	test("duplicate manual trigger (active DB run) → 200 + status 'already_running'", async () => {
		resetMockQueue();
		const userId = await seedUser();
		const caId = await seedAccount(userId, "active");
		const runningJobId = await insertRunningJob(caId);

		const app = buildTestApp({
			db,
			authUser: { id: userId, email: "u@x.com" },
		});
		const { status, body } = await req(
			app,
			"POST",
			`/api/accounts/${caId}/sync`,
		);
		expect(status).toBe(200);
		expect((body as { status: string }).status).toBe("already_running");
		expect((body as { existingSyncJobId: string }).existingSyncJobId).toBe(
			runningJobId,
		);
		// No new BullMQ job should have been enqueued.
		expect(_enqueuedJobs.length).toBe(0);
	});

	test("duplicate manual trigger (active queue job) → 200 + status 'already_queued'", async () => {
		resetMockQueue();
		const userId = await seedUser();
		const caId = await seedAccount(userId, "active");
		injectActiveJob(caId, "existing-bullmq-job");

		const app = buildTestApp({
			db,
			authUser: { id: userId, email: "u@x.com" },
		});
		const { status, body } = await req(
			app,
			"POST",
			`/api/accounts/${caId}/sync`,
		);
		expect(status).toBe(200);
		expect((body as { status: string }).status).toBe("already_queued");
		expect((body as { existingBullMqJobId: string }).existingBullMqJobId).toBe(
			"existing-bullmq-job",
		);
		// No new BullMQ job should have been enqueued.
		expect(_enqueuedJobs.length).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Tests: GET /api/accounts/:id/sync/status
// ---------------------------------------------------------------------------

describe("GET /api/accounts/:id/sync/status", () => {
	test("unauthenticated request → 401", async () => {
		const app = buildTestApp({ db, authUser: null });
		const { status, body } = await req(
			app,
			"GET",
			"/api/accounts/any-id/sync/status",
		);
		expect(status).toBe(401);
		expect((body as { error: string }).error).toBe("Unauthorized");
	});

	test("account owned by another user → 403", async () => {
		const owner = await seedUser();
		const requester = await seedUser();
		const caId = await seedAccount(owner);

		const app = buildTestApp({
			db,
			authUser: { id: requester, email: "r@x.com" },
		});
		const { status, body } = await req(
			app,
			"GET",
			`/api/accounts/${caId}/sync/status`,
		);
		expect(status).toBe(403);
		expect((body as { error: string }).error).toBe("Forbidden");
	});

	test("missing sync_state → syncState: null", async () => {
		const userId = await seedUser();
		const caId = await seedAccount(userId, "active");
		// No sync_state row seeded.

		const app = buildTestApp({
			db,
			authUser: { id: userId, email: "u@x.com" },
		});
		const { status, body } = await req(
			app,
			"GET",
			`/api/accounts/${caId}/sync/status`,
		);
		expect(status).toBe(200);

		const b = body as {
			accountId: string;
			accountStatus: string;
			syncState: null;
			activeRun: null;
			latestCompletedRun: null;
		};
		expect(b.accountId).toBe(caId);
		expect(b.accountStatus).toBe("active");
		expect(b.syncState).toBeNull();
		expect(b.activeRun).toBeNull();
		expect(b.latestCompletedRun).toBeNull();
	});

	test("synthesized status response shape — no jobs yet", async () => {
		const userId = await seedUser();
		const caId = await seedAccount(userId, "active");
		await seedSyncState(caId);

		const app = buildTestApp({
			db,
			authUser: { id: userId, email: "u@x.com" },
		});
		const { status, body } = await req(
			app,
			"GET",
			`/api/accounts/${caId}/sync/status`,
		);
		expect(status).toBe(200);

		const b = body as {
			accountId: string;
			accountStatus: string;
			syncState: {
				syncMode: string;
				health: string;
				syncCursor: null;
				lastSyncedAt: null;
				lastAttemptedAt: null;
			};
			activeRun: null;
			latestCompletedRun: null;
		};
		expect(b.accountId).toBe(caId);
		expect(b.accountStatus).toBe("active");
		expect(b.syncState).not.toBeNull();
		expect(b.syncState.syncMode).toBe("initial");
		expect(b.syncState.health).toBe("ok");
		expect(b.syncState.syncCursor).toBeNull();
		expect(b.activeRun).toBeNull();
		expect(b.latestCompletedRun).toBeNull();
	});

	test("synthesized status response shape — with active run", async () => {
		const userId = await seedUser();
		const caId = await seedAccount(userId, "active");
		await seedSyncState(caId);
		const runningJobId = await insertRunningJob(caId);

		const app = buildTestApp({
			db,
			authUser: { id: userId, email: "u@x.com" },
		});
		const { status, body } = await req(
			app,
			"GET",
			`/api/accounts/${caId}/sync/status`,
		);
		expect(status).toBe(200);

		const b = body as {
			accountId: string;
			accountStatus: string;
			syncState: { syncMode: string; health: string };
			activeRun: { id: string; status: string } | null;
			latestCompletedRun: null;
		};
		expect(b.activeRun).not.toBeNull();
		expect(b.activeRun!.id).toBe(runningJobId);
		expect(b.activeRun!.status).toBe("running");
		expect(b.latestCompletedRun).toBeNull();
	});

	test("synthesized status response shape — with completed run", async () => {
		const userId = await seedUser();
		const caId = await seedAccount(userId, "active");
		await seedSyncState(caId);
		const completedJobId = await insertCompletedJob(caId, "success");

		const app = buildTestApp({
			db,
			authUser: { id: userId, email: "u@x.com" },
		});
		const { status, body } = await req(
			app,
			"GET",
			`/api/accounts/${caId}/sync/status`,
		);
		expect(status).toBe(200);

		const b = body as {
			activeRun: null;
			latestCompletedRun: { id: string; status: string } | null;
		};
		expect(b.activeRun).toBeNull();
		expect(b.latestCompletedRun).not.toBeNull();
		expect(b.latestCompletedRun!.id).toBe(completedJobId);
		expect(b.latestCompletedRun!.status).toBe("success");
	});

	test("synthesized status response shape — with failed run", async () => {
		const userId = await seedUser();
		const caId = await seedAccount(userId, "active");
		await seedSyncState(caId);
		const failedJobId = await insertCompletedJob(caId, "failed");

		const app = buildTestApp({
			db,
			authUser: { id: userId, email: "u@x.com" },
		});
		const { status, body } = await req(
			app,
			"GET",
			`/api/accounts/${caId}/sync/status`,
		);
		expect(status).toBe(200);

		const b = body as {
			latestCompletedRun: { id: string; status: string } | null;
		};
		expect(b.latestCompletedRun).not.toBeNull();
		expect(b.latestCompletedRun!.id).toBe(failedJobId);
		expect(b.latestCompletedRun!.status).toBe("failed");
	});
});
