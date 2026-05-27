# Task 02 Proof Artifact — Account, Identity, Integration & Sync Foundation Tables

**Date**: 2026-05-27  
**Verifier**: Shuttle (claude-sonnet-4-6)  
**Status**: ✅ ALL ACCEPTANCE CRITERIA MET — no gaps found, no fixes required

---

## 1. Schema File Inventory

All six required domain tables exist across four schema files:

| Table | File | Lines |
|---|---|---|
| `connected_account` | `apps/server/src/db/schema/connected_account.ts` | 136 |
| `contact` | `apps/server/src/db/schema/contact.ts` | 133 |
| `email_identity` | `apps/server/src/db/schema/contact.ts` | 133 |
| `destination_integration` | `apps/server/src/db/schema/destination_integration.ts` | 120 |
| `sync_state` | `apps/server/src/db/schema/sync.ts` | 176 |
| `sync_job` | `apps/server/src/db/schema/sync.ts` | 176 |

All six are re-exported from `apps/server/src/db/schema/index.ts` (lines 16–25).

---

## 2. Acceptance Criteria Verification

### AC-1: Schema files exist for all six tables ✅

```
apps/server/src/db/schema/
  connected_account.ts   → connectedAccount table
  contact.ts             → contact + emailIdentity tables
  destination_integration.ts → destinationIntegration table
  sync.ts                → syncState + syncJob tables
  index.ts               → barrel re-exports all of the above
```

`bun run generate` output (exit 0):
```
23 tables
connected_account 17 columns 2 indexes 1 fks
contact           5 columns  1 indexes 1 fks
email_identity    7 columns  3 indexes 2 fks
destination_integration 14 columns 2 indexes 1 fks
sync_job          12 columns 2 indexes 1 fks
sync_state        9 columns  1 indexes 1 fks

No schema changes, nothing to migrate 😴
```

---

### AC-2: Ownership rooted in `user` table (foreign keys present) ✅

**`connected_account`** — FK to `user`:
```ts
// connected_account.ts:52-54
userId: text("user_id")
  .notNull()
  .references(() => user.id, { onDelete: "cascade" }),
```

**`contact`** — FK to `user`:
```ts
// contact.ts:43-45
userId: text("user_id")
  .notNull()
  .references(() => user.id, { onDelete: "cascade" }),
```

**`email_identity`** — FK to `user` (and optional FK to `contact`):
```ts
// contact.ts:74-76
userId: text("user_id")
  .notNull()
  .references(() => user.id, { onDelete: "cascade" }),
// contact.ts:80-82
contactId: text("contact_id").references(() => contact.id, {
  onDelete: "set null",
}),
```

**`destination_integration`** — FK to `user`:
```ts
// destination_integration.ts:49-51
userId: text("user_id")
  .notNull()
  .references(() => user.id, { onDelete: "cascade" }),
```

**`sync_state`** — FK to `connected_account` (transitively to `user`):
```ts
// sync.ts:45-47
connectedAccountId: text("connected_account_id")
  .notNull()
  .references(() => connectedAccount.id, { onDelete: "cascade" }),
```

**`sync_job`** — FK to `connected_account` (transitively to `user`):
```ts
// sync.ts:105-107
connectedAccountId: text("connected_account_id")
  .notNull()
  .references(() => connectedAccount.id, { onDelete: "cascade" }),
```

Migration SQL confirmation (`0001_many_captain_flint.sql`):
```sql
FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
-- present in: connected_account, contact, email_identity, destination_integration

FOREIGN KEY (`connected_account_id`) REFERENCES `connected_account`(`id`) ON UPDATE no action ON DELETE cascade
-- present in: sync_state, sync_job
```

---

### AC-3: `connected_account` lifecycle columns + uniqueness constraint ✅

**Lifecycle columns**:
```ts
// connected_account.ts:65-69
status: text("status", {
  enum: ["active", "disconnected", "reactivating", "error"],
}).notNull().default("active"),

// connected_account.ts:98-99
disconnectedAt: integer("disconnected_at", { mode: "timestamp_ms" }),
reactivatedAt:  integer("reactivated_at",  { mode: "timestamp_ms" }),
```

