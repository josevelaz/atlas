# Task 5 Proof Artifact — Integration Mutation Journal & Final Schema Verification

**Date**: 2026-05-27  
**Task**: 5.0 — Add integration mutation tracking and final schema verification  
**Reviewer conclusion**: All 10 acceptance criteria met. Schema package is complete and reproducible.

---

## 1. Schema Excerpts — `integration_mutation_journal.ts`

### 1.1 Idempotency fields

```ts
// Idempotency key — caller-generated, unique per logical operation.
// MUST NOT contain provider secrets or credential material.
idempotencyKey: text("idempotency_key").notNull(),

// Unique index on (mutation_target, idempotency_key) prevents duplicate
// journal entries for the same logical operation.
uniqueIndex("imj_idempotency_key_unique").on(
  table.mutationTarget,
  table.idempotencyKey,
),
```

### 1.2 Ownership fields (denormalized user_id + dual FK targets)

```ts
// Denormalized user_id for fast per-user reconciliation queries.
userId: text("user_id")
  .notNull()
  .references(() => user.id, { onDelete: "cascade" }),

// Discriminator: "connected_account" | "destination_integration"
mutationTarget: text("mutation_target", {
  enum: ["connected_account", "destination_integration"],
}).notNull(),

// FK to connected_account — set for mailbox-side writes.
connectedAccountId: text("connected_account_id").references(
  () => connectedAccount.id,
  { onDelete: "set null" },
),

// FK to destination_integration — set for outbound action-item writes.
destinationIntegrationId: text("destination_integration_id").references(
  () => destinationIntegration.id,
  { onDelete: "set null" },
),
```

### 1.3 Reconciliation link

```ts
// FK to action_item — links destination-integration writes back to the
// action item that triggered them.
actionItemId: text("action_item_id").references(() => actionItem.id, {
  onDelete: "set null",
}),
```

### 1.4 Mutual-exclusivity CHECK constraints

```ts
// connected_account writes must have connected_account_id.
check(
  "imj_connected_account_target_needs_id",
  sql`(${table.mutationTarget} != 'connected_account' OR ${table.connectedAccountId} IS NOT NULL)`,
),

// destination_integration writes must have destination_integration_id.
check(
  "imj_destination_integration_target_needs_id",
  sql`(${table.mutationTarget} != 'destination_integration' OR ${table.destinationIntegrationId} IS NOT NULL)`,
),

// Exactly one target FK is non-null (mutual exclusivity).
check(
  "imj_exactly_one_target",
  sql`(${table.connectedAccountId} IS NULL) != (${table.destinationIntegrationId} IS NULL)`,
),
```

### 1.5 Retry tracking fields

```ts
attemptCount: integer("attempt_count").notNull().default(0),
lastAttemptedAt: integer("last_attempted_at", { mode: "timestamp_ms" }),
nextAttemptAt: integer("next_attempt_at", { mode: "timestamp_ms" }),
```

---

## 2. Migration SQL Excerpts — `0004_swift_robbie_robertson.sql`

### 2.1 Table DDL with all foreign keys and CHECK constraints

