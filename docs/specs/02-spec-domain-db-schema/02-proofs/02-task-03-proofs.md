# Task 03 Proof Artifact — Thread, Message, Screening & Participant Schema

**Date**: 2026-05-27  
**Verifier**: Shuttle (claude-sonnet-4-6)  
**Status**: ✅ ALL ACCEPTANCE CRITERIA MET — no gaps found, no fixes required

---

## 1. Schema File Inventory

All required domain tables exist across two schema files:

| Table | File | Lines |
|---|---|---|
| `thread` | `apps/server/src/db/schema/thread.ts` | 460 |
| `message` | `apps/server/src/db/schema/thread.ts` | 460 |
| `message_participant` | `apps/server/src/db/schema/thread.ts` | 460 |
| `sender_routing_rule` | `apps/server/src/db/schema/sender_routing_rule.ts` | 167 |

All are re-exported from `apps/server/src/db/schema/index.ts` (lines 27–31).

---

## 2. Acceptance Criteria Verification

### AC-1: `thread` and `message` tables exist, scoped to a single `connected_account` ✅

**`thread`** — FK to `connected_account`:
```ts
// thread.ts:88-90
connectedAccountId: text("connected_account_id")
  .notNull()
  .references(() => connectedAccount.id, { onDelete: "cascade" }),
```

**`message`** — FK to `connected_account`:
```ts
// thread.ts:280-282
connectedAccountId: text("connected_account_id")
  .notNull()
  .references(() => connectedAccount.id, { onDelete: "cascade" }),
```

Migration SQL (`0002_condemned_cobalt_man.sql`):
```sql
-- thread table
FOREIGN KEY (`connected_account_id`) REFERENCES `connected_account`(`id`) ON UPDATE no action ON DELETE cascade

-- message table
FOREIGN KEY (`connected_account_id`) REFERENCES `connected_account`(`id`) ON UPDATE no action ON DELETE cascade
```

---

### AC-2: Provider thread ID unique per connected account; provider message ID unique per connected account ✅

**`thread`** — unique index on `(connected_account_id, provider_thread_id)`:
```ts
// thread.ts:185-188
uniqueIndex("thread_provider_thread_id_unique").on(
  table.connectedAccountId,
  table.providerThreadId,
),
```

**`message`** — unique index on `(connected_account_id, provider_message_id)`:
```ts
// thread.ts:332-335
uniqueIndex("message_provider_message_id_unique").on(
  table.connectedAccountId,
  table.providerMessageId,
),
```

Migration SQL (`0002_condemned_cobalt_man.sql`):
```sql
CREATE UNIQUE INDEX `thread_provider_thread_id_unique`
  ON `thread` (`connected_account_id`,`provider_thread_id`);

CREATE UNIQUE INDEX `message_provider_message_id_unique`
  ON `message` (`connected_account_id`,`provider_message_id`);
```

---

### AC-3: `screening_state` is separate from `category` (two distinct columns) ✅

Both columns exist independently on the `thread` table:

```ts
// thread.ts:100-112
screeningState: text("screening_state", {
  enum: ["pending", "accepted", "rejected"],
})
  .notNull()
  .default("pending"),

// category — null until accepted; required once accepted
category: text("category", {
  enum: ["inbox", "feed", "paper_trail"],
}),
```

Migration SQL (`0002_condemned_cobalt_man.sql`):
```sql
`screening_state` text DEFAULT 'pending' NOT NULL,
`category` text,
```

These are two distinct columns — `screening_state` is NOT NULL with a default, while `category` is nullable. They serve different semantic roles: `screening_state` tracks the Screener decision lifecycle; `category` tracks the inbox routing destination.

---

### AC-4: `category` is nullable (null for pending/rejected threads, required for accepted threads) ✅

```ts
// thread.ts:110-112
category: text("category", {
  enum: ["inbox", "feed", "paper_trail"],
}),
// No .notNull() — column is nullable by default
```

Migration SQL:
```sql
`category` text,
-- No NOT NULL constraint — nullable
```

The column has no `NOT NULL` constraint, making it nullable. The CHECK constraint (AC-5) enforces when it must be null vs. non-null.

---

### AC-5: CHECK constraint enforces category must be null when screening_state is pending/rejected, and non-null when accepted ✅

```ts
// thread.ts:193-200
check(
  "thread_category_invariant",
  sql`(
    (${table.screeningState} = 'accepted' AND ${table.category} IS NOT NULL)
    OR
    (${table.screeningState} != 'accepted' AND ${table.category} IS NULL)
  )`,
),
```

Migration SQL (`0002_condemned_cobalt_man.sql`):
```sql
CONSTRAINT "thread_category_invariant" CHECK((
    ("thread"."screening_state" = 'accepted' AND "thread"."category" IS NOT NULL)
    OR
    ("thread"."screening_state" != 'accepted' AND "thread"."category" IS NULL)
  )),
```

