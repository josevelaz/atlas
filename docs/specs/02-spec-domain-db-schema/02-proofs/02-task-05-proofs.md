# Task 5 Proof Artifact — Integration Mutation Tracking & Final Schema Verification

**Spec:** `02-spec-domain-db-schema.md`  
**Task:** 5.0 — Add integration mutation tracking and final schema verification  
**Date:** 2026-05-27  
**Branch:** `feat/spec-02-domain-db-schema`

---

## Sub-task 5.1 — Schema file for `integration_mutation_journal`

**File created:** `apps/server/src/db/schema/integration_mutation_journal.ts`

The file defines a single `integration_mutation_journal` table covering both write targets:

| Column | Type | Purpose |
|---|---|---|
| `id` | text PK | Row identity |
| `user_id` | text NOT NULL FK→user | Denormalized owner for fast per-user queries |
| `mutation_target` | text enum | `'connected_account'` or `'destination_integration'` |
| `connected_account_id` | text nullable FK→connected_account | Set for mailbox-side writes |
| `destination_integration_id` | text nullable FK→destination_integration | Set for outbound action-item writes |
| `action_item_id` | text nullable FK→action_item | Reconciliation link to triggering action item |
| `mutation_type` | text NOT NULL | Opaque operation descriptor (e.g. `"create_task"`) |
| `idempotency_key` | text NOT NULL | Caller-generated, non-secret, unique per logical op |
| `status` | text enum | `pending \| in_flight \| succeeded \| failed \| abandoned` |
| `attempt_count` | integer | Retry counter |
| `last_attempted_at` | integer timestamp | Most recent attempt |
| `next_attempt_at` | integer timestamp | Retry scheduler hint |
| `provider_response_id` | text | Opaque provider-side ID on success (not a credential) |
| `error_code` | text | Failure code (no secrets) |
| `error_message` | text | Failure detail (no secrets) |
| `mutation_payload_json` | text | Non-sensitive debug payload |
| `succeeded_at` | integer timestamp | When mutation succeeded |
| `abandoned_at` | integer timestamp | When mutation was abandoned |
| `created_at` / `updated_at` | integer timestamps | Standard audit columns |

---

## Sub-task 5.2 — Idempotency, ownership, and reconciliation

### Idempotency

- **Unique index** `imj_idempotency_key_unique` on `(mutation_target, idempotency_key)` prevents duplicate journal rows for the same logical operation.
- Callers check for an existing `succeeded` row before attempting; the unique index prevents concurrent races.
- `idempotency_key` MUST NOT contain provider tokens or secrets — enforced by convention and documented in the schema file header.

### Ownership

- `user_id` FK (cascade delete) roots every entry in the `user` table.
- `connected_account_id` FK (set null on delete) links mailbox-side writes.
- `destination_integration_id` FK (set null on delete) links outbound writes.
- `action_item_id` FK (set null on delete) links the triggering action item.

### Mutual-exclusivity CHECK constraints

```sql
-- mutation_target value set
CHECK("mutation_target" IN ('connected_account', 'destination_integration'))

-- connected_account writes must have connected_account_id
CHECK("mutation_target" != 'connected_account' OR "connected_account_id" IS NOT NULL)

-- destination_integration writes must have destination_integration_id
CHECK("mutation_target" != 'destination_integration' OR "destination_integration_id" IS NOT NULL)

-- exactly one target FK is non-null
CHECK(("connected_account_id" IS NULL) != ("destination_integration_id" IS NULL))
```

### Secret hygiene

- Encrypted tokens live exclusively on `connected_account` and `destination_integration`.
- The journal stores only opaque identifiers (`provider_response_id`, `idempotency_key`) and non-sensitive metadata.
- `error_code` / `error_message` must not contain credential material — documented in schema header.

---

## Sub-task 5.3 — Full schema review against spec requirements

### Spec Unit 4 functional requirements coverage

