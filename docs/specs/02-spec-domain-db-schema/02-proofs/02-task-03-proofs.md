# Task 3 Proof Artifact: Thread, Message, Screening, and Participant Model

**Spec**: `02-spec-domain-db-schema.md` — Unit 2: Thread, Message, and Screening Model  
**Task**: 3.0 Add the thread, message, screening, and participant model  
**Date**: 2026-05-27  
**Status**: ✅ Complete

---

## 1. File Review — Schema Coverage

`apps/server/src/db/schema/` now contains the following Task 3 files:

| File | Tables | Purpose |
|---|---|---|
| `thread.ts` | `thread`, `message`, `message_participant` | Mail conversation model, message history, normalized participants |
| `sender_routing_rule.ts` | `sender_routing_rule` | Screener decision + default category routing per sender per account |

All four tables are scoped to a single `connected_account` via FK with `ON DELETE CASCADE`.

### Schema barrel update

`apps/server/src/db/schema/index.ts` exports the new modules:

```ts
// ── Domain: Thread, Message & Participants (Task 3) ────────────────────────
export * from "./thread.ts";

// ── Domain: Sender Routing Rule (Task 3) ───────────────────────────────────
export * from "./sender_routing_rule.ts";
```

---

## 2. Migration Review — `drizzle/0002_condemned_cobalt_man.sql`

### Unique constraints (provider-native identity per connected account)

```sql
-- Provider thread ID unique per connected account
CREATE UNIQUE INDEX `thread_provider_thread_id_unique`
  ON `thread` (`connected_account_id`, `provider_thread_id`);

-- Provider message ID unique per connected account
CREATE UNIQUE INDEX `message_provider_message_id_unique`
  ON `message` (`connected_account_id`, `provider_message_id`);

-- One routing rule per exact sender email per connected account
CREATE UNIQUE INDEX `sender_routing_rule_account_email_unique`
  ON `sender_routing_rule` (`connected_account_id`, `email_address`);
```

### Screening / category invariant CHECK constraints

```sql
-- category must be null for non-accepted threads; non-null for accepted threads
CONSTRAINT "thread_category_invariant" CHECK((
  ("thread"."screening_state" = 'accepted' AND "thread"."category" IS NOT NULL)
  OR
  ("thread"."screening_state" != 'accepted' AND "thread"."category" IS NULL)
))

-- archive is accepted-only
CONSTRAINT "thread_archive_accepted_only"
  CHECK(("thread"."is_archived" = 0 OR "thread"."screening_state" = 'accepted'))

-- handling_state is accepted-only
CONSTRAINT "thread_handling_state_accepted_only"
  CHECK(("thread"."handling_state" IS NULL OR "thread"."screening_state" = 'accepted'))
```

### Routing rule invariant CHECK constraints

```sql
-- accepted rules must have a default_category; rejected rules must not
CONSTRAINT "sender_routing_rule_category_invariant" CHECK((
  ("sender_routing_rule"."screening_decision" = 'accepted'
    AND "sender_routing_rule"."default_category" IS NOT NULL)
  OR
  ("sender_routing_rule"."screening_decision" = 'rejected'
    AND "sender_routing_rule"."default_category" IS NULL)
))
```

### Indexes for common query shapes

```sql
-- Thread listing for a connected account
CREATE INDEX `thread_connected_account_id_idx` ON `thread` (`connected_account_id`);

-- Category filtering (accepted threads)
CREATE INDEX `thread_connected_account_category_idx`
  ON `thread` (`connected_account_id`, `category`);

-- Screener queue (pending threads)
CREATE INDEX `thread_screening_state_idx`
  ON `thread` (`connected_account_id`, `screening_state`);

-- Initiating sender lookup (routing / screening decisions)
CREATE INDEX `thread_initiating_sender_idx`
  ON `thread` (`initiating_sender_email_identity_id`);

-- Hidden-thread lookup (rejected-sender restore flows)
CREATE INDEX `thread_is_hidden_idx`
  ON `thread` (`connected_account_id`, `is_hidden`);

-- Recent-thread ordering
CREATE INDEX `thread_last_message_at_idx`
  ON `thread` (`connected_account_id`, `last_message_at`);

-- Thread → messages join
CREATE INDEX `message_thread_id_idx` ON `message` (`thread_id`);

-- Chronological message ordering within a thread
CREATE INDEX `message_sent_at_idx` ON `message` (`thread_id`, `sent_at`);

-- Participant lookup by email address (screening / routing)
CREATE INDEX `message_participant_email_address_idx`
  ON `message_participant` (`email_address`);

-- Routing rule lookup by exact sender email per account
CREATE INDEX `sender_routing_rule_account_email_idx`
  ON `sender_routing_rule` (`connected_account_id`, `email_address`);
```

---

## 3. Validation Script Output — Invariant Proof

**Script**: `apps/server/src/db/validate-task-03-invariants.ts`  
**Command**: `TURSO_DATABASE_URL=file:./local.db bun run src/db/validate-task-03-invariants.ts`  
**Database**: in-memory SQLite (migrations applied fresh each run)

