# Task 04 Proof Artifact — Revision-Aware AI, Action Items, Attachments & Assets

**Date**: 2026-05-27  
**Schema files verified**: `revision.ts`, `ai_artifact.ts`, `action_item.ts`, `embedding.ts`, `object_asset.ts`  
**Migration files verified**: `0003_outstanding_mach_iv.sql`, `0005_pr23-constraint-fixes.sql`  
**`bun run generate` exit code**: 0 (no schema changes — schema matches migrations)

---

## Acceptance Criteria Verification

### ✅ AC-1 — `thread_revision` table with explicit revision concept

`thread_revision` advances only when effective content changes (new message or material re-parse). Atlas-only overlay changes (read state, category, archive, trash, handling, screening) do **not** advance the revision counter.

```ts
// apps/server/src/db/schema/revision.ts
export const threadRevision = sqliteTable(
  "thread_revision",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id").notNull().references(() => thread.id, { onDelete: "cascade" }),
    // Monotonically increasing, scoped to thread. First revision = 1.
    revisionNumber: integer("revision_number").notNull(),
    // SHA-256 of effective content — used to detect whether re-parse changed content.
    contentHash: text("content_hash").notNull(),
    // e.g. "new_message" | "reparse_content_changed"
    changeReason: text("change_reason"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
  },
  (table) => [
    // revision_number must be positive (first revision is 1)
    check("thread_revision_number_positive", sql`${table.revisionNumber} > 0`),
    // Unique per thread
    uniqueIndex("thread_revision_thread_revision_number_unique").on(
      table.threadId, table.revisionNumber,
    ),
    index("thread_revision_thread_id_idx").on(table.threadId),
  ],
);
```

Migration SQL (`0003_outstanding_mach_iv.sql`, line 1–11):
```sql
CREATE TABLE `thread_revision` (
  `id` text PRIMARY KEY NOT NULL,
  `thread_id` text NOT NULL,
  `revision_number` integer NOT NULL,
  `content_hash` text NOT NULL,
  `change_reason` text,
  `created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
  FOREIGN KEY (`thread_id`) REFERENCES `thread`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `thread_revision_thread_revision_number_unique` ON `thread_revision` (`thread_id`,`revision_number`);
```

---

### ✅ AC-2 — AI summary and AI priority tied to source revisions

Both `ai_thread_summary` and `ai_thread_priority` carry a non-nullable `thread_revision_id` FK — they are derived from a specific revision, not from mutable thread columns.

```ts
// apps/server/src/db/schema/ai_artifact.ts

// ai_thread_summary
threadRevisionId: text("thread_revision_id")
  .notNull()
  .references(() => threadRevision.id, { onDelete: "cascade" }),

// ai_thread_priority
threadRevisionId: text("thread_revision_id")
  .notNull()
  .references(() => threadRevision.id, { onDelete: "cascade" }),
```

Unique indexes enforce at-most-one artifact per (thread, revision):
```sql
-- ai_thread_summary
CREATE UNIQUE INDEX `ai_thread_summary_thread_revision_unique`
  ON `ai_thread_summary` (`thread_id`,`thread_revision_id`);

-- ai_thread_priority
CREATE UNIQUE INDEX `ai_thread_priority_thread_revision_unique`
  ON `ai_thread_priority` (`thread_id`,`thread_revision_id`);
```

---

### ✅ AC-3 — AI priority uses semantic levels `low|medium|high`

```ts
// apps/server/src/db/schema/ai_artifact.ts
priorityLevel: text("priority_level", {
  enum: ["low", "medium", "high"],
}).notNull(),
```

Enforced by CHECK constraint in migration SQL:
```sql
CONSTRAINT "ai_thread_priority_level_check"
  CHECK("ai_thread_priority"."priority_level" IN ('low', 'medium', 'high'))
```

No numeric ordinals — semantic labels only.

---

### ✅ AC-4 — `action_item` has lifecycle state, source revision provenance, and nullable destination integration

```ts
// apps/server/src/db/schema/action_item.ts

// Explicit lifecycle state
lifecycleState: text("lifecycle_state", {
  enum: ["pending", "confirmed", "dismissed", "completed"],
}).notNull().default("pending"),

// Source revision provenance (SET NULL on delete — item survives revision removal)
sourceRevisionId: text("source_revision_id").references(
  () => threadRevision.id,
  { onDelete: "set null" },
),

