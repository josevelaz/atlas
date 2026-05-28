/**
 * @file runs.test.ts — Bun test-runner tests for the sync run persistence service.
 *
 * Proves:
 *   1. createSyncJob inserts a row with status = "running".
 *   2. createSyncJob stores cursorSnapshot correctly.
 *   3. markRunComplete sets status = "success" and finishedAt.
 *   4. markRunComplete sets status = "partial_success" with errorDetail.
 *   5. markRunComplete sets status = "failed" with errorDetail.
 *   6. markRunComplete does NOT touch connected_account.status.
 *   7. listSyncJobs returns rows ordered by startedAt desc.
 *   8. getSyncJob returns null for unknown ID.
 *
 * Uses a temp file-based SQLite database — no external services required.
 */

import { unlinkSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "../../db/schema/index.ts";
import { connectedAccount } from "../../db/schema/connected_account.ts";
import {
	createSyncJob,
	getSyncJob,
	listSyncJobs,
	markRunComplete,
} from "./runs.ts";

// ---------------------------------------------------------------------------
// DB setup / teardown
// ---------------------------------------------------------------------------

const dbPath = `/tmp/sync-runs-test-${Date.now()}.db`;
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

async function seedAccount(): Promise<string> {
	const tag = `r${++_seedCounter}`;
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
		status: "active",
		createdAt: new Date(),
		updatedAt: new Date(),
		connectedAt: new Date(),
	});

	return caId;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createSyncJob", () => {
	test("inserts row with status=running", async () => {
		const caId = await seedAccount();

		const job = await createSyncJob(
			{ connectedAccountId: caId, jobType: "initial" },
			db,
		);

		expect(job.status).toBe("running");
		expect(job.jobType).toBe("initial");
		expect(job.connectedAccountId).toBe(caId);
		expect(job.threadsProcessed).toBe(0);
		expect(job.messagesProcessed).toBe(0);
		expect(job.errorsEncountered).toBe(0);
		expect(job.finishedAt).toBeNull();
		expect(typeof job.id).toBe("string");
		expect(job.id.length).toBeGreaterThan(0);
	});

	test("stores cursorSnapshot", async () => {
		const caId = await seedAccount();

		const job = await createSyncJob(
			{
				connectedAccountId: caId,
				jobType: "incremental",
				cursorSnapshot: "cursor-snap-abc",
			},
			db,
		);

		expect(job.cursorSnapshot).toBe("cursor-snap-abc");
		expect(job.jobType).toBe("incremental");
	});
});

describe("markRunComplete", () => {
	test("sets status=success and finishedAt", async () => {
		const caId = await seedAccount();
		const job = await createSyncJob(
			{ connectedAccountId: caId, jobType: "initial" },
			db,
		);

		await markRunComplete(
			{
				syncJobId: job.id,
				status: "success",
				threadsProcessed: 10,
				messagesProcessed: 42,
				errorsEncountered: 0,
			},
			db,
		);

		const updated = await getSyncJob(job.id, db);
		expect(updated?.status).toBe("success");
		expect(updated?.threadsProcessed).toBe(10);
		expect(updated?.messagesProcessed).toBe(42);
		expect(updated?.errorsEncountered).toBe(0);
		expect(updated?.finishedAt).not.toBeNull();
		expect(updated?.errorDetail).toBeNull();
	});

	test("sets status=partial_success with errorDetail", async () => {
		const caId = await seedAccount();
		const job = await createSyncJob(
			{ connectedAccountId: caId, jobType: "incremental" },
			db,
		);

		await markRunComplete(
			{
				syncJobId: job.id,
				status: "partial_success",
				threadsProcessed: 5,
				messagesProcessed: 20,
				errorsEncountered: 3,
				errorDetail: '{"skipped":3}',
			},
			db,
		);

		const updated = await getSyncJob(job.id, db);
		expect(updated?.status).toBe("partial_success");
		expect(updated?.errorsEncountered).toBe(3);
		expect(updated?.errorDetail).toBe('{"skipped":3}');
		expect(updated?.finishedAt).not.toBeNull();
	});

	test("sets status=failed with errorDetail", async () => {
		const caId = await seedAccount();
		const job = await createSyncJob(
			{ connectedAccountId: caId, jobType: "initial" },
			db,
		);

		await markRunComplete(
			{
				syncJobId: job.id,
				status: "failed",
				threadsProcessed: 0,
				messagesProcessed: 0,
				errorsEncountered: 1,
				errorDetail: "Provider returned 401",
			},
			db,
		);

		const updated = await getSyncJob(job.id, db);
		expect(updated?.status).toBe("failed");
		expect(updated?.errorDetail).toBe("Provider returned 401");
		expect(updated?.finishedAt).not.toBeNull();
	});

	test("does NOT touch connected_account.status", async () => {
		const caId = await seedAccount();

		const caBefore = await db.query.connectedAccount.findFirst({
			where: (t, { eq }) => eq(t.id, caId),
		});
		expect(caBefore?.status).toBe("active");

		const job = await createSyncJob(
			{ connectedAccountId: caId, jobType: "initial" },
			db,
		);

		await markRunComplete(
			{
				syncJobId: job.id,
				status: "failed",
				threadsProcessed: 0,
				messagesProcessed: 0,
				errorsEncountered: 1,
				errorDetail: "Fatal error",
			},
			db,
		);

		const caAfter = await db.query.connectedAccount.findFirst({
			where: (t, { eq }) => eq(t.id, caId),
		});
		expect(caAfter?.status).toBe("active");
	});
});

describe("listSyncJobs", () => {
	test("returns rows ordered by startedAt desc (most recent first)", async () => {
		const caId = await seedAccount();

		const job1 = await createSyncJob(
			{ connectedAccountId: caId, jobType: "initial" },
			db,
		);
		await new Promise((r) => setTimeout(r, 5));
		const job2 = await createSyncJob(
			{ connectedAccountId: caId, jobType: "incremental" },
			db,
		);
		await new Promise((r) => setTimeout(r, 5));
		const job3 = await createSyncJob(
			{ connectedAccountId: caId, jobType: "incremental" },
			db,
		);

		const rows = await listSyncJobs(caId, db);

		expect(rows.length).toBe(3);
		expect(rows[0]?.id).toBe(job3.id);
		expect(rows[1]?.id).toBe(job2.id);
		expect(rows[2]?.id).toBe(job1.id);
	});
});

describe("getSyncJob", () => {
	test("returns null for unknown ID", async () => {
		const result = await getSyncJob("non-existent-id", db);
		expect(result).toBeNull();
	});
});
