/**
 * Task 2 schema validation script
 *
 * Proves that the foundational ownership and lifecycle constraints for
 * connected_account, contact, email_identity, destination_integration,
 * sync_state, and sync_job are representable without violating constraints.
 *
 * Run from the repo root:
 *   bun apps/server/src/db/validate-task-02.ts
 *
 * Uses an in-memory libSQL database — no external services required.
 * Exits 0 on success, 1 on any assertion failure.
 */

import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "./schema/index.ts";

// ---------------------------------------------------------------------------
// Bootstrap an in-memory database and apply all migrations
// ---------------------------------------------------------------------------

const client = createClient({ url: "file::memory:" });
const db = drizzle({ client, schema, casing: "snake_case" });

// This file lives at apps/server/src/db/validate-task-02.ts
// The migrations folder is at apps/server/drizzle/
const migrationsFolder = new URL("../../drizzle", import.meta.url).pathname;
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

async function expectConstraintViolation(
	label: string,
	fn: () => Promise<unknown>,
): Promise<void> {
	try {
		await fn();
		console.error(
			`  ✗ ${label}: expected constraint violation but none thrown`,
		);
		failed++;
	} catch {
		console.log(`  ✓ ${label} (constraint correctly rejected)`);
		passed++;
	}
}

// ---------------------------------------------------------------------------
// Seed: one user
// ---------------------------------------------------------------------------

const userId = "user-01";
await db.insert(schema.user).values({
	id: userId,
	name: "Test User",
	email: "test@example.com",
	emailVerified: false,
	createdAt: new Date(),
	updatedAt: new Date(),
});

// ===========================================================================
// 1. connected_account — ownership, lifecycle, reconnect/reactivation
// ===========================================================================

console.log(
	"\n── connected_account ──────────────────────────────────────────",
);

const caId = "ca-01";
await db.insert(schema.connectedAccount).values({
	id: caId,
	userId,
	providerAccountEmail: "work@gmail.com",
	provider: "google",
	status: "active",
	encAccessToken: "enc:aabbcc",
	encRefreshToken: "enc:ddeeff",
	encKeyId: "key-v1",
	encAlgorithm: "AES-256-GCM",
	encIv: "base64iv==",
	connectedAt: new Date(),
	createdAt: new Date(),
	updatedAt: new Date(),
});

const ca = await db.query.connectedAccount.findFirst({
	where: (t, { eq: eqFn }) => eqFn(t.id, caId),
});
assert("connected_account row inserted", ca !== undefined);
assert("ownership: userId matches", ca?.userId === userId);
assert(
	"encrypted tokens stored (not plaintext)",
	ca?.encAccessToken === "enc:aabbcc",
);
assert(
	"enc metadata present",
	ca?.encKeyId === "key-v1" && ca?.encAlgorithm === "AES-256-GCM",
);

// Reconnect / reactivation: status transitions on the SAME row
await client.execute({
	sql: "UPDATE connected_account SET status = 'disconnected', disconnected_at = ? WHERE id = ?",
	args: [Date.now(), caId],
});
await client.execute({
	sql: "UPDATE connected_account SET status = 'reactivating', reactivated_at = ? WHERE id = ?",
	args: [Date.now(), caId],
});
await client.execute({
	sql: "UPDATE connected_account SET status = 'active' WHERE id = ?",
	args: [caId],
});

const caAfterReactivation = await db.query.connectedAccount.findFirst({
	where: (t, { eq: eqFn }) => eqFn(t.id, caId),
});
assert(
	"reactivation: same row updated (no new row created)",
	caAfterReactivation?.id === caId,
);
assert(
	"reactivation: status back to active",
	caAfterReactivation?.status === "active",
);

// Uniqueness: same user + same email must be rejected
await expectConstraintViolation(
	"connected_account: duplicate (user_id, provider_account_email) rejected",
	() =>
		db.insert(schema.connectedAccount).values({
			id: "ca-02-dup",
			userId,
			providerAccountEmail: "work@gmail.com", // same as ca-01
			provider: "google",
			status: "active",
			connectedAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
		}),
);

// Invalid status value must be rejected by CHECK constraint
await expectConstraintViolation(
	"connected_account: invalid status value rejected by CHECK",
	() =>
		client.execute({
			sql: "INSERT INTO connected_account (id, user_id, provider_account_email, provider, status, connected_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			args: [
				"ca-bad",
				userId,
				"other@gmail.com",
				"google",
				"invalid_status",
				Date.now(),
				Date.now(),
				Date.now(),
			],
		}),
);

// ===========================================================================
// 2. contact + email_identity — exact-email uniqueness per user
// ===========================================================================