// Nullable destination integration (null until confirmed)
destinationIntegrationId: text("destination_integration_id").references(
  () => destinationIntegration.id,
  { onDelete: "set null" },
),
```

Migration SQL (`0003_outstanding_mach_iv.sql`, lines 41–68):
```sql
CREATE TABLE `action_item` (
  `source_revision_id` text,          -- nullable, SET NULL on delete
  `lifecycle_state` text DEFAULT 'pending' NOT NULL,
  `destination_integration_id` text,  -- nullable until confirmed
  FOREIGN KEY (`source_revision_id`) REFERENCES `thread_revision`(`id`)
    ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`destination_integration_id`) REFERENCES `destination_integration`(`id`)
    ON UPDATE no action ON DELETE set null,
  CONSTRAINT "action_item_lifecycle_state_check"
    CHECK("action_item"."lifecycle_state" IN ('pending', 'confirmed', 'dismissed', 'completed')),
  CONSTRAINT "action_item_confirmed_needs_destination"
    CHECK(("action_item"."lifecycle_state" != 'confirmed'
           OR "action_item"."destination_integration_id" IS NOT NULL))
);
```

---

### ✅ AC-5 — Dismissed items retained; confirmed items survive later revisions

**Dismissed items retained**: `lifecycle_state = 'dismissed'` is a terminal state with no cascade delete. `dismissedAt` timestamp is recorded. Items are never deleted on dismissal.

**Confirmed items survive later revisions**: `sourceRevisionId` uses `SET NULL` on delete (not `CASCADE`). A new revision being created does not delete confirmed action items — they remain with their `sourceRevisionId` intact (or nulled only if the specific revision row is deleted, which is unusual).

```ts
// SET NULL — item is retained even if the source revision row is removed
sourceRevisionId: text("source_revision_id").references(
  () => threadRevision.id,
  { onDelete: "set null" },  // ← not "cascade"
),

// Lifecycle timestamps preserved
confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
dismissedAt: integer("dismissed_at", { mode: "timestamp_ms" }),
completedAt: integer("completed_at", { mode: "timestamp_ms" }),
```

---

### ✅ AC-6 — `object_asset` table as shared blob reference concept

```ts
// apps/server/src/db/schema/object_asset.ts
export const objectAsset = sqliteTable("object_asset", {
  id: text("id").primaryKey(),
  bucket: text("bucket").notNull(),
  objectKey: text("object_key").notNull(),   // stable key, never a signed URL
  contentType: text("content_type"),
  byteSize: integer("byte_size"),
  checksum: text("checksum"),
  storageProvider: text("storage_provider"), // "s3" | "r2" | "gcs"
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
});
```

Used by both `attachment` (via `object_asset_id` FK) and `raw_payload_ref` (via `object_asset_id` FK) — shared blob reference concept confirmed.

---

### ✅ AC-7 — Attachment table with ingestion lifecycle state

```ts
// apps/server/src/db/schema/object_asset.ts
export const attachment = sqliteTable("attachment", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull().references(() => message.id, { onDelete: "cascade" }),
  filename: text("filename"),
  contentType: text("content_type"),
  byteSize: integer("byte_size"),
  providerAttachmentId: text("provider_attachment_id"),
  // Ingestion lifecycle — separate from message sync state
  ingestionState: text("ingestion_state", {
    enum: ["pending", "uploaded", "failed", "skipped"],
  }).notNull().default("pending"),
  // Nullable until upload succeeds
  objectAssetId: text("object_asset_id").references(() => objectAsset.id, { onDelete: "set null" }),
  ingestionError: text("ingestion_error"),
  uploadedAt: integer("uploaded_at", { mode: "timestamp_ms" }),
  ...
});
```

Ingestion states: `pending → uploaded | failed | skipped`. Separate from message sync state.

---

### ✅ AC-8 — Attachment failures do not invalidate parent message

`objectAssetId` is **nullable** — it is `null` when `ingestion_state` is `pending`, `failed`, or `skipped`. The parent `message` row is unaffected by attachment ingestion state.

```sql
-- From 0005_pr23-constraint-fixes.sql
`object_asset_id` text,   -- nullable FK
FOREIGN KEY (`object_asset_id`) REFERENCES `object_asset`(`id`)
  ON UPDATE no action ON DELETE set null,
CONSTRAINT "attachment_uploaded_needs_asset"
  CHECK(("__new_attachment"."ingestion_state" != 'uploaded'
         OR "__new_attachment"."object_asset_id" IS NOT NULL))
```

A failed attachment has `ingestion_state = 'failed'` and `object_asset_id = NULL`. The parent `message` row remains valid and fully accessible.

**Focused validation — action items with null `destination_integration_id`**:

The CHECK constraint `action_item_confirmed_needs_destination` only requires `destination_integration_id IS NOT NULL` when `lifecycle_state = 'confirmed'`. For `pending`, `dismissed`, and `completed` states, `destination_integration_id` may be `NULL`:

```sql
CONSTRAINT "action_item_confirmed_needs_destination"
  CHECK(("action_item"."lifecycle_state" != 'confirmed'
         OR "action_item"."destination_integration_id" IS NOT NULL))