| Requirement | Covered by |
|---|---|
| Define attachment model for synced messages | `attachment` table (`object_asset.ts`) |
| Store attachment metadata + stable object-storage references | `attachment` + `object_asset` tables |
| Support eager attachment ingestion with partial success | `ingestion_state` enum + nullable `object_asset_id` |
| Explicit attachment ingestion lifecycle state | `ingestion_state`: `pending\|uploaded\|failed\|skipped` |
| Retain raw provider/message payload snapshots via object storage | `raw_payload_ref` + `object_asset` tables |
| Shared object-asset/blob reference concept | `object_asset` table shared by both `attachment` and `raw_payload_ref` |
| Unified `integration_mutation_journal` for outbound writes | `integration_mutation_journal` table (this task) |
| Mutation entries idempotency-aware for safe retries | `idempotency_key` + unique index + status lifecycle |
| Action items reference exactly one destination integration when confirmed | `action_item.destination_integration_id` + CHECK constraint |

### Glossary term preservation (CONTEXT.md)

| Glossary term | Schema representation |
|---|---|
| **Connected Account** (mailbox) | `connected_account` table — distinct from Better Auth `account` |
| **Destination Integration** (outbound target) | `destination_integration` table — distinct from `connected_account` |
| **Screener** (not a category) | `screening_state` column on `thread` — separate from `category` column |
| **Category** (accepted threads only) | `category` nullable; CHECK enforces non-null only when `screening_state = 'accepted'` |
| **Action Item** | `action_item` table with `lifecycle_state` and nullable `destination_integration_id` |
| **Thread Revision** | `thread_revision` table; AI artifacts and embeddings reference it |
| **Handling State** | `handling_state` column on `thread` (accepted threads only) |
| **Read State** | `is_read` column on `thread` |
| **Archive / Trash** | `is_archived` / `is_trashed` columns on `thread` |

### Schema file inventory

| File | Tables |
|---|---|
| `auth.ts` | `user`, `session`, `account`, `verification` |
| `connected_account.ts` | `connected_account` |
| `contact.ts` | `contact`, `email_identity` |
| `destination_integration.ts` | `destination_integration` |
| `sync.ts` | `sync_state`, `sync_job` |
| `thread.ts` | `thread`, `message`, `message_participant` |
| `sender_routing_rule.ts` | `sender_routing_rule` |
| `revision.ts` | `thread_revision` |
| `ai_artifact.ts` | `ai_thread_summary`, `ai_thread_priority` |
| `action_item.ts` | `action_item` |
| `object_asset.ts` | `object_asset`, `raw_payload_ref`, `attachment` |
| `embedding.ts` | `thread_embedding` |
| `integration_mutation_journal.ts` | `integration_mutation_journal` |

**Total: 23 domain + auth tables** (confirmed by `bun run generate` output).

---

## Sub-task 5.4 — Migration review

**Migration file:** `apps/server/drizzle/0004_swift_robbie_robertson.sql`

### Foreign keys present

```sql
FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade
FOREIGN KEY (`connected_account_id`) REFERENCES `connected_account`(`id`) ON DELETE set null
FOREIGN KEY (`destination_integration_id`) REFERENCES `destination_integration`(`id`) ON DELETE set null
FOREIGN KEY (`action_item_id`) REFERENCES `action_item`(`id`) ON DELETE set null
```

### Uniqueness constraint present

```sql
CREATE UNIQUE INDEX `imj_idempotency_key_unique`
  ON `integration_mutation_journal` (`mutation_target`,`idempotency_key`);
```

### All CHECK constraints present

```sql
CONSTRAINT "imj_mutation_target_check" CHECK(...)
CONSTRAINT "imj_connected_account_target_needs_id" CHECK(...)
CONSTRAINT "imj_destination_integration_target_needs_id" CHECK(...)
CONSTRAINT "imj_exactly_one_target" CHECK(...)
CONSTRAINT "imj_status_check" CHECK(...)
```

### Indexes present

