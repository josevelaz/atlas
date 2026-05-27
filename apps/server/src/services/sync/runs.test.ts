/**
 * @file runs.test.ts — Tests for the sync run persistence service.
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
 * Run:
 *   bun apps/server/src/services/sync/runs.test.ts
 *
 * Uses a temp file-based SQLite database — no external services required.
 * Exits 0 on success, 1 on any assertion failure.
 */

import { unlinkSync } from "node:fs";
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
// Bootstrap temp file-based SQLite DB
// ---------------------------------------------------------------------------

const dbPath = `/tmp/sync-runs-test-${Date.now()}.db`;
const client = createClient({ url: `file:${dbPath}` });
const db = drizzle({ client, schema, casing: "snake_case" });

const migrationsFolder = new URL("../../../drizzle", import.meta.url).pathname;
await migrate(db, { migrationsFolder });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean): void {
	if (condition) {
		console.log(`  ✓ ${label}`);
		passed++;
	} else {
		console.error(`  ✗ ${label}`);
		failed++;
	}
}

function assertEq<T>(label: string, actual: T, expected: T): void {
	const ok =
		JSON.stringify(actual) === JSON.stringify(expected) || actual === expected;
	if (ok) {
		console.log(`  ✓ ${label}`);
		passed++;
	} else {
		console.error(
			`  ✗ ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
		);
		failed++;
	}
}

async function seedAccount(suffix: string): Promise<string> {
	const userId = `user-r${suffix}`;
	const caId = `ca-r${suffix}`;

	await db.insert(schema.user).values({
		id: userId,
		name: `Test User ${suffix}`,
		email: `test-r${suffix}@example.com`,
		emailVerified: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	await db.insert(connectedAccount).values({
		id: caId,
		userId,
		providerAccountEmail: `mailbox-r${suffix}@example.com`,
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

console.log(
	"\n── sync/runs.ts ───────────────────────────────────────────────",
);

// ── Test 1: createSyncJob inserts row with status = "running" ────────────────
{
	console.log("\n[1] createSyncJob inserts row with status = running");
	const caId = await seedAccount("t1");

	const job = await createSyncJob(
		{ connectedAccountId: caId, jobType: "initial" },
		db,
	);

	assertEq("status is running", job.status, "running");
	assertEq("jobType is initial", job.jobType, "initial");
	assertEq("connectedAccountId matches", job.connectedAccountId, caId);
	assertEq("threadsProcessed is 0", job.threadsProcessed, 0);
	assertEq("messagesProcessed is 0", job.messagesProcessed, 0);
	assertEq("errorsEncountered is 0", job.errorsEncountered, 0);
	assert("finishedAt is null", job.finishedAt === null);
	assert("id is set", typeof job.id === "string" && job.id.length > 0);
}

// ── Test 2: createSyncJob stores cursorSnapshot ──────────────────────────────
{
	console.log("\n[2] createSyncJob stores cursorSnapshot");
	const caId = await seedAccount("t2");

	const job = await createSyncJob(
		{
			connectedAccountId: caId,
			jobType: "incremental",
			cursorSnapshot: "cursor-snap-abc",
		},
		db,
	);

	assertEq("cursorSnapshot stored", job.cursorSnapshot, "cursor-snap-abc");
	assertEq("jobType is incremental", job.jobType, "incremental");
}

// ── Test 3: markRunComplete sets status = "success" ──────────────────────────
{
	console.log("\n[3] markRunComplete sets status = success");
	const caId = await seedAccount("t3");

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
	assertEq("status is success", updated?.status, "success");
	assertEq("threadsProcessed", updated?.threadsProcessed, 10);
	assertEq("messagesProcessed", updated?.messagesProcessed, 42);
	assertEq("errorsEncountered", updated?.errorsEncountered, 0);
	assert("finishedAt is set", updated?.finishedAt !== null);
	assert("errorDetail is null", updated?.errorDetail === null);
}

// ── Test 4: markRunComplete sets status = "partial_success" ──────────────────
{
	console.log("\n[4] markRunComplete sets status = partial_success");
	const caId = await seedAccount("t4");

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
	assertEq("status is partial_success", updated?.status, "partial_success");
	assertEq("errorsEncountered", updated?.errorsEncountered, 3);
	assertEq("errorDetail stored", updated?.errorDetail, '{"skipped":3}');
	assert("finishedAt is set", updated?.finishedAt !== null);
}

// ── Test 5: markRunComplete sets status = "failed" ───────────────────────────
{
	console.log("\n[5] markRunComplete sets status = failed");
	const caId = await seedAccount("t5");

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
	assertEq("status is failed", updated?.status, "failed");
	assertEq("errorDetail stored", updated?.errorDetail, "Provider returned 401");
	assert("finishedAt is set", updated?.finishedAt !== null);
}

// ── Test 6: markRunComplete does NOT touch connected_account.status ───────────
{
	console.log("\n[6] markRunComplete does not touch connected_account.status");
	const caId = await seedAccount("t6");

	// Read initial status.
	const caBefore = await db.query.connectedAccount.findFirst({
		where: (t, { eq }) => eq(t.id, caId),
	});
	assertEq("initial status is active", caBefore?.status, "active");

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

	// connected_account.status must be unchanged.
	const caAfter = await db.query.connectedAccount.findFirst({
		where: (t, { eq }) => eq(t.id, caId),
	});
	assertEq("connected_account.status unchanged", caAfter?.status, "active");
}

// ── Test 7: listSyncJobs returns rows ordered by startedAt desc ───────────────
{
	console.log("\n[7] listSyncJobs returns rows ordered by startedAt desc");
	const caId = await seedAccount("t7");

	// Create three jobs with a small delay between each to ensure distinct timestamps.
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

	assertEq("3 rows returned", rows.length, 3);
	// Most recent first.
	assertEq("first row is job3", rows[0]?.id, job3.id);
	assertEq("second row is job2", rows[1]?.id, job2.id);
	assertEq("third row is job1", rows[2]?.id, job1.id);
}

// ── Test 8: getSyncJob returns null for unknown ID ────────────────────────────
{
	console.log("\n[8] getSyncJob returns null for unknown ID");
	const result = await getSyncJob("non-existent-id", db);
	assert("returns null", result === null);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(
	`\n── Results: ${passed} passed, ${failed} failed ──────────────────────────\n`,
);

// Cleanup temp DB file.
try {
	unlinkSync(dbPath);
} catch {}

if (failed > 0) {
	process.exit(1);
}