**Uniqueness constraint on (userId, providerAccountEmail)**:
```ts
// connected_account.ts:110-113
uniqueIndex("connected_account_user_email_unique").on(
  table.userId,
  table.providerAccountEmail,
),
```

Migration SQL:
```sql
-- 0001_many_captain_flint.sql:23
CREATE UNIQUE INDEX `connected_account_user_email_unique`
  ON `connected_account` (`user_id`,`provider_account_email`);
```

---

### AC-4: `connected_account` encrypted token fields ✅

All five encryption fields present:
```ts
// connected_account.ts:78-90
encAccessToken:  text("enc_access_token"),
encRefreshToken: text("enc_refresh_token"),
encKeyId:        text("enc_key_id"),
encAlgorithm:    text("enc_algorithm"),
encIv:           text("enc_iv"),
// bonus: accessTokenExpiresAt stored in plaintext for scheduling (not a secret)
accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
```

Migration SQL:
```sql
-- 0001_many_captain_flint.sql:8-13
`enc_access_token`  text,
`enc_refresh_token` text,
`enc_key_id`        text,
`enc_algorithm`     text,
`enc_iv`            text,
```

---

### AC-5: `email_identity` uniqueness per user ✅

```ts
// contact.ts:101-104
uniqueIndex("email_identity_user_email_unique").on(
  table.userId,
  table.emailAddress,
),
```

Migration SQL:
```sql
-- 0001_many_captain_flint.sql:47
CREATE UNIQUE INDEX `email_identity_user_email_unique`
  ON `email_identity` (`user_id`,`email_address`);
```

---

### AC-6: `destination_integration` is distinct from `connected_account` ✅

