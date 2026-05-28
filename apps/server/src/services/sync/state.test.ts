/**
 * @file state.test.ts — Bun test-runner tests for the sync state service.
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
 *  11. loadOwnedConnectedAccounts returns only accounts for the given userId.
 *  12. loadOwnedConnectedAccounts with statusFilter returns only matching rows.
 *
 * Uses a temp file-based SQLite database — no external services required.
 * (file::memory: does not support transactions in @libsql/client because each
 * transaction opens a new connection, which sees a fresh empty database.)
 */

import { unlinkSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
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
	loadOwnedConnectedAccounts,
	resolveRunType,
	updateSyncHealth,
} from "./state.ts";

// ---------------------------------------------------------------------------
// DB setup / teardown
// ---------------------------------------------------------------------------

const dbPath = `/tmp/sync-state-test-${Date.now()}.db`;
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
	suffix?: string,
	status: "active" | "disconnected" | "reactivating" | "error" = "active",
): Promise<{ userId: string; caId: string }> {
	const tag = suffix ?? String(++_seedCounter);
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

	return { userId, caId };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("bootstrapSyncState", () => {
	test("creates row with syncMode=initial when none exists", async () => {
		const { caId } = await seedAccount();

		const before = await getSyncState(caId, db);
		expect(before).toBeNull();

		const row = await bootstrapSyncState(caId, db);
		expect(row.syncMode).toBe("initial");
		expect(row.health).toBe("ok");
		expect(row.syncCursor).toBeNull();
		expect(row.connectedAccountId).toBe(caId);
	});

	test("is idempotent — second call returns same row", async () => {
		const { caId } = await seedAccount();

		const first = await bootstrapSyncState(caId, db);
		const second = await bootstrapSyncState(caId, db);

		expect(second.id).toBe(first.id);
		expect(second.syncMode).toBe(first.syncMode);
	});
});

describe("resolveRunType", () => {
	test("returns 'initial' when cursor is null", async () => {
		const { caId } = await seedAccount();
		await bootstrapSyncState(caId, db);

		const runType = await resolveRunType(caId, db);
		expect(runType).toBe("initial");
	});

	test("returns 'incremental' when cursor is set", async () => {
		const { caId } = await seedAccount();
		await bootstrapSyncState(caId, db);

		await db
			.update(syncState)
			.set({ syncCursor: "cursor-abc", syncMode: "incremental" })
			.where(eq(syncState.connectedAccountId, caId));

		const runType = await resolveRunType(caId, db);
		expect(runType).toBe("incremental");
	});
});

describe("commitBatchWithCursor", () => {
	test("advances cursor and sets syncMode=incremental", async () => {
		const { caId } = await seedAccount();
		await bootstrapSyncState(caId, db);

		let batchCalled = false;

		await commitBatchWithCursor(
			{
				connectedAccountId: caId,
				nextCursor: "cursor-xyz",
				batchFn: async (_tx) => {
					batchCalled = true;
				},
			},
			db,
		);

		expect(batchCalled).toBe(true);

		const after = await getSyncState(caId, db);
		expect(after?.syncCursor).toBe("cursor-xyz");
		expect(after?.syncMode).toBe("incremental");
		expect(after?.lastAttemptedAt).not.toBeNull();
	});

	test("batch writes and cursor update are atomic", async () => {
		const { caId } = await seedAccount();
		await bootstrapSyncState(caId, db);

		await commitBatchWithCursor(
			{
				connectedAccountId: caId,
				nextCursor: "cursor-batch-atomic",
				batchFn: async (tx) => {
					// Write inside the transaction to prove atomicity.
					await tx
						.update(syncState)
						.set({ health: "degraded" })
						.where(eq(syncState.connectedAccountId, caId));
				},
			},
			db,
		);

		const after = await getSyncState(caId, db);
		// Both the batch write (health=degraded) and cursor must be visible.
		expect(after?.health).toBe("degraded");
		expect(after?.syncCursor).toBe("cursor-batch-atomic");
		expect(after?.syncMode).toBe("incremental");
	});

	test("null cursor resets syncMode to 'initial'", async () => {
		const { caId } = await seedAccount();
		await bootstrapSyncState(caId, db);

		// Establish a cursor first.
		await db
			.update(syncState)
			.set({ syncCursor: "cursor-existing", syncMode: "incremental" })
			.where(eq(syncState.connectedAccountId, caId));

		// Clear it.
		await commitBatchWithCursor(
			{
				connectedAccountId: caId,
				nextCursor: null,
				batchFn: async (_tx) => {},
			},
			db,
		);

		const after = await getSyncState(caId, db);
		expect(after?.syncCursor).toBeNull();
		expect(after?.syncMode).toBe("initial");
	});
});

describe("updateSyncHealth", () => {
	test("sets health without touching connected_account.status", async () => {
		const { caId } = await seedAccount();
		await bootstrapSyncState(caId, db);

		const caBefore = await db.query.connectedAccount.findFirst({
			where: eq(connectedAccount.id, caId),
		});
		expect(caBefore?.status).toBe("active");

		await updateSyncHealth(caId, "failed", db);

		const stateAfter = await getSyncState(caId, db);
		expect(stateAfter?.health).toBe("failed");

		const caAfter = await db.query.connectedAccount.findFirst({
			where: eq(connectedAccount.id, caId),
		});
		expect(caAfter?.status).toBe("active");
	});

	test("'ok' advances lastSyncedAt", async () => {
		const { caId } = await seedAccount();
		await bootstrapSyncState(caId, db);

		const before = await getSyncState(caId, db);
		expect(before?.lastSyncedAt).toBeNull();

		await updateSyncHealth(caId, "ok", db);

		const after = await getSyncState(caId, db);
		expect(after?.lastSyncedAt).not.toBeNull();
		expect(after?.lastAttemptedAt).not.toBeNull();
	});

	test("'failed' does NOT advance lastSyncedAt", async () => {
		const { caId } = await seedAccount();
		await bootstrapSyncState(caId, db);

		await updateSyncHealth(caId, "failed", db);

		const after = await getSyncState(caId, db);
		expect(after?.lastSyncedAt).toBeNull();
		expect(after?.lastAttemptedAt).not.toBeNull();
		expect(after?.health).toBe("failed");
	});
});

describe("loadOwnedConnectedAccounts", () => {
	test("returns only accounts owned by the given userId", async () => {
		const { userId: userA, caId: caA1 } = await seedAccount();
		// Add a second account for userA.
		const caA2 = `ca-extra-${Date.now()}`;
		await db.insert(connectedAccount).values({
			id: caA2,
			userId: userA,
			providerAccountEmail: `extra-${Date.now()}@example.com`,
			provider: "google",
			status: "active",
			createdAt: new Date(),
			updatedAt: new Date(),
			connectedAt: new Date(),
		});

		// A completely separate user.
		const { userId: userB } = await seedAccount();

		const accountsA = await loadOwnedConnectedAccounts(userA, undefined, db);
		const accountsB = await loadOwnedConnectedAccounts(userB, undefined, db);

		// userA should have exactly 2 accounts.
		expect(accountsA.length).toBe(2);
		const ids = accountsA.map((a) => a.id);
		expect(ids).toContain(caA1);
		expect(ids).toContain(caA2);

		// userB should have exactly 1 account.
		expect(accountsB.length).toBe(1);
		// userB's account must NOT appear in userA's results.
		expect(ids).not.toContain(accountsB[0]?.id);
	});

	test("statusFilter returns only matching rows", async () => {
		// Create a user with one active and one disconnected account.
		const userId = `user-filter-${Date.now()}`;
		await db.insert(schema.user).values({
			id: userId,
			name: "Filter User",
			email: `filter-${Date.now()}@example.com`,
			emailVerified: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		const caActive = `ca-active-${Date.now()}`;
		const caDisconnected = `ca-disc-${Date.now()}`;

		await db.insert(connectedAccount).values([
			{
				id: caActive,
				userId,
				providerAccountEmail: `active-${Date.now()}@example.com`,
				provider: "google",
				status: "active",
				createdAt: new Date(),
				updatedAt: new Date(),
				connectedAt: new Date(),
			},
			{
				id: caDisconnected,
				userId,
				providerAccountEmail: `disc-${Date.now()}@example.com`,
				provider: "google",
				status: "disconnected",
				createdAt: new Date(Date.now() + 1),
				updatedAt: new Date(),
				connectedAt: new Date(),
			},
		]);

		const activeOnly = await loadOwnedConnectedAccounts(userId, ["active"], db);
		expect(activeOnly.length).toBe(1);
		expect(activeOnly[0]?.id).toBe(caActive);

		const all = await loadOwnedConnectedAccounts(userId, undefined, db);
		expect(all.length).toBe(2);
	});
});