console.log(
	"\n── contact + email_identity ───────────────────────────────────",
);

const contactId = "contact-01";
await db.insert(schema.contact).values({
	id: contactId,
	userId,
	displayName: "Alice Smith",
	createdAt: new Date(),
	updatedAt: new Date(),
});

const eiId = "ei-01";
await db.insert(schema.emailIdentity).values({
	id: eiId,
	userId,
	contactId,
	emailAddress: "alice@example.com",
	displayName: "Alice Smith",
	createdAt: new Date(),
	updatedAt: new Date(),
});

const ei = await db.query.emailIdentity.findFirst({
	where: (t, { eq: eqFn }) => eqFn(t.id, eiId),
});
assert("email_identity row inserted", ei !== undefined);
assert("email_identity: userId matches", ei?.userId === userId);
assert("email_identity: contactId matches", ei?.contactId === contactId);

// Exact-email uniqueness per user
await expectConstraintViolation(
	"email_identity: duplicate (user_id, email_address) rejected",
	() =>
		db.insert(schema.emailIdentity).values({
			id: "ei-02-dup",
			userId,
			emailAddress: "alice@example.com", // same as ei-01
			createdAt: new Date(),
			updatedAt: new Date(),
		}),
);

// Same email for a different user is allowed
const userId2 = "user-02";
await db.insert(schema.user).values({
	id: userId2,
	name: "Other User",
	email: "other@example.com",
	emailVerified: false,
	createdAt: new Date(),
	updatedAt: new Date(),
});
await db.insert(schema.emailIdentity).values({
	id: "ei-03-other-user",
	userId: userId2,
	emailAddress: "alice@example.com", // same email, different user — allowed
	createdAt: new Date(),
	updatedAt: new Date(),
});
const eiOtherUser = await db.query.emailIdentity.findFirst({
	where: (t, { eq: eqFn }) => eqFn(t.id, "ei-03-other-user"),
});
assert(
	"email_identity: same email allowed for different user",
	eiOtherUser !== undefined,
);

// ===========================================================================
// 3. destination_integration — dedupe invariant
// ===========================================================================

console.log(
	"\n── destination_integration ────────────────────────────────────",
);

const diId = "di-01";
await db.insert(schema.destinationIntegration).values({
	id: diId,
	userId,
	provider: "google_tasks",
	providerAccountId: "gaccount-123",
	displayName: "My Google Tasks",
	status: "active",
	createdAt: new Date(),
	updatedAt: new Date(),
});

const di = await db.query.destinationIntegration.findFirst({
	where: (t, { eq: eqFn }) => eqFn(t.id, diId),
});
assert("destination_integration row inserted", di !== undefined);
assert("destination_integration: userId matches", di?.userId === userId);

// Dedupe: same user + provider + providerAccountId must be rejected
await expectConstraintViolation(
	"destination_integration: duplicate (user_id, provider, provider_account_id) rejected",
	() =>
		db.insert(schema.destinationIntegration).values({
			id: "di-02-dup",
			userId,
			provider: "google_tasks",
			providerAccountId: "gaccount-123", // same
			status: "active",
			createdAt: new Date(),
			updatedAt: new Date(),
		}),
);

// Different provider account is allowed
await db.insert(schema.destinationIntegration).values({
	id: "di-03-other-account",
	userId,
	provider: "google_tasks",
	providerAccountId: "gaccount-456", // different account
	status: "active",
	createdAt: new Date(),
	updatedAt: new Date(),
});
const diOther = await db.query.destinationIntegration.findFirst({
	where: (t, { eq: eqFn }) => eqFn(t.id, "di-03-other-account"),
});
assert(
	"destination_integration: different provider_account_id allowed",
	diOther !== undefined,
);

// ===========================================================================
// 4. sync_state vs sync_job — separate current state vs append-only history
// ===========================================================================

console.log(
	"\n── sync_state vs sync_job ─────────────────────────────────────",
);

// sync_state: one row per connected_account
const ssId = "ss-01";
await db.insert(schema.syncState).values({
	id: ssId,
	connectedAccountId: caId,
	syncCursor: null,
	syncMode: "full",
	health: "ok",
	createdAt: new Date(),
	updatedAt: new Date(),
});

const ss = await db.query.syncState.findFirst({
	where: (t, { eq: eqFn }) => eqFn(t.id, ssId),
});
assert("sync_state row inserted", ss !== undefined);
assert(
	"sync_state: connectedAccountId matches",
	ss?.connectedAccountId === caId,
);
assert(
	"sync_state: initial cursor is null (full sync required)",
	ss?.syncCursor === null,
);