```
── Thread / Category / Screening invariants ──────────────────────────────
  ✅  PASS  pending thread + null category is valid
  ✅  PASS  accepted thread + category='inbox' is valid
  ✅  PASS  pending thread + category='inbox' violates CHECK  (constraint correctly rejected the row)
  ✅  PASS  accepted thread + null category violates CHECK  (constraint correctly rejected the row)
  ✅  PASS  rejected thread + is_hidden=true + prior_category='inbox' is valid (lossless restore)
  ✅  PASS  pending thread + is_archived=true violates CHECK (archive is accepted-only)  (constraint correctly rejected the row)
  ✅  PASS  pending thread + is_trashed=true is valid (trash allowed on Screener threads)
  ✅  PASS  pending thread + handling_state='set_aside' violates CHECK (handling_state is accepted-only)  (constraint correctly rejected the row)

── Sender Routing Rule invariants ─────────────────────────────────────────
  ✅  PASS  accepted routing rule + default_category='inbox' is valid
  ✅  PASS  rejected routing rule + null default_category is valid
  ✅  PASS  accepted routing rule + null default_category violates CHECK  (constraint correctly rejected the row)
  ✅  PASS  rejected routing rule + default_category='inbox' violates CHECK  (constraint correctly rejected the row)

── Results ─────────────────────────────────────────────────────────────────
   Passed: 12
   Failed: 0
   Total:  12

✅  All invariants PASSED — schema correctly enforces thread/category/screening rules.
```

**Exit code**: 0

---

## 4. Quality Commands

All commands run from the worktree root (`/Users/jose/projects/hay.worktrees/feat/spec-02-domain-db-schema`).

### `bun run generate`

```
@hay/server:generate: 14 tables
@hay/server:generate: thread 17 columns 7 indexes 2 fks
@hay/server:generate: message 14 columns 4 indexes 2 fks
@hay/server:generate: message_participant 7 columns 3 indexes 2 fks
@hay/server:generate: sender_routing_rule 9 columns 4 indexes 2 fks
@hay/server:generate: [✓] Your SQL migration file ➜ drizzle/0002_condemned_cobalt_man.sql 🚀
Tasks: 1 successful, 1 total
```

### `bun run migrate`

```
@hay/server:migrate: [✓] migrations applied successfully!
Tasks: 1 successful, 1 total
```

### `bun run lint`

```
@hay/server:lint: Checked 21 files in 23ms. No fixes applied.
Tasks: 3 successful, 3 total
```

### `bun run typecheck`

```
@hay/server:typecheck: $ tsc --noEmit
Tasks: 3 successful, 3 total
```

All four commands exit 0.

---

## 5. Invariant Coverage Summary

| Invariant | Enforcement | Verified |
|---|---|---|
| `category` null for pending/rejected threads | DB CHECK `thread_category_invariant` | ✅ test 3 |
| `category` non-null for accepted threads | DB CHECK `thread_category_invariant` | ✅ test 4 |
| Archive only on accepted threads | DB CHECK `thread_archive_accepted_only` | ✅ test 6 |
| Trash allowed on Screener (pending) threads | No constraint (allowed) | ✅ test 7 |
| `handling_state` only on accepted threads | DB CHECK `thread_handling_state_accepted_only` | ✅ test 8 |
| Rejected thread hidden with `prior_category` preserved | No constraint (allowed) | ✅ test 5 |
| Accepted routing rule requires `default_category` | DB CHECK `sender_routing_rule_category_invariant` | ✅ test 11 |
| Rejected routing rule must have null `default_category` | DB CHECK `sender_routing_rule_category_invariant` | ✅ test 12 |
| Provider thread ID unique per connected account | UNIQUE INDEX | Migration SQL |
| Provider message ID unique per connected account | UNIQUE INDEX | Migration SQL |
| One routing rule per sender email per account | UNIQUE INDEX | Migration SQL |
| Initiating sender stored explicitly on thread | FK column `initiating_sender_email_identity_id` | Schema review |
| Participants normalized (not JSON) | `message_participant` table | Schema review |

---

## Reviewer Conclusion

Task 3 is complete. The schema correctly models the Atlas thread/message/screening domain:

- **Screening is separate from Category**: `screening_state` and `category` are independent columns; the `thread_category_invariant` CHECK enforces the nullability contract at the database level.
- **Accepted-only overlays**: Archive and handling state are blocked on non-accepted threads by CHECK constraints; trash is intentionally unrestricted (Screener trash is a product requirement).
- **Lossless restore**: `prior_category` on `thread` preserves the last accepted category when a thread is hidden due to sender rejection, enabling restore without data loss.
- **Initiating sender**: Stored as an explicit FK (`initiating_sender_email_identity_id`) so Screener logic does not need to inspect message participants.
- **Normalized participants**: `message_participant` rows replace JSON recipient arrays, enabling indexed lookups by email address and role.
- **Routing rules**: `sender_routing_rule` encodes the Screener decision (accepted/rejected) and default category at exact-email granularity per connected account, with a CHECK constraint that mirrors the thread category invariant.
- **Migration**: `0002_condemned_cobalt_man.sql` contains all expected unique constraints, CHECK constraints, and indexes. Applied cleanly against a fresh local database.
- **Validation**: 12/12 invariant tests pass with exit code 0.
