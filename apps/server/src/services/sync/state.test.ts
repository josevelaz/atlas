/**
 * @file state.test.ts — Tests for the sync state service.
 *
 * Proves:
 *   1. Missing sync_state bootstraps to syncMode = "initial".
 *   2. Idempotent bootstrap — calling twice returns the same row.
 *   3. resolveRunType returns "initial" when cursor is null.
 *   4. resolveRunType returns "incremental" when cursor is set.
 *   5. commitBatchWithCursor advances cursor and sets syncMode = "incremental".
 *   6. commitBatchWithCursor is atomic — batch writes and cursor update commit
 *      together (simulated by verifying both are visible after commit).
 *   7. commitBatchWithCursor with nextCursor = null resets mode to "initial".
 *   8. updateSyncHealth sets health without touching connected_account.status.
 *   9. updateSyncHealth "ok" advances lastSyncedAt.
 *  10. updateSyncHealth "failed" does NOT advance lastSyncedAt.
 *
 * Run:
 *   bun apps/server/src/services/sync/state.test.ts
 *
 * Uses a temp file-based SQLite database — no external services required.
 * (file::memory: does not support transactions in @libsql/client because each
 * transaction opens a new connection, which sees a fresh empty database.)
 * Exits 0 on success, 1 on any assertion failure.
 */

import { unlinkSync } from "node:fs";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "../../db/schema/index.ts";
import { connectedAccount } from "../../db/schema/connected_account.ts";
import { syncState } from "../../db/schema/sync.ts";
import {
	bootstrapSyncState,
	commitBatchWithCursor,
	getSyncState,
	resolveRunType,
	updateSyncHealth,
} from "./state.ts";

// ---------------------------------------------------------------------------
// Bootstrap temp file-based SQLite DB
// Note: file::memory: does not support transactions in @libsql/client because
// each transaction opens a new connection to a fresh empty database.
// ---------------------------------------------------------------------------

const dbPath = `/tmp/sync-state-test-${Date.now()}.db`;
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