```sql
CREATE INDEX `imj_user_id_idx` ON `integration_mutation_journal` (`user_id`);
CREATE INDEX `imj_connected_account_id_idx` ON `integration_mutation_journal` (`connected_account_id`);
CREATE INDEX `imj_destination_integration_id_idx` ON `integration_mutation_journal` (`destination_integration_id`);
CREATE INDEX `imj_action_item_id_idx` ON `integration_mutation_journal` (`action_item_id`);
CREATE INDEX `imj_status_next_attempt_idx` ON `integration_mutation_journal` (`status`,`next_attempt_at`);
CREATE INDEX `imj_user_status_idx` ON `integration_mutation_journal` (`user_id`,`status`);
```

### Prior migration vector/index DDL (Task 4)

`0003_outstanding_mach_iv.sql` contains `thread_embedding` with `blob NOT NULL` column for libSQL vector storage and the planned vector-index comment. The final migration set (0000–0004) is reproducible end-to-end.

---

## Sub-task 5.5 — Verification command output

All commands run from the worktree root (`/Users/jose/projects/hay.worktrees/feat/spec-02-domain-db-schema`).

### `bun run generate`

```
@hay/server:generate: 23 tables
@hay/server:generate: integration_mutation_journal 20 columns 7 indexes 4 fks
@hay/server:generate: [✓] Your SQL migration file ➜ drizzle/0004_swift_robbie_robertson.sql 🚀
Tasks: 1 successful, 1 total
```

**Result: PASS**

### `bun run migrate`

```
@hay/server:migrate: [✓] migrations applied successfully!
Tasks: 1 successful, 1 total
```

**Result: PASS**

### `bun run lint`

```
@hay/server:lint: Checked 29 files in 24ms. No fixes applied.
Tasks: 3 successful, 3 total
```

**Result: PASS**

### `bun run typecheck`

```
@hay/server:typecheck: $ tsc --noEmit
Tasks: 3 successful, 3 total
```

**Result: PASS**

---

## Idempotency / Reconciliation Semantics Validation

The following invariants are enforced at the database level and verified by the migration DDL:

1. **No duplicate journal entries for the same logical operation:**  
   `UNIQUE INDEX imj_idempotency_key_unique ON (mutation_target, idempotency_key)` — a second INSERT with the same key will fail with a unique constraint violation, preventing duplicate mutations.

2. **Exactly one write target per row:**  
   `CHECK (connected_account_id IS NULL) != (destination_integration_id IS NULL)` — SQLite evaluates `IS NULL` as boolean (0/1); `!=` enforces that exactly one is null.

3. **Target type matches FK presence:**  
   Two additional CHECKs ensure `mutation_target = 'connected_account'` implies `connected_account_id IS NOT NULL` and vice versa for destination integrations.

4. **Retry state is queryable:**  
   `INDEX imj_status_next_attempt_idx ON (status, next_attempt_at)` supports efficient retry-scheduler queries for `pending` and `failed` entries.

5. **Action-item reconciliation:**  
   `INDEX imj_action_item_id_idx ON (action_item_id)` supports "find all mutations for this action item" queries needed to mark action items completed after successful mutation.

---

## Reviewer Conclusion

Task 5 is complete. The `integration_mutation_journal` schema file covers both mailbox-side and destination-integration outbound writes in a single typed journal. Idempotency is enforced by a unique index on `(mutation_target, idempotency_key)`. Ownership is rooted in the `user` table with denormalized `user_id` for fast reconciliation. Mutual-exclusivity of write targets is enforced by four CHECK constraints. No provider secrets are stored in the journal — encrypted tokens remain exclusively on `connected_account` and `destination_integration`. The final migration set (0000–0004) is reproducible: `bun run generate`, `bun run migrate`, `bun run lint`, and `bun run typecheck` all pass cleanly. The complete schema covers all 23 tables required by the spec and preserves all glossary terms from `CONTEXT.md`.