-- Equivalent: lifecycle_state IN ('pending','dismissed','completed') → destination_integration_id may be NULL ✓
```

---

### ✅ AC-9 — Embedding table with libSQL-compatible vector storage

```ts
// apps/server/src/db/schema/embedding.ts
export const threadEmbedding = sqliteTable("thread_embedding", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull().references(() => thread.id, { onDelete: "cascade" }),
  threadRevisionId: text("thread_revision_id").notNull()
    .references(() => threadRevision.id, { onDelete: "cascade" }),
  // Float32Array stored as raw binary blob — libSQL stores as F32_BLOB(N)
  embedding: blob("embedding", { mode: "buffer" }).notNull(),
  embeddingDimension: integer("embedding_dimension").notNull(),
  embeddingModel: text("embedding_model").notNull(),
  isSearchExcluded: integer("is_search_excluded", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
});
```

Migration SQL vector storage column (`0005_pr23-constraint-fixes.sql`, line 69):
```sql
`embedding` blob NOT NULL,
`embedding_dimension` integer NOT NULL,
`embedding_model` text NOT NULL,
FOREIGN KEY (`thread_revision_id`) REFERENCES `thread_revision`(`id`)
  ON UPDATE no action ON DELETE cascade,
CONSTRAINT "thread_embedding_dimension_positive"
  CHECK("__new_thread_embedding"."embedding_dimension" > 0)
```

Planned libSQL vector index DDL (deferred — requires libSQL ≥ 0.4 runtime):
```sql
CREATE INDEX thread_embedding_vector_idx
  ON thread_embedding (libsql_vector_idx(embedding));
```

---

### ✅ AC-10 — Migration SQL contains source-revision relationships and attachment/object-asset FKs

**Source-revision FK in `action_item`** (`0003_outstanding_mach_iv.sql`):
```sql
FOREIGN KEY (`source_revision_id`) REFERENCES `thread_revision`(`id`)
  ON UPDATE no action ON DELETE set null
```

**Source-revision FK in `thread_embedding`** (`0003_outstanding_mach_iv.sql`):
```sql
FOREIGN KEY (`thread_revision_id`) REFERENCES `thread_revision`(`id`)
  ON UPDATE no action ON DELETE cascade
```

**Attachment → object_asset FK** (`0005_pr23-constraint-fixes.sql`):
```sql
FOREIGN KEY (`object_asset_id`) REFERENCES `object_asset`(`id`)
  ON UPDATE no action ON DELETE set null
```

**raw_payload_ref → object_asset FK** (`0005_pr23-constraint-fixes.sql`):
```sql
FOREIGN KEY (`object_asset_id`) REFERENCES `object_asset`(`id`)
  ON UPDATE no action ON DELETE restrict
```

---

## `bun run generate` Verification

```text
$ cd apps/server && bun run generate
drizzle-kit generate
No config path provided, using default 'drizzle.config.ts'
Reading config file '/Users/jose/projects/hay/apps/server/drizzle.config.ts'
23 tables
thread_revision 6 columns 2 indexes 1 fks
ai_thread_priority 7 columns 2 indexes 2 fks
ai_thread_summary 6 columns 2 indexes 2 fks
action_item 16 columns 4 indexes 3 fks
attachment 12 columns 3 indexes 2 fks
object_asset 8 columns 1 indexes 0 fks
raw_payload_ref 7 columns 2 indexes 3 fks
thread_embedding 8 columns 4 indexes 2 fks
... (15 other tables)

No schema changes, nothing to migrate 😴
EXIT: 0
```

Schema is fully in sync with migrations. No gaps found. No implementation changes required.

---

## Summary

| # | Criterion | Status |
|---|-----------|--------|
| 1 | `thread_revision` with explicit revision concept | ✅ PASS |
| 2 | AI artifacts tied to source revisions | ✅ PASS |
| 3 | AI priority uses `low\|medium\|high` semantic levels | ✅ PASS |
| 4 | `action_item` lifecycle state + source revision + nullable destination | ✅ PASS |
| 5 | Dismissed retained; confirmed survive later revisions | ✅ PASS |
| 6 | `object_asset` shared blob reference table | ✅ PASS |
| 7 | Attachment table with ingestion lifecycle state | ✅ PASS |
| 8 | Attachment failures independent of parent message | ✅ PASS |
| 9 | Embedding table with libSQL-compatible vector storage | ✅ PASS |
| 10 | Migration SQL has source-revision + attachment/asset FKs | ✅ PASS |

**All 10 acceptance criteria PASS. No schema gaps found. No implementation changes required.**