```sql
CREATE TABLE `integration_mutation_journal` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `mutation_target` text NOT NULL,
  `connected_account_id` text,
  `destination_integration_id` text,
  `action_item_id` text,
  `mutation_type` text NOT NULL,
  `idempotency_key` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `attempt_count` integer DEFAULT 0 NOT NULL,
  `last_attempted_at` integer,
  `next_attempt_at` integer,
  `provider_response_id` text,
  `error_code` text,
  `error_message` text,
  `mutation_payload_json` text,
  `succeeded_at` integer,
  `abandoned_at` integer,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  `updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`connected_account_id`) REFERENCES `connected_account`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`destination_integration_id`) REFERENCES `destination_integration`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`action_item_id`) REFERENCES `action_item`(`id`) ON UPDATE no action ON DELETE set null,
  CONSTRAINT "imj_mutation_target_check" CHECK("integration_mutation_journal"."mutation_target" IN ('connected_account', 'destination_integration')),
  CONSTRAINT "imj_connected_account_target_needs_id" CHECK(("integration_mutation_journal"."mutation_target" != 'connected_account' OR "integration_mutation_journal"."connected_account_id" IS NOT NULL)),
  CONSTRAINT "imj_destination_integration_target_needs_id" CHECK(("integration_mutation_journal"."mutation_target" != 'destination_integration' OR "integration_mutation_journal"."destination_integration_id" IS NOT NULL)),
  CONSTRAINT "imj_exactly_one_target" CHECK(("integration_mutation_journal"."connected_account_id" IS NULL) != ("integration_mutation_journal"."destination_integration_id" IS NULL)),
  CONSTRAINT "imj_status_check" CHECK("integration_mutation_journal"."status" IN ('pending', 'in_flight', 'succeeded', 'failed', 'abandoned'))
);
```

### 2.2 Journal indexes

```sql
CREATE UNIQUE INDEX `imj_idempotency_key_unique` ON `integration_mutation_journal` (`mutation_target`,`idempotency_key`);
CREATE INDEX `imj_user_id_idx` ON `integration_mutation_journal` (`user_id`);
CREATE INDEX `imj_connected_account_id_idx` ON `integration_mutation_journal` (`connected_account_id`);
CREATE INDEX `imj_destination_integration_id_idx` ON `integration_mutation_journal` (`destination_integration_id`);
CREATE INDEX `imj_action_item_id_idx` ON `integration_mutation_journal` (`action_item_id`);
CREATE INDEX `imj_status_next_attempt_idx` ON `integration_mutation_journal` (`status`,`next_attempt_at`);
CREATE INDEX `imj_user_status_idx` ON `integration_mutation_journal` (`user_id`,`status`);
```

---

## 3. CLI Verification — Full Output

### 3.1 `bun run generate` (from `apps/server/`)

```
$ drizzle-kit generate
No config path provided, using default 'drizzle.config.ts'
Reading config file '/Users/jose/projects/hay/apps/server/drizzle.config.ts'
23 tables
account 13 columns 1 indexes 1 fks
session 8 columns 2 indexes 1 fks
user 7 columns 1 indexes 0 fks
verification 6 columns 1 indexes 0 fks
connected_account 17 columns 2 indexes 1 fks
contact 5 columns 1 indexes 1 fks
email_identity 7 columns 3 indexes 2 fks
destination_integration 14 columns 2 indexes 1 fks
sync_job 12 columns 2 indexes 1 fks
sync_state 9 columns 1 indexes 1 fks
message 14 columns 4 indexes 2 fks
message_participant 7 columns 3 indexes 2 fks
thread 17 columns 7 indexes 2 fks
sender_routing_rule 9 columns 4 indexes 2 fks
thread_revision 6 columns 2 indexes 1 fks
ai_thread_priority 7 columns 2 indexes 2 fks
ai_thread_summary 6 columns 2 indexes 2 fks
action_item 16 columns 4 indexes 3 fks
attachment 12 columns 3 indexes 2 fks
object_asset 8 columns 1 indexes 0 fks
raw_payload_ref 7 columns 2 indexes 3 fks
thread_embedding 8 columns 4 indexes 2 fks
integration_mutation_journal 20 columns 7 indexes 4 fks

No schema changes, nothing to migrate 😴

EXIT: 0
```

### 3.2 `bun run migrate` (from `apps/server/`, fresh DB at `/tmp/test-atlas2.db`)

```
$ drizzle-kit migrate
No config path provided, using default 'drizzle.config.ts'
Reading config file '/Users/jose/projects/hay/apps/server/drizzle.config.ts'
[✓] migrations applied successfully!

EXIT: 0
```

### 3.3 `bun run lint` (from `apps/server/`)

```
$ biome lint ./src
Checked 29 files in 6ms. No fixes applied.

EXIT: 0
```

### 3.4 `bun run typecheck` (from `apps/server/`)

```
$ tsc --noEmit