- Separate table name: `destination_integration` (not `connected_account`)
- Separate file: `destination_integration.ts`
- Different semantic: write-only outbound target vs. mailbox source
- Different uniqueness key: `(user_id, provider, provider_account_id)` vs. `(user_id, provider_account_email)`
- Different status enum: `["active", "disconnected", "error"]` (no `reactivating` — destinations don't have reconnect lifecycle)
- No `disconnectedAt` / `reactivatedAt` lifecycle timestamps (not needed for write targets)

Migration SQL:
```sql
-- 0001_many_captain_flint.sql:50-69
CREATE TABLE `destination_integration` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `provider` text NOT NULL,
  `provider_account_id` text NOT NULL,
  ...
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
  CONSTRAINT "destination_integration_status_check"
    CHECK("destination_integration"."status" IN ('active', 'disconnected', 'error'))
);
CREATE UNIQUE INDEX `destination_integration_user_provider_account_unique`
  ON `destination_integration` (`user_id`,`provider`,`provider_account_id`);
```

---

### AC-7: `sync_state` and `sync_job` are separate tables ✅

**`sync_state`** — current state, updated in-place, one row per connected account:
```ts
// sync.ts:39-93
export const syncState = sqliteTable("sync_state", {
  // one-row-per-account enforced by unique index:
  connectedAccountId: text("connected_account_id").notNull()...
  syncCursor:         text("sync_cursor"),          // resumption cursor
  syncMode:           text("sync_mode", ...),       // "full" | "incremental"
  health:             text("health", ...),           // "ok" | "degraded" | "failed"
  lastSyncedAt:       integer("last_synced_at", ...), // last success
  lastAttemptedAt:    integer("last_attempted_at", ...), // last attempt
  updatedAt:          integer("updated_at", ...).$onUpdate(() => new Date()), // mutable
});
// uniqueIndex("sync_state_connected_account_unique") enforces 1-row-per-account
```

**`sync_job`** — append-only history, no `updatedAt`, rows never mutated:
```ts
// sync.ts:99-158
export const syncJob = sqliteTable("sync_job", {
  connectedAccountId: text("connected_account_id").notNull()...
  jobType:            text("job_type", ...),         // "full" | "incremental" | "partial"
  status:             text("status", ...),            // "running" | "success" | ...
  startedAt:          integer("started_at", ...),
  finishedAt:         integer("finished_at", ...),
  threadsProcessed:   integer("threads_processed"),
  messagesProcessed:  integer("messages_processed"),
  errorsEncountered:  integer("errors_encountered"),
  errorDetail:        text("error_detail"),
  cursorSnapshot:     text("cursor_snapshot"),
  createdAt:          integer("created_at", ...),
  // NOTE: NO updatedAt — rows are append-only, never updated
});
```

Key distinction: `sync_state` has `updatedAt.$onUpdate(...)` (mutable); `sync_job` has only `createdAt` (immutable/append-only).

---

### AC-8: Migration SQL contains expected foreign keys and uniqueness constraints ✅

All constraints verified in `apps/server/drizzle/0001_many_captain_flint.sql`:

| Constraint | SQL |
|---|---|
| `connected_account` → `user` FK | `FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE cascade` |
| `connected_account` unique (userId, email) | `CREATE UNIQUE INDEX connected_account_user_email_unique ON connected_account (user_id, provider_account_email)` |
| `contact` → `user` FK | `FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE cascade` |
| `email_identity` → `user` FK | `FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE cascade` |
| `email_identity` → `contact` FK | `FOREIGN KEY (contact_id) REFERENCES contact(id) ON DELETE set null` |
| `email_identity` unique (userId, email) | `CREATE UNIQUE INDEX email_identity_user_email_unique ON email_identity (user_id, email_address)` |
| `destination_integration` → `user` FK | `FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE cascade` |
| `destination_integration` unique (userId, provider, accountId) | `CREATE UNIQUE INDEX destination_integration_user_provider_account_unique ON destination_integration (user_id, provider, provider_account_id)` |
| `sync_state` → `connected_account` FK | `FOREIGN KEY (connected_account_id) REFERENCES connected_account(id) ON DELETE cascade` |
| `sync_state` unique (connectedAccountId) | `CREATE UNIQUE INDEX sync_state_connected_account_unique ON sync_state (connected_account_id)` |
| `sync_job` → `connected_account` FK | `FOREIGN KEY (connected_account_id) REFERENCES connected_account(id) ON DELETE cascade` |

---

## 3. Reconnect / Reactivation Lifecycle Reasoning

The reconnect/reactivation lifecycle is fully representable without creating a new row:

```
Initial connect:
  INSERT INTO connected_account (status='active', connected_at=now, ...)

User disconnects:
  UPDATE connected_account
    SET status='disconnected', disconnected_at=now
  WHERE id=<id>

User initiates reconnect:
  UPDATE connected_account
    SET status='reactivating'
  WHERE id=<id>

Reconnect completes (token refreshed):
  UPDATE connected_account
    SET status='active', reactivated_at=now,
        enc_access_token=<new_ciphertext>,
        enc_refresh_token=<new_ciphertext>,
        enc_iv=<new_iv>, enc_key_id=<key_id>
  WHERE id=<id>

Sync error during reconnect:
  UPDATE connected_account
    SET status='error'
  WHERE id=<id>
```

All historical threads, messages, and email identities remain associated with the same `connected_account.id` throughout the lifecycle — no orphaning occurs. The `(user_id, provider_account_email)` unique constraint prevents duplicate rows for the same mailbox.

---

## 4. `bun run generate` Output (exit 0)

```
$ cd apps/server && bun run generate
drizzle-kit generate
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
```

**Exit code: 0** ✅

---

## 5. Summary

| AC | Description | Result |
|---|---|---|
| AC-1 | Schema files exist for all 6 tables | ✅ PASS |
| AC-2 | Ownership rooted in `user` table (FKs present) | ✅ PASS |
| AC-3 | `connected_account` lifecycle columns + uniqueness | ✅ PASS |
| AC-4 | `connected_account` encrypted token fields | ✅ PASS |
| AC-5 | `email_identity` uniqueness per user | ✅ PASS |
| AC-6 | `destination_integration` distinct from `connected_account` | ✅ PASS |
| AC-7 | `sync_state` and `sync_job` are separate tables | ✅ PASS |
| AC-8 | Migration SQL has expected FKs and uniqueness constraints | ✅ PASS |

**No schema gaps found. No fixes required. All 8 acceptance criteria pass.**