**Focused validation**: This constraint has two branches:
1. `screening_state = 'accepted' AND category IS NOT NULL` — accepted threads MUST have a category
2. `screening_state != 'accepted' AND category IS NULL` — pending/rejected threads MUST have null category

Any row violating either branch is rejected at the DB level. The constraint name `thread_category_invariant` makes its purpose self-documenting.

---

### AC-6: `thread` stores the initiating sender explicitly ✅

```ts
// thread.ts:125-127
initiatingSenderEmailIdentityId: text(
  "initiating_sender_email_identity_id",
).references(() => emailIdentity.id, { onDelete: "set null" }),
```

Migration SQL:
```sql
`initiating_sender_email_identity_id` text,
FOREIGN KEY (`initiating_sender_email_identity_id`)
  REFERENCES `email_identity`(`id`) ON UPDATE no action ON DELETE set null,
```

The column is nullable (null only if identity has not yet been resolved during sync). The FK references `email_identity` — the exact email address that started the thread. This avoids needing to inspect `message_participant` rows to determine thread origin.

---

### AC-7: `is_hidden` flag exists for rejected-sender threads; `prior_category` exists for lossless restore ✅

**`is_hidden`**:
```ts
// thread.ts:133-135
isHidden: integer("is_hidden", { mode: "boolean" })
  .notNull()
  .default(false),
```

**`prior_category`**:
```ts
// thread.ts:116-118
priorCategory: text("prior_category", {
  enum: ["inbox", "feed", "paper_trail"],
}),
```

Migration SQL:
```sql
`is_hidden` integer DEFAULT false NOT NULL,
`prior_category` text,
```

`prior_category` is preserved when a previously accepted thread is hidden due to sender rejection. If the sender is later accepted, the thread can be restored to its prior category without data loss. Null for threads that were never accepted before being rejected.

---

### AC-8: `is_archived` is limited to accepted threads (CHECK constraint); `is_trashed` is allowed on any thread ✅

**`is_archived`** — CHECK constraint enforces accepted-only:
```ts
// thread.ts:138-140 (column)
isArchived: integer("is_archived", { mode: "boolean" })
  .notNull()
  .default(false),

// thread.ts:202-205 (constraint)
check(
  "thread_archive_accepted_only",
  sql`(${table.isArchived} = 0 OR ${table.screeningState} = 'accepted')`,
),
```

**`is_trashed`** — no accepted-only constraint (allowed on any thread):
```ts
// thread.ts:143-145
isTrashed: integer("is_trashed", { mode: "boolean" })
  .notNull()
  .default(false),
// No CHECK constraint — valid on accepted AND pending/Screener threads
```

Migration SQL:
```sql
CONSTRAINT "thread_archive_accepted_only"
  CHECK(("thread"."is_archived" = 0 OR "thread"."screening_state" = 'accepted')),
-- No constraint on is_trashed — intentionally unrestricted
```

The `thread_archive_accepted_only` constraint reads: "is_archived can only be true (1) when screening_state is 'accepted'". `is_trashed` has no such restriction per spec ("Trash on Screener threads is allowed").

---

### AC-9: Normalized participant tables exist (not just JSON arrays) ✅

`message_participant` is a fully normalized table with one row per participant per message:

```ts
// thread.ts:372-422
export const messageParticipant = sqliteTable(
  "message_participant",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id").notNull().references(() => message.id, { onDelete: "cascade" }),
    role: text("role", {
      enum: ["from", "to", "cc", "bcc", "reply_to"],
    }).notNull(),
    emailAddress: text("email_address").notNull(),
    displayName: text("display_name"),
    emailIdentityId: text("email_identity_id").references(
      () => emailIdentity.id,
      { onDelete: "set null" },
    ),
    createdAt: integer("created_at", { mode: "timestamp_ms" })...
  },
  ...
);
```

Migration SQL (`0002_condemned_cobalt_man.sql`):
```sql
CREATE TABLE `message_participant` (
  `id` text PRIMARY KEY NOT NULL,
  `message_id` text NOT NULL,
  `role` text NOT NULL,
  `email_address` text NOT NULL,
  `display_name` text,
  `email_identity_id` text,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  FOREIGN KEY (`message_id`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`email_identity_id`) REFERENCES `email_identity`(`id`) ON UPDATE no action ON DELETE set null,
  CONSTRAINT "message_participant_role_check"
    CHECK("message_participant"."role" IN ('from', 'to', 'cc', 'bcc', 'reply_to'))
);
```

No JSON arrays — each participant (from, to, cc, bcc, reply-to) gets its own row, enabling indexed lookups by email address and role.

---

### AC-10: `sender_routing_rule` table exists, keyed by exact sender email per connected account ✅

