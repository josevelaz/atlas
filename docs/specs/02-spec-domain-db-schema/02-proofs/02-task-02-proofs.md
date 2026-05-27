# Task 2.0 Proof Artifact — Account, Identity, Integration, and Sync Foundation Tables

**Spec:** `02-spec-domain-db-schema.md` — Unit 1: Account, Identity, and Integration Foundation  
**Task file:** `02-tasks-domain-db-schema.md` — Task 2.0 (sub-tasks 2.1–2.5)  
**Date:** 2026-05-27  

---

## 1. File Review — Schema Coverage

`apps/server/src/db/schema/` now contains the following domain files (in addition to the pre-existing `auth.ts`):

| File | Tables | Purpose |
|---|---|---|
| `connected_account.ts` | `connected_account` | Atlas mailbox integration; distinct from Better Auth `account` |
| `contact.ts` | `contact`, `email_identity` | User-scoped contacts and exact-email identities |
| `destination_integration.ts` | `destination_integration` | Outbound action-item targets (Google Tasks, etc.) |
| `sync.ts` | `sync_state`, `sync_job` | Durable current sync state vs append-only run history |

The barrel `apps/server/src/db/schema/index.ts` exports all tables in dependency order (auth first, then domain).

### Boundary preservation

Better Auth `account` (in `auth.ts`) and Atlas `connected_account` (in `connected_account.ts`) are **separate tables** with no FK between them. The Better Auth `account` table is managed by the auth layer; `connected_account` is the Atlas domain object that owns threads, sync state, and email identities. This boundary is preserved by design.

---

## 2. Migration Review — Generated SQL Evidence

Migration file: `apps/server/drizzle/0001_many_captain_flint.sql`

### Ownership FKs (all rooted in `user`)

```sql
-- connected_account → user
FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade

-- contact → user
FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade

-- email_identity → user
FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade

-- email_identity → contact (nullable, SET NULL on delete)
FOREIGN KEY (`contact_id`) REFERENCES `contact`(`id`) ON UPDATE no action ON DELETE set null

-- destination_integration → user
FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade

-- sync_state → connected_account
FOREIGN KEY (`connected_account_id`) REFERENCES `connected_account`(`id`) ON UPDATE no action ON DELETE cascade

-- sync_job → connected_account
FOREIGN KEY (`connected_account_id`) REFERENCES `connected_account`(`id`) ON UPDATE no action ON DELETE cascade
```

### Uniqueness constraints

```sql
-- Mailbox identity: same mailbox cannot be connected twice per user
CREATE UNIQUE INDEX `connected_account_user_email_unique`
  ON `connected_account` (`user_id`, `provider_account_email`);

-- Exact-email identity: same email address cannot appear twice per user
CREATE UNIQUE INDEX `email_identity_user_email_unique`
  ON `email_identity` (`user_id`, `email_address`);

-- Destination integration dedupe: same provider account cannot be connected twice per user
CREATE UNIQUE INDEX `destination_integration_user_provider_account_unique`
  ON `destination_integration` (`user_id`, `provider`, `provider_account_id`);

-- sync_state: one current-state row per connected account
CREATE UNIQUE INDEX `sync_state_connected_account_unique`
  ON `sync_state` (`connected_account_id`);
```

### CHECK constraints (lifecycle state enforcement)

```sql
CONSTRAINT "connected_account_status_check"
  CHECK("connected_account"."status" IN ('active', 'disconnected', 'reactivating', 'error'))

CONSTRAINT "destination_integration_status_check"
  CHECK("destination_integration"."status" IN ('active', 'disconnected', 'error'))

CONSTRAINT "sync_state_health_check"
  CHECK("sync_state"."health" IN ('ok', 'degraded', 'failed'))

CONSTRAINT "sync_state_mode_check"
  CHECK("sync_state"."sync_mode" IN ('full', 'incremental'))

CONSTRAINT "sync_job_status_check"
  CHECK("sync_job"."status" IN ('running', 'success', 'partial_success', 'failed', 'cancelled'))

CONSTRAINT "sync_job_type_check"
  CHECK("sync_job"."job_type" IN ('full', 'incremental', 'partial'))
```

### Encrypted token metadata columns on `connected_account`

```sql
`enc_access_token` text,
`enc_refresh_token` text,
`access_token_expires_at` integer,
`enc_key_id` text,
`enc_algorithm` text,
`enc_iv` text,
```

Plaintext tokens are **not** stored. The `enc_key_id` and `enc_algorithm` columns support future key rotation.

---

## 3. Validation Script — Lifecycle and Constraint Proof

**Script:** `apps/server/src/db/validate-task-02.ts`  
**Run:** `bun apps/server/src/db/validate-task-02.ts`  
**Database:** in-memory libSQL (no external services required)