// Seed a minimal user + connected_account so FK constraints are satisfied.
async function seedAccount(suffix: string): Promise<string> {
	const userId = `user-${suffix}`;
	const caId = `ca-${suffix}`;

	// Insert a minimal user row (Better Auth user table).
	await db.insert(schema.user).values({
		id: userId,
		name: `Test User ${suffix}`,
		email: `test-${suffix}@example.com`,
		emailVerified: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	await db.insert(connectedAccount).values({
		id: caId,
		userId,
		providerAccountEmail: `mailbox-${suffix}@example.com`,
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
	"\n── sync/state.ts ──────────────────────────────────────────────",
);

// ── Test 1: Bootstrap creates row with syncMode = "initial" ─────────────────
{
	console.log("\n[1] Bootstrap creates sync_state with syncMode = initial");
	const caId = await seedAccount("t1");

	const before = await getSyncState(caId, db);
	assert("no row before bootstrap", before === null);

	const row = await bootstrapSyncState(caId, db);
	assertEq("syncMode is initial", row.syncMode, "initial");
	assertEq("health is ok", row.health, "ok");
	assert("syncCursor is null", row.syncCursor === null);
	assertEq("connectedAccountId matches", row.connectedAccountId, caId);
}

// ── Test 2: Bootstrap is idempotent ─────────────────────────────────────────
{
	console.log("\n[2] Bootstrap is idempotent");
	const caId = await seedAccount("t2");

	const first = await bootstrapSyncState(caId, db);
	const second = await bootstrapSyncState(caId, db);

	assertEq("same id on second call", second.id, first.id);
	assertEq("same syncMode", second.syncMode, first.syncMode);
}

// ── Test 3: resolveRunType returns "initial" when cursor is null ─────────────
{
	console.log("\n[3] resolveRunType returns initial when cursor is null");
	const caId = await seedAccount("t3");

	await bootstrapSyncState(caId, db);
	const runType = await resolveRunType(caId, db);
	assertEq("runType is initial", runType, "initial");
}

// ── Test 4: resolveRunType returns "incremental" when cursor is set ──────────
{
	console.log("\n[4] resolveRunType returns incremental when cursor is set");
	const caId = await seedAccount("t4");

	await bootstrapSyncState(caId, db);

	// Manually set a cursor to simulate a completed initial run.
	await db
		.update(syncState)
		.set({ syncCursor: "cursor-abc", syncMode: "incremental" })
		.where(eq(syncState.connectedAccountId, caId));

	const runType = await resolveRunType(caId, db);
	assertEq("runType is incremental", runType, "incremental");
}

// ── Test 5: commitBatchWithCursor advances cursor and sets incremental ────────
{
	console.log("\n[5] commitBatchWithCursor advances cursor atomically");
	const caId = await seedAccount("t5");

	await bootstrapSyncState(caId, db);

	let batchCallbackCalled = false;

	await commitBatchWithCursor(
		{
			connectedAccountId: caId,
			nextCursor: "cursor-xyz",
			batchFn: async (_tx) => {
				batchCallbackCalled = true;
				// In a real run, the batch writes would go here via _tx.
			},
		},
		db,
	);

	assert("batchFn was called", batchCallbackCalled);

	const after = await getSyncState(caId, db);
	assertEq("syncCursor updated", after?.syncCursor, "cursor-xyz");
	assertEq("syncMode is incremental", after?.syncMode, "incremental");
	assert("lastAttemptedAt is set", after?.lastAttemptedAt !== null);
}

// ── Test 6: commitBatchWithCursor batch writes are visible after commit ───────
{
	console.log(
		"\n[6] commitBatchWithCursor batch writes are atomic with cursor",
	);
	const caId = await seedAccount("t6");

	await bootstrapSyncState(caId, db);

	// We'll use a sentinel: write a sync_state health update inside the batch
	// callback (using the tx) and verify it's visible after commit.
	await commitBatchWithCursor(
		{
			connectedAccountId: caId,
			nextCursor: "cursor-batch-atomic",
			batchFn: async (tx) => {
				// Write something inside the transaction to prove atomicity.
				// We update health via the tx handle.
				await tx
					.update(syncState)
					.set({ health: "degraded" })
					.where(eq(syncState.connectedAccountId, caId));
			},
		},
		db,
	);

	const after = await getSyncState(caId, db);
	// Both the batch write (health = degraded) and cursor update must be visible.
	assertEq("batch write (health) committed", after?.health, "degraded");
	assertEq(
		"cursor committed atomically",
		after?.syncCursor,
		"cursor-batch-atomic",
	);
	assertEq("syncMode is incremental", after?.syncMode, "incremental");
}

// ── Test 7: commitBatchWithCursor with null cursor resets to initial ──────────
{
	console.log("\n[7] commitBatchWithCursor with null cursor resets to initial");
	const caId = await seedAccount("t7");

	await bootstrapSyncState(caId, db);

	// First, establish a cursor.
	await db
		.update(syncState)
		.set({ syncCursor: "cursor-existing", syncMode: "incremental" })
		.where(eq(syncState.connectedAccountId, caId));

	// Now clear it.
	await commitBatchWithCursor(
		{
			connectedAccountId: caId,
			nextCursor: null,
			batchFn: async (_tx) => {},
		},
		db,
	);

	const after = await getSyncState(caId, db);
	assert("syncCursor is null", after?.syncCursor === null);
	assertEq("syncMode reset to initial", after?.syncMode, "initial");
}

// ── Test 8: updateSyncHealth does NOT touch connected_account.status ──────────
{
	console.log("\n[8] updateSyncHealth does not touch connected_account.status");
	const caId = await seedAccount("t8");

	await bootstrapSyncState(caId, db);

	// Read the initial connected_account status.
	const caBefore = await db.query.connectedAccount.findFirst({
		where: eq(connectedAccount.id, caId),
	});
	assertEq("initial status is active", caBefore?.status, "active");

	// Update health to "failed".
	await updateSyncHealth(caId, "failed", db);

	// Verify sync_state.health changed.
	const stateAfter = await getSyncState(caId, db);
	assertEq("sync_state.health is failed", stateAfter?.health, "failed");

	// Verify connected_account.status is unchanged.
	const caAfter = await db.query.connectedAccount.findFirst({
		where: eq(connectedAccount.id, caId),
	});
	assertEq("connected_account.status unchanged", caAfter?.status, "active");
}

// ── Test 9: updateSyncHealth "ok" advances lastSyncedAt ──────────────────────
{
	console.log("\n[9] updateSyncHealth ok advances lastSyncedAt");
	const caId = await seedAccount("t9");

	await bootstrapSyncState(caId, db);

	const before = await getSyncState(caId, db);
	assert("lastSyncedAt is null before", before?.lastSyncedAt === null);

	await updateSyncHealth(caId, "ok", db);

	const after = await getSyncState(caId, db);
	assert("lastSyncedAt is set after ok", after?.lastSyncedAt !== null);
	assert("lastAttemptedAt is set", after?.lastAttemptedAt !== null);
}

// ── Test 10: updateSyncHealth "failed" does NOT advance lastSyncedAt ─────────
{
	console.log("\n[10] updateSyncHealth failed does not advance lastSyncedAt");
	const caId = await seedAccount("t10");

	await bootstrapSyncState(caId, db);

	await updateSyncHealth(caId, "failed", db);

	const after = await getSyncState(caId, db);
	assert(
		"lastSyncedAt remains null after failed",
		after?.lastSyncedAt === null,
	);
	assert("lastAttemptedAt is set", after?.lastAttemptedAt !== null);
	assertEq("health is failed", after?.health, "failed");
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