```ts
// sender_routing_rule.ts:47-98
export const senderRoutingRule = sqliteTable(
  "sender_routing_rule",
  {
    id: text("id").primaryKey(),
    connectedAccountId: text("connected_account_id").notNull()
      .references(() => connectedAccount.id, { onDelete: "cascade" }),
    emailAddress: text("email_address").notNull(),
    screeningDecision: text("screening_decision", {
      enum: ["accepted", "rejected"],
    }).notNull(),
    defaultCategory: text("default_category", {
      enum: ["inbox", "feed", "paper_trail"],
    }),
    ...
  },
  (table) => [
    uniqueIndex("sender_routing_rule_account_email_unique").on(
      table.connectedAccountId,
      table.emailAddress,
    ),
    ...
  ],
);
```

Migration SQL (`0002_condemned_cobalt_man.sql`):
```sql
CREATE TABLE `sender_routing_rule` (
  `id` text PRIMARY KEY NOT NULL,
  `connected_account_id` text NOT NULL,
  `email_address` text NOT NULL,
  ...
  CONSTRAINT "sender_routing_rule_category_invariant" CHECK((
      ("sender_routing_rule"."screening_decision" = 'accepted'
        AND "sender_routing_rule"."default_category" IS NOT NULL)
      OR
      ("sender_routing_rule"."screening_decision" = 'rejected'
        AND "sender_routing_rule"."default_category" IS NULL)
    )),
  ...
);
CREATE UNIQUE INDEX `sender_routing_rule_account_email_unique`
  ON `sender_routing_rule` (`connected_account_id`,`email_address`);
```

Keyed by `(connected_account_id, email_address)` — exact-email granularity within a connected account. One rule per sender per account enforced by unique index.

---

### AC-11: Migration SQL contains indexes for screening/category/routing lookups ✅

All required indexes present in `0002_condemned_cobalt_man.sql`:

**Thread screening/category indexes**:
```sql
-- Category filtering within a connected account (accepted threads)
CREATE INDEX `thread_connected_account_category_idx`
  ON `thread` (`connected_account_id`,`category`);

-- Screening queue lookup (pending threads for a connected account)
CREATE INDEX `thread_screening_state_idx`
  ON `thread` (`connected_account_id`,`screening_state`);

-- Initiating sender lookup (for routing and screening decisions)
CREATE INDEX `thread_initiating_sender_idx`
  ON `thread` (`initiating_sender_email_identity_id`);

-- Hidden-thread lookup (for rejected-sender restore flows)
CREATE INDEX `thread_is_hidden_idx`
  ON `thread` (`connected_account_id`,`is_hidden`);

-- Recent-thread ordering within a connected account
CREATE INDEX `thread_last_message_at_idx`
  ON `thread` (`connected_account_id`,`last_message_at`);
```

**Routing rule lookup indexes**:
```sql
-- Primary Screener lookup: given a connected account + sender email
CREATE INDEX `sender_routing_rule_account_email_idx`
  ON `sender_routing_rule` (`connected_account_id`,`email_address`);

-- All routing rules for a connected account
CREATE INDEX `sender_routing_rule_connected_account_id_idx`
  ON `sender_routing_rule` (`connected_account_id`);

-- Lookup by resolved email identity
CREATE INDEX `sender_routing_rule_email_identity_id_idx`
  ON `sender_routing_rule` (`email_identity_id`);
```

**Message participant lookup indexes**:
```sql
-- All participants for a message
CREATE INDEX `message_participant_message_id_idx`
  ON `message_participant` (`message_id`);

-- Lookup by email address (for screening / routing lookups)
CREATE INDEX `message_participant_email_address_idx`
  ON `message_participant` (`email_address`);

-- Lookup by resolved email identity
CREATE INDEX `message_participant_email_identity_id_idx`
  ON `message_participant` (`email_identity_id`);
```

---

## 3. `bun run generate` Output (exit 0)

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

## 4. Summary

| AC | Description | Result |
|---|---|---|
| AC-1 | `thread` and `message` scoped to single `connected_account` | ✅ PASS |
| AC-2 | Provider thread ID unique per account; provider message ID unique per account | ✅ PASS |
| AC-3 | `screening_state` and `category` are two distinct columns | ✅ PASS |
| AC-4 | `category` is nullable (no NOT NULL constraint) | ✅ PASS |
| AC-5 | CHECK constraint `thread_category_invariant` enforces accepted↔category invariant | ✅ PASS |
| AC-6 | `initiating_sender_email_identity_id` stored explicitly on `thread` | ✅ PASS |
| AC-7 | `is_hidden` and `prior_category` exist for rejected-sender lossless restore | ✅ PASS |
| AC-8 | `is_archived` CHECK-constrained to accepted threads; `is_trashed` unrestricted | ✅ PASS |
| AC-9 | Normalized `message_participant` table (not JSON arrays) | ✅ PASS |
| AC-10 | `sender_routing_rule` keyed by exact sender email per connected account | ✅ PASS |
| AC-11 | Migration SQL contains indexes for screening/category/routing lookups | ✅ PASS |

**No schema gaps found. No fixes required. All 11 acceptance criteria pass.**