### Output (sanitized — no real credentials or user data)

```
── connected_account ──────────────────────────────────────────
  ✓ connected_account row inserted
  ✓ ownership: userId matches
  ✓ encrypted tokens stored (not plaintext)
  ✓ enc metadata present
  ✓ reactivation: same row updated (no new row created)
  ✓ reactivation: status back to active
  ✓ connected_account: duplicate (user_id, provider_account_email) rejected (constraint correctly rejected)
  ✓ connected_account: invalid status value rejected by CHECK (constraint correctly rejected)

── contact + email_identity ───────────────────────────────────
  ✓ email_identity row inserted
  ✓ email_identity: userId matches
  ✓ email_identity: contactId matches
  ✓ email_identity: duplicate (user_id, email_address) rejected (constraint correctly rejected)
  ✓ email_identity: same email allowed for different user

── destination_integration ────────────────────────────────────
  ✓ destination_integration row inserted
  ✓ destination_integration: userId matches
  ✓ destination_integration: duplicate (user_id, provider, provider_account_id) rejected (constraint correctly rejected)
  ✓ destination_integration: different provider_account_id allowed

── sync_state vs sync_job ─────────────────────────────────────
  ✓ sync_state row inserted
  ✓ sync_state: connectedAccountId matches
  ✓ sync_state: initial cursor is null (full sync required)
  ✓ sync_state: duplicate connected_account_id rejected (constraint correctly rejected)
  ✓ sync_state: cursor updated in-place (same row)
  ✓ sync_state: mode advanced to incremental
  ✓ sync_job: multiple rows for same connected_account (append-only)
  ✓ sync_job: first job is full sync
  ✓ sync_job: second job is incremental sync
  ✓ sync_job: invalid status value rejected by CHECK (constraint correctly rejected)

── cascade delete ─────────────────────────────────────────────
  ✓ cascade: connected_account rows exist before user delete
  ✓ cascade: connected_account rows deleted after user delete
  ✓ cascade: email_identity rows deleted after user delete
  ✓ cascade: destination_integration rows deleted after user delete
  ✓ cascade: sync_state rows deleted after connected_account delete
  ✓ cascade: sync_job rows deleted after connected_account delete

────────────────────────────────────────────────────────────
Results: 33 passed, 0 failed
All assertions passed ✓
```

### What the script proves

| Invariant | Evidence |
|---|---|
| Reconnect/reactivation updates the same row (no new row) | `reactivation: same row updated` + `status back to active` |
| Mailbox uniqueness per user | `duplicate (user_id, provider_account_email) rejected` |
| Invalid lifecycle state rejected at DB level | `invalid status value rejected by CHECK` |
| Exact-email uniqueness per user | `duplicate (user_id, email_address) rejected` |
| Same email allowed for different user | `same email allowed for different user` |
| Destination integration dedupe | `duplicate (user_id, provider, provider_account_id) rejected` |
| sync_state is one-row-per-account (current state) | `duplicate connected_account_id rejected` |
| sync_state updated in-place (cursor advance) | `cursor updated in-place (same row)` |
| sync_job is append-only (multiple rows per account) | `multiple rows for same connected_account` |
| Cascade delete removes all domain rows | 6 cascade assertions |

---

## 4. Quality Commands

All commands run from the repo root in the worktree.

| Command | Result |
|---|---|
| `bun run generate` | ✓ `0001_many_captain_flint.sql` created (10 tables) |
| `bun run migrate` | ✓ `migrations applied successfully!` |
| `bun run lint` | ✓ `Checked 18 files in 21ms. No fixes applied.` |
| `bun run typecheck` | ✓ `3 successful, 3 total` |

---

## 5. Task 1.0 Migration Proof Resolution

Task 1.0 was left with sub-task 1.5 open because the file-layout-only refactor (no DDL change) produced no new migration. Task 2.0 is the first real DDL change on top of the split layout. The successful `bun run generate` → `0001_many_captain_flint.sql` and `bun run migrate` run in this task **resolves the outstanding migration-proof blocker for Task 1.0**. Task 1.5 is now marked `[x]` in the task file.

---

## Reviewer Conclusion

Task 2.0 is complete. All six domain tables (`connected_account`, `contact`, `email_identity`, `destination_integration`, `sync_state`, `sync_job`) are defined in separate schema files with ownership rooted in the Better Auth `user` table. The Better Auth `account` boundary is preserved. Lifecycle states, uniqueness constraints, encrypted token metadata, relations, and indexes are encoded in both the Drizzle schema and the generated migration SQL. A 33-assertion validation script running against an in-memory database confirms that reconnect/reactivation, exact-email uniqueness, destination integration dedupe, sync-state vs sync-job separation, and cascade delete all behave correctly. All four quality commands pass cleanly.