EXIT: 0
```

---

## 4. Spec Domain Concept → Schema File Mapping

| Spec Domain Concept | Schema File | Table(s) |
|---|---|---|
| `connected_account` | `connected_account.ts` | `connected_account` |
| `contact` | `contact.ts` | `contact` |
| `email_identity` | `contact.ts` | `email_identity` |
| `destination_integration` | `destination_integration.ts` | `destination_integration` |
| `sync_state` | `sync.ts` | `sync_state` |
| `sync_job` | `sync.ts` | `sync_job` |
| `thread` | `thread.ts` | `thread` |
| `message` | `thread.ts` | `message` |
| `message_participant` | `thread.ts` | `message_participant` |
| `sender_routing_rule` | `sender_routing_rule.ts` | `sender_routing_rule` |
| `thread_revision` | `revision.ts` | `thread_revision` |
| `ai_thread_summary` | `ai_artifact.ts` | `ai_thread_summary` |
| `ai_thread_priority` | `ai_artifact.ts` | `ai_thread_priority` |
| `action_item` | `action_item.ts` | `action_item` |
| `embedding` | `embedding.ts` | `thread_embedding` |
| `object_asset` | `object_asset.ts` | `object_asset` |
| `attachment` | `object_asset.ts` | `attachment` |
| `raw_payload_ref` | `object_asset.ts` | `raw_payload_ref` |
| `integration_mutation_journal` | `integration_mutation_journal.ts` | `integration_mutation_journal` |
| Auth tables (Better Auth) | `auth.ts` | `user`, `session`, `account`, `verification` |

**Total domain tables**: 23 (4 auth + 19 domain)  
**Total schema modules**: 13 (1 auth + 12 domain)

---

## 5. Barrel Export Verification — `apps/server/src/db/schema/index.ts`

All 13 modules are exported:

```ts
export * from "./auth.ts";                        // 1 — auth tables
export * from "./connected_account.ts";           // 2 — connected_account
export * from "./contact.ts";                     // 3 — contact, email_identity
export * from "./destination_integration.ts";     // 4 — destination_integration
export * from "./sync.ts";                        // 5 — sync_state, sync_job
export * from "./thread.ts";                      // 6 — thread, message, message_participant
export * from "./sender_routing_rule.ts";         // 7 — sender_routing_rule
export * from "./revision.ts";                    // 8 — thread_revision
export * from "./ai_artifact.ts";                 // 9 — ai_thread_summary, ai_thread_priority
export * from "./action_item.ts";                 // 10 — action_item
export * from "./object_asset.ts";                // 11 — object_asset, raw_payload_ref, attachment
export * from "./embedding.ts";                   // 12 — thread_embedding
export * from "./integration_mutation_journal.ts"; // 13 — integration_mutation_journal
```

---

## 6. Acceptance Criteria Checklist

| # | Criterion | Status |
|---|---|---|
| 1 | `integration_mutation_journal` schema file exists with typed mutation metadata | ✅ `apps/server/src/db/schema/integration_mutation_journal.ts` — 20 columns, typed enums for `mutation_target` and `status` |
| 2 | Journal supports both mailbox (connected_account) and destination-integration outbound writes | ✅ `mutation_target` discriminator + dual nullable FKs (`connected_account_id`, `destination_integration_id`) with mutual-exclusivity CHECK |
| 3 | Idempotency fields exist | ✅ `idempotency_key` column + `UNIQUE INDEX imj_idempotency_key_unique ON (mutation_target, idempotency_key)` |
| 4 | Ownership and reconciliation relationships present | ✅ `user_id` FK (ownership), `connected_account_id` FK, `destination_integration_id` FK, `action_item_id` FK (reconciliation) |
| 5 | All 13 schema modules exported from barrel | ✅ Verified in `index.ts` — 13 `export *` statements |
| 6 | All spec domain concepts covered | ✅ All 19 domain concepts + 4 auth tables mapped in §4 above |
| 7 | `bun run generate` exits 0 | ✅ "No schema changes, nothing to migrate 😴" — exit 0 |
| 8 | `bun run migrate` exits 0 against fresh DB | ✅ "migrations applied successfully!" — exit 0 |
| 9 | `bun run lint` exits 0 | ✅ "Checked 29 files in 6ms. No fixes applied." — exit 0 |
| 10 | `bun run typecheck` exits 0 | ✅ No output, exit 0 |

---

## 7. Reviewer Conclusion

The full schema package is **complete and reproducible**:

- All 23 tables (4 auth + 19 domain) are defined across 13 schema modules.
- The `integration_mutation_journal` table correctly models both mailbox-side and destination-integration outbound writes with mutual-exclusivity enforced at the DB level via CHECK constraints.
- Idempotency is enforced by a unique index on `(mutation_target, idempotency_key)`.
- Ownership is denormalized via `user_id` FK for fast per-user reconciliation; reconciliation links to `connected_account`, `destination_integration`, and `action_item` are all present as nullable FKs.
- No schema drift: `bun run generate` reports "nothing to migrate" confirming the committed migration files exactly match the Drizzle schema definitions.
- All 4 verification commands exit 0 against a fresh database.
- No provider secrets, tokens, or credentials appear in any schema column or proof artifact.