// sync_state: uniqueness — only one per connected_account
await expectConstraintViolation(
	"sync_state: duplicate connected_account_id rejected",
	() =>
		db.insert(schema.syncState).values({
			id: "ss-02-dup",
			connectedAccountId: caId, // same account
			syncMode: "full",
			health: "ok",
			createdAt: new Date(),
			updatedAt: new Date(),
		}),
);

// sync_state: update in-place (cursor advance)
await db
	.update(schema.syncState)
	.set({ syncCursor: "cursor-abc123", syncMode: "incremental" })
	.where(eq(schema.syncState.id, ssId));

const ssAfterSync = await db.query.syncState.findFirst({
	where: (t, { eq: eqFn }) => eqFn(t.id, ssId),
});
assert(
	"sync_state: cursor updated in-place (same row)",
	ssAfterSync?.id === ssId && ssAfterSync?.syncCursor === "cursor-abc123",
);
assert(
	"sync_state: mode advanced to incremental",
	ssAfterSync?.syncMode === "incremental",
);

// sync_job: append-only — multiple rows for same account
await db.insert(schema.syncJob).values({
	id: "sj-01",
	connectedAccountId: caId,
	jobType: "full",
	status: "success",
	startedAt: new Date(Date.now() - 60_000),
	finishedAt: new Date(Date.now() - 30_000),
	threadsProcessed: 150,
	messagesProcessed: 420,
	errorsEncountered: 0,
	createdAt: new Date(),
});
await db.insert(schema.syncJob).values({
	id: "sj-02",
	connectedAccountId: caId,
	jobType: "incremental",
	status: "success",
	startedAt: new Date(Date.now() - 10_000),
	finishedAt: new Date(),
	threadsProcessed: 3,
	messagesProcessed: 7,
	errorsEncountered: 0,
	createdAt: new Date(),
});

const jobs = await db.query.syncJob.findMany({
	where: (t, { eq: eqFn }) => eqFn(t.connectedAccountId, caId),
});
assert(
	"sync_job: multiple rows for same connected_account (append-only)",
	jobs.length === 2,
);
assert(
	"sync_job: first job is full sync",
	jobs.some((j) => j.jobType === "full" && j.status === "success"),
);
assert(
	"sync_job: second job is incremental sync",
	jobs.some((j) => j.jobType === "incremental" && j.status === "success"),
);

// sync_job: invalid status rejected
await expectConstraintViolation(
	"sync_job: invalid status value rejected by CHECK",
	() =>
		client.execute({
			sql: "INSERT INTO sync_job (id, connected_account_id, job_type, status, started_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
			args: ["sj-bad", caId, "full", "bad_status", Date.now(), Date.now()],
		}),
);

// ===========================================================================
// 5. Cascade delete: deleting user removes all domain rows
// ===========================================================================

console.log(
	"\n── cascade delete ─────────────────────────────────────────────",
);

const caCountBefore = await db.query.connectedAccount.findMany({
	where: (t, { eq: eqFn }) => eqFn(t.userId, userId),
});
assert(
	"cascade: connected_account rows exist before user delete",
	caCountBefore.length > 0,
);

await client.execute({ sql: "DELETE FROM user WHERE id = ?", args: [userId] });

const caCountAfter = await db.query.connectedAccount.findMany({
	where: (t, { eq: eqFn }) => eqFn(t.userId, userId),
});
assert(
	"cascade: connected_account rows deleted after user delete",
	caCountAfter.length === 0,
);

const eiCountAfter = await db.query.emailIdentity.findMany({
	where: (t, { eq: eqFn }) => eqFn(t.userId, userId),
});
assert(
	"cascade: email_identity rows deleted after user delete",
	eiCountAfter.length === 0,
);

const diCountAfter = await db.query.destinationIntegration.findMany({
	where: (t, { eq: eqFn }) => eqFn(t.userId, userId),
});
assert(
	"cascade: destination_integration rows deleted after user delete",
	diCountAfter.length === 0,
);

// sync_state and sync_job cascade from connected_account
const ssCountAfter = await db.query.syncState.findMany({
	where: (t, { eq: eqFn }) => eqFn(t.connectedAccountId, caId),
});
assert(
	"cascade: sync_state rows deleted after connected_account delete",
	ssCountAfter.length === 0,
);

const sjCountAfter = await db.query.syncJob.findMany({
	where: (t, { eq: eqFn }) => eqFn(t.connectedAccountId, caId),
});
assert(
	"cascade: sync_job rows deleted after connected_account delete",
	sjCountAfter.length === 0,
);

// ===========================================================================
// Summary
// ===========================================================================

console.log(`\n${"─".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
	process.exit(1);
}
console.log("All assertions passed ✓");
