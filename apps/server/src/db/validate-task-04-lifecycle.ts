/**
 * Task 4 lifecycle validation script
 *
 * Proves that the revision/action-item/attachment lifecycle invariants hold
 * in the schema by running live INSERT/UPDATE statements against an in-memory
 * SQLite database and verifying that:
 *
 * ── Action-item lifecycle ────────────────────────────────────────────────────
 *
 *   1. An action item can be created in "pending" state with no destination
 *      integration (destination_integration_id = null).
 *   2. A "confirmed" action item WITHOUT a destination_integration_id is
 *      REJECTED by the DB CHECK constraint.
 *   3. A "confirmed" action item WITH a destination_integration_id is accepted.
 *   4. A "dismissed" action item is retained (not deleted) — the row persists.
 *   5. A confirmed action item survives a later thread revision being created
 *      (the confirmed item is NOT cascade-deleted by the new revision).
 *   6. An action item's source_revision_id is preserved even after the item
 *      is confirmed (provenance is retained).
 *
 * ── Attachment lifecycle ─────────────────────────────────────────────────────
 *
 *   7. An attachment can exist in "pending" state without an object_asset_id
 *      (upload not yet started).
 *   8. An attachment can exist in "failed" state without an object_asset_id
 *      (upload failed — partial success).
 *   9. An "uploaded" attachment WITHOUT an object_asset_id is REJECTED by the
 *      DB CHECK constraint.
 *  10. An "uploaded" attachment WITH an object_asset_id is accepted.
 *  11. A failed attachment does NOT invalidate the parent message row — the
 *      message row remains queryable after the attachment fails.
 *  12. A pending attachment does NOT invalidate the parent thread row — the
 *      thread row remains queryable after the attachment is pending.
 *
 * Usage (from apps/server):
 *   bun run src/db/validate-task-04-lifecycle.ts
 *
 * Exit code 0 = all invariants hold.
 * Exit code 1 = one or more invariants failed.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Bootstrap — use an in-memory SQLite database so the script is self-contained
// ---------------------------------------------------------------------------

const client = createClient({ url: "file::memory:" });
const db = drizzle(client);

// Resolve migrations folder: apps/server/src/db/ → apps/server/drizzle/
const migrationsFolder = join(import.meta.dir, "../..", "drizzle");
await migrate(db, { migrationsFolder });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

async function expectSuccess(label: string, sql: string): Promise<void> {
	try {
		await client.execute(sql);
		console.log(`  ✅  PASS  ${label}`);
		passed++;
	} catch (err) {
		console.error(`  ❌  FAIL  ${label}`);
		console.error(
			`           Expected success but got: ${(err as Error).message}`,
		);
		failed++;
	}
}

async function expectFailure(label: string, sql: string): Promise<void> {
	try {
		await client.execute(sql);
		console.error(`  ❌  FAIL  ${label}`);
		console.error(
			"           Expected DB constraint violation but INSERT succeeded",
		);
		failed++;
	} catch {
		console.log(
			`  ✅  PASS  ${label}  (constraint correctly rejected the row)`,
		);
		passed++;
	}
}

async function expectRowExists(label: string, sql: string): Promise<void> {
	try {
		const result = await client.execute(sql);
		if (result.rows.length > 0) {
			console.log(`  ✅  PASS  ${label}`);
			passed++;
		} else {
			console.error(`  ❌  FAIL  ${label}`);
			console.error(
				"           Expected row to exist but query returned 0 rows",
			);
			failed++;
		}
	} catch (err) {
		console.error(`  ❌  FAIL  ${label}`);
		console.error(`           Query error: ${(err as Error).message}`);
		failed++;
	}
}

// ---------------------------------------------------------------------------
// Seed minimal parent rows
// ---------------------------------------------------------------------------

// user
await client.execute(`
  INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
  VALUES ('u1', 'Test User', 'test@example.com', 1,
          cast(unixepoch('subsecond') * 1000 as integer),
          cast(unixepoch('subsecond') * 1000 as integer))
`);

// connected_account
await client.execute(`
  INSERT INTO connected_account
    (id, user_id, provider_account_email, provider, status, connected_at, created_at, updated_at)
  VALUES ('ca1', 'u1', 'test@example.com', 'google', 'active',
          cast(unixepoch('subsecond') * 1000 as integer),
          cast(unixepoch('subsecond') * 1000 as integer),
          cast(unixepoch('subsecond') * 1000 as integer))
`);

// destination_integration
await client.execute(`
  INSERT INTO destination_integration
    (id, user_id, provider, provider_account_id, status, created_at, updated_at)
  VALUES ('di1', 'u1', 'google_tasks', 'gaccount-123', 'active',
          cast(unixepoch('subsecond') * 1000 as integer),
          cast(unixepoch('subsecond') * 1000 as integer))
`);

// thread (accepted, so category is required)
await client.execute(`
  INSERT INTO thread
    (id, connected_account_id, provider_thread_id, screening_state, category,
     is_hidden, is_archived, is_trashed, is_read, created_at, updated_at)
  VALUES ('t1', 'ca1', 'provider-t1', 'accepted', 'inbox',
          0, 0, 0, 0,
          cast(unixepoch('subsecond') * 1000 as integer),
          cast(unixepoch('subsecond') * 1000 as integer))
`);

// thread_revision (revision 1)
await client.execute(`
  INSERT INTO thread_revision
    (id, thread_id, revision_number, content_hash, change_reason, created_at)
  VALUES ('tr1', 't1', 1, 'hash-abc123', 'new_message',
          cast(unixepoch('subsecond') * 1000 as integer))
`);

// message
await client.execute(`
  INSERT INTO message
    (id, connected_account_id, thread_id, provider_message_id,
     is_provider_read, created_at, updated_at)
  VALUES ('m1', 'ca1', 't1', 'provider-m1',
          0,
          cast(unixepoch('subsecond') * 1000 as integer),
          cast(unixepoch('subsecond') * 1000 as integer))
`);

// ---------------------------------------------------------------------------
// Action-item lifecycle tests
// ---------------------------------------------------------------------------

console.log(
	"\n── Action-item lifecycle ──────────────────────────────────────────────────",
);

// 1. Pending action item with no destination — valid
await expectSuccess(
	"pending action item + null destination_integration_id is valid",
	`INSERT INTO action_item
     (id, thread_id, source_revision_id, lifecycle_state, title, created_at, updated_at)
   VALUES ('ai1', 't1', 'tr1', 'pending', 'Follow up on proposal',
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer))`,
);

// 2. Confirmed action item WITHOUT destination — INVALID (CHECK violation)
await expectFailure(
	"confirmed action item + null destination_integration_id violates CHECK",
	`INSERT INTO action_item
     (id, thread_id, source_revision_id, lifecycle_state, title, created_at, updated_at)
   VALUES ('ai-bad', 't1', 'tr1', 'confirmed', 'Bad confirmed item',
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer))`,
);

// 3. Confirmed action item WITH destination — valid
await expectSuccess(
	"confirmed action item + destination_integration_id is valid",
	`INSERT INTO action_item
     (id, thread_id, source_revision_id, lifecycle_state,
      destination_integration_id, title, confirmed_at, created_at, updated_at)
   VALUES ('ai2', 't1', 'tr1', 'confirmed', 'di1', 'Schedule meeting',
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer))`,
);

// 4. Dismissed action item is retained (row persists after dismissal)
await expectSuccess(
	"dismissed action item can be inserted (retained for history)",
	`INSERT INTO action_item
     (id, thread_id, source_revision_id, lifecycle_state, title,
      dismissed_at, created_at, updated_at)
   VALUES ('ai3', 't1', 'tr1', 'dismissed', 'Dismissed task',
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer))`,
);

// Verify dismissed item still exists
await expectRowExists(
	"dismissed action item row persists (not deleted)",
	"SELECT id FROM action_item WHERE id = 'ai3' AND lifecycle_state = 'dismissed'",
);

// 5. Create a second revision — confirmed action item must survive
await expectSuccess(
	"second thread revision can be created (new effective content)",
	`INSERT INTO thread_revision
     (id, thread_id, revision_number, content_hash, change_reason, created_at)
   VALUES ('tr2', 't1', 2, 'hash-def456', 'new_message',
           cast(unixepoch('subsecond') * 1000 as integer))`,
);

// Confirmed item ai2 must still exist after the new revision
await expectRowExists(
	"confirmed action item survives later thread revision (durable)",
	"SELECT id FROM action_item WHERE id = 'ai2' AND lifecycle_state = 'confirmed'",
);

// 6. Source revision provenance is preserved on confirmed item
await expectRowExists(
	"confirmed action item retains source_revision_id provenance",
	"SELECT id FROM action_item WHERE id = 'ai2' AND source_revision_id = 'tr1'",
);

// ---------------------------------------------------------------------------
// Attachment lifecycle tests
// ---------------------------------------------------------------------------

console.log(
	"\n── Attachment lifecycle ───────────────────────────────────────────────────",
);

// 7. Pending attachment with no object_asset_id — valid
await expectSuccess(
	"pending attachment + null object_asset_id is valid",
	`INSERT INTO attachment
     (id, message_id, filename, content_type, byte_size,
      ingestion_state, created_at, updated_at)
   VALUES ('att1', 'm1', 'report.pdf', 'application/pdf', 102400,
           'pending',
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer))`,
);

// 8. Failed attachment with no object_asset_id — valid (partial success)
await expectSuccess(
	"failed attachment + null object_asset_id is valid (partial success)",
	`INSERT INTO attachment
     (id, message_id, filename, content_type, byte_size,
      ingestion_state, ingestion_error, created_at, updated_at)
   VALUES ('att2', 'm1', 'image.png', 'image/png', 204800,
           'failed', 'Upload timeout after 30s',
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer))`,
);

// 9. Uploaded attachment WITHOUT object_asset_id — INVALID (CHECK violation)
await expectFailure(
	"uploaded attachment + null object_asset_id violates CHECK",
	`INSERT INTO attachment
     (id, message_id, filename, ingestion_state, created_at, updated_at)
   VALUES ('att-bad', 'm1', 'bad.pdf', 'uploaded',
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer))`,
);

// Seed an object_asset for the uploaded attachment test
await client.execute(`
  INSERT INTO object_asset
    (id, bucket, object_key, content_type, byte_size, created_at)
  VALUES ('oa1', 'hay-attachments', 'attachments/m1/spreadsheet.xlsx',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          51200,
          cast(unixepoch('subsecond') * 1000 as integer))
`);

// 10. Uploaded attachment WITH object_asset_id — valid
await expectSuccess(
	"uploaded attachment + object_asset_id is valid",
	`INSERT INTO attachment
     (id, message_id, filename, content_type, byte_size,
      ingestion_state, object_asset_id, uploaded_at, created_at, updated_at)
   VALUES ('att3', 'm1', 'spreadsheet.xlsx',
           'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
           51200, 'uploaded', 'oa1',
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer))`,
);

// 11. Failed attachment does NOT invalidate parent message
await expectRowExists(
	"parent message row is intact after attachment failure (partial success)",
	"SELECT id FROM message WHERE id = 'm1'",
);

// 12. Pending attachment does NOT invalidate parent thread
await expectRowExists(
	"parent thread row is intact with pending attachment (partial success)",
	"SELECT id FROM thread WHERE id = 't1'",
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(
	`\n── Results ─────────────────────────────────────────────────────────────────`,
);
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total:  ${passed + failed}`);

if (failed > 0) {
	console.error(
		"\n❌  Some invariants FAILED — schema does not enforce all required rules.",
	);
	process.exit(1);
} else {
	console.log(
		"\n✅  All invariants PASSED — schema correctly enforces revision/action-item/attachment lifecycle rules.",
	);
	process.exit(0);
}
