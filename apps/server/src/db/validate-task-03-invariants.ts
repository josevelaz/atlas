/**
 * Task 3 invariant validation script
 *
 * Proves that the thread/category/screening invariants hold in the schema by
 * running live INSERT statements against a local SQLite database and verifying
 * that:
 *
 *   1. A pending thread (screening_state = 'pending') with category = null
 *      is accepted (valid).
 *   2. An accepted thread (screening_state = 'accepted') with category = 'inbox'
 *      is accepted (valid).
 *   3. A pending thread with category = 'inbox' is REJECTED by the DB CHECK
 *      constraint (invalid — category must be null for non-accepted threads).
 *   4. An accepted thread with category = null is REJECTED by the DB CHECK
 *      constraint (invalid — category must be non-null for accepted threads).
 *   5. A rejected thread (screening_state = 'rejected') with is_hidden = true
 *      and prior_category preserved is accepted (valid — lossless restore).
 *   6. Archiving a pending thread is REJECTED by the DB CHECK constraint
 *      (archive is accepted-only).
 *   7. Trashing a pending/Screener thread is accepted (trash is allowed on
 *      Screener threads).
 *   8. handling_state on a pending thread is REJECTED by the DB CHECK
 *      constraint (handling_state is accepted-only).
 *   9. A sender_routing_rule with screening_decision = 'accepted' and
 *      default_category = 'inbox' is accepted (valid).
 *  10. A sender_routing_rule with screening_decision = 'rejected' and
 *      default_category = null is accepted (valid).
 *  11. A sender_routing_rule with screening_decision = 'accepted' and
 *      default_category = null is REJECTED (invalid — accepted rules need a
 *      category).
 *  12. A sender_routing_rule with screening_decision = 'rejected' and
 *      default_category = 'inbox' is REJECTED (invalid — rejected rules must
 *      have null category).
 *
 * Usage (from apps/server):
 *   TURSO_DATABASE_URL=file:./local.db bun run src/db/validate-task-03-invariants.ts
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

// Bun exposes import.meta.dir as the directory of the current file.
// Resolve from apps/server/src/db/ → apps/server/drizzle/
// (2 levels up: src/db → src → apps/server, then into drizzle/)
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

// ---------------------------------------------------------------------------
// Seed minimal parent rows (user, connected_account)
// ---------------------------------------------------------------------------

await client.execute(`
  INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
  VALUES ('u1', 'Test User', 'test@example.com', 1,
          cast(unixepoch('subsecond') * 1000 as integer),
          cast(unixepoch('subsecond') * 1000 as integer))
`);

await client.execute(`
  INSERT INTO connected_account
    (id, user_id, provider_account_email, provider, status, connected_at, created_at, updated_at)
  VALUES ('ca1', 'u1', 'test@example.com', 'google', 'active',
          cast(unixepoch('subsecond') * 1000 as integer),
          cast(unixepoch('subsecond') * 1000 as integer),
          cast(unixepoch('subsecond') * 1000 as integer))
`);

// ---------------------------------------------------------------------------
// Thread invariant tests
// ---------------------------------------------------------------------------

console.log(
	"\n── Thread / Category / Screening invariants ──────────────────────────────",
);

// 1. Pending thread with null category — valid
await expectSuccess(
	"pending thread + null category is valid",
	`INSERT INTO thread
     (id, connected_account_id, provider_thread_id, screening_state, category,
      is_hidden, is_archived, is_trashed, is_read, created_at, updated_at)
   VALUES ('t1', 'ca1', 'provider-t1', 'pending', NULL,
           0, 0, 0, 0,
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer))`,
);

// 2. Accepted thread with category = 'inbox' — valid
await expectSuccess(
	"accepted thread + category='inbox' is valid",
	`INSERT INTO thread
     (id, connected_account_id, provider_thread_id, screening_state, category,
      is_hidden, is_archived, is_trashed, is_read, created_at, updated_at)
   VALUES ('t2', 'ca1', 'provider-t2', 'accepted', 'inbox',
           0, 0, 0, 0,
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer))`,
);

// 3. Pending thread with category = 'inbox' — INVALID (CHECK violation)
await expectFailure(
	"pending thread + category='inbox' violates CHECK",
	`INSERT INTO thread
     (id, connected_account_id, provider_thread_id, screening_state, category,
      is_hidden, is_archived, is_trashed, is_read, created_at, updated_at)
   VALUES ('t3', 'ca1', 'provider-t3', 'pending', 'inbox',
           0, 0, 0, 0,
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer))`,
);

// 4. Accepted thread with null category — INVALID (CHECK violation)
await expectFailure(
	"accepted thread + null category violates CHECK",
	`INSERT INTO thread
     (id, connected_account_id, provider_thread_id, screening_state, category,
      is_hidden, is_archived, is_trashed, is_read, created_at, updated_at)
   VALUES ('t4', 'ca1', 'provider-t4', 'accepted', NULL,
           0, 0, 0, 0,
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer))`,
);

// 5. Rejected thread with is_hidden=true and prior_category preserved — valid
await expectSuccess(
	"rejected thread + is_hidden=true + prior_category='inbox' is valid (lossless restore)",
	`INSERT INTO thread
     (id, connected_account_id, provider_thread_id, screening_state, category,
      prior_category, is_hidden, is_archived, is_trashed, is_read, created_at, updated_at)
   VALUES ('t5', 'ca1', 'provider-t5', 'rejected', NULL,
           'inbox', 1, 0, 0, 0,
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer))`,
);

// 6. Archiving a pending thread — INVALID (archive is accepted-only)
await expectFailure(
	"pending thread + is_archived=true violates CHECK (archive is accepted-only)",
	`INSERT INTO thread
     (id, connected_account_id, provider_thread_id, screening_state, category,
      is_hidden, is_archived, is_trashed, is_read, created_at, updated_at)
   VALUES ('t6', 'ca1', 'provider-t6', 'pending', NULL,
           0, 1, 0, 0,
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer))`,
);

// 7. Trashing a pending/Screener thread — valid (trash allowed on Screener)
await expectSuccess(
	"pending thread + is_trashed=true is valid (trash allowed on Screener threads)",
	`INSERT INTO thread
     (id, connected_account_id, provider_thread_id, screening_state, category,
      is_hidden, is_archived, is_trashed, is_read, created_at, updated_at)
   VALUES ('t7', 'ca1', 'provider-t7', 'pending', NULL,
           0, 0, 1, 0,
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer))`,
);

// 8. handling_state on a pending thread — INVALID (handling_state is accepted-only)
await expectFailure(
	"pending thread + handling_state='set_aside' violates CHECK (handling_state is accepted-only)",
	`INSERT INTO thread
     (id, connected_account_id, provider_thread_id, screening_state, category,
      handling_state, is_hidden, is_archived, is_trashed, is_read, created_at, updated_at)
   VALUES ('t8', 'ca1', 'provider-t8', 'pending', NULL,
           'set_aside', 0, 0, 0, 0,
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer))`,
);

// ---------------------------------------------------------------------------
// Sender routing rule invariant tests
// ---------------------------------------------------------------------------

console.log(
	"\n── Sender Routing Rule invariants ─────────────────────────────────────────",
);

// 9. Accepted rule with default_category — valid
await expectSuccess(
	"accepted routing rule + default_category='inbox' is valid",
	`INSERT INTO sender_routing_rule
     (id, connected_account_id, email_address, screening_decision, default_category,
      decided_at, created_at, updated_at)
   VALUES ('srr1', 'ca1', 'sender@example.com', 'accepted', 'inbox',
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer))`,
);

// 10. Rejected rule with null default_category — valid
await expectSuccess(
	"rejected routing rule + null default_category is valid",
	`INSERT INTO sender_routing_rule
     (id, connected_account_id, email_address, screening_decision, default_category,
      decided_at, created_at, updated_at)
   VALUES ('srr2', 'ca1', 'blocked@example.com', 'rejected', NULL,
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer))`,
);

// 11. Accepted rule with null default_category — INVALID
await expectFailure(
	"accepted routing rule + null default_category violates CHECK",
	`INSERT INTO sender_routing_rule
     (id, connected_account_id, email_address, screening_decision, default_category,
      decided_at, created_at, updated_at)
   VALUES ('srr3', 'ca1', 'bad1@example.com', 'accepted', NULL,
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer))`,
);

// 12. Rejected rule with default_category set — INVALID
await expectFailure(
	"rejected routing rule + default_category='inbox' violates CHECK",
	`INSERT INTO sender_routing_rule
     (id, connected_account_id, email_address, screening_decision, default_category,
      decided_at, created_at, updated_at)
   VALUES ('srr4', 'ca1', 'bad2@example.com', 'rejected', 'inbox',
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer),
           cast(unixepoch('subsecond') * 1000 as integer))`,
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
		"\n✅  All invariants PASSED — schema correctly enforces thread/category/screening rules.",
	);
	process.exit(0);
}
