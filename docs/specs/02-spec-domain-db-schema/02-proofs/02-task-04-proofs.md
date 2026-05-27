# Task 4 Proof Artifact

**Task:** 4.0 — Add revision-aware AI, action-item, search, attachment, and asset tables  
**Spec:** `docs/specs/02-spec-domain-db-schema/02-spec-domain-db-schema.md` (Units 3 & 4)  
**Date:** 2026-05-27

---

## 1. Schema Files Created

| File | Tables / Purpose |
|---|---|
| `apps/server/src/db/schema/revision.ts` | `thread_revision` — content revision snapshots |
| `apps/server/src/db/schema/ai_artifact.ts` | `ai_thread_summary`, `ai_thread_priority` — revision-aware AI artifacts |
| `apps/server/src/db/schema/action_item.ts` | `action_item` — lifecycle-aware action items with revision provenance |
| `apps/server/src/db/schema/object_asset.ts` | `object_asset`, `raw_payload_ref`, `attachment` — shared storage references |
| `apps/server/src/db/schema/embedding.ts` | `thread_embedding` — revision-aware vector embeddings |
| `apps/server/src/db/schema/index.ts` | Updated barrel to export all Task 4 modules |

---

## 2. Schema Design Decisions

### Thread Revision (`thread_revision`)

- New revision rows are created only for effective content changes (new message, re-parse that materially changes normalized content).
- Atlas-only overlay changes (read state, category, archive, trash, handling state, screening state) do **not** advance the revision counter.
- `revision_number` is monotonically increasing per thread; unique index on `(thread_id, revision_number)` enforces this.
- `content_hash` is an application-computed hash used to detect whether a re-parse actually changed content before creating a new revision row.

### AI Artifacts (`ai_thread_summary`, `ai_thread_priority`)

- Both tables reference `thread_revision_id` (FK to `thread_revision`) so every AI artifact is tied to the exact revision it was derived from.
- Both tables allow rows for threads in **any** screening state, including `pending` Screener threads (spec requirement: "AI summary and AI priority artifacts to exist for pending Screener threads").
- `ai_thread_priority.priority_level` uses semantic `low | medium | high` values with a CHECK constraint — no numeric ordinals.
- Unique index on `(thread_id, thread_revision_id)` per table ensures at most one summary/priority per revision.

### Action Item (`action_item`)

- `lifecycle_state` values: `pending | confirmed | dismissed | completed` — enforced by CHECK constraint.
- `destination_integration_id` is **nullable** until confirmation. CHECK constraint `action_item_confirmed_needs_destination` enforces that confirmed items always have a destination.
- `source_revision_id` uses `SET NULL` on delete so confirmed/dismissed items are retained even if the revision row is removed.
- `destination_integration_id` uses `SET NULL` on delete so confirmed items survive integration disconnection.
- Dismissed items are retained (no cascade delete on dismissal).
- `priority` uses semantic `low | medium | high` (nullable) with a CHECK constraint.

### Object Asset, Raw Payload Ref, Attachment

- `object_asset` is a shared storage-reference concept used by both `attachment` and `raw_payload_ref` — avoids duplicating storage semantics.
- `raw_payload_ref` references `object_asset` with `RESTRICT` on delete (prevents orphaned payload references).
- `attachment.ingestion_state` values: `pending | uploaded | failed | skipped` — separate from message sync state.
- `attachment.object_asset_id` is nullable until upload succeeds. CHECK constraint `attachment_uploaded_needs_asset` enforces that uploaded attachments always have an `object_asset_id`.
- Failed/pending attachments do **not** invalidate parent message or thread rows (no cascade from attachment to message/thread).

### Thread Embedding (`thread_embedding`)

- References `thread_revision_id` so embeddings are revision-aware.
- `embedding` stored as `blob` (raw `Float32Array` bytes) — libSQL stores this as `F32_BLOB(N)` at the storage layer.
- `embedding_dimension` and `embedding_model` stored for validation and multi-model support.
- `is_search_excluded` flag allows hidden rejected and trashed threads to be excluded from semantic search without deleting embeddings.
- Unique index on `(thread_id, thread_revision_id, embedding_model)` allows multiple models per revision.

#### Planned Vector Index DDL (deferred)

Drizzle Kit does not support libSQL vector index syntax. The following DDL must be applied via a raw SQL migration when the libSQL runtime supports it:

```sql
CREATE INDEX thread_embedding_vector_idx
  ON thread_embedding (libsql_vector_idx(embedding));
```

Until this index is created, semantic search falls back to full-table scan with application-side cosine similarity.

---

## 3. Migration Output

**Generated migration:** `apps/server/drizzle/0003_outstanding_mach_iv.sql`

Key DDL highlights (sanitized — no credentials or real data):

```sql
-- thread_revision: source-revision relationships
CREATE TABLE `thread_revision` (
  `id` text PRIMARY KEY NOT NULL,
  `thread_id` text NOT NULL,
  `revision_number` integer NOT NULL,
  `content_hash` text NOT NULL,
  ...
  FOREIGN KEY (`thread_id`) REFERENCES `thread`(`id`) ON DELETE cascade
);
CREATE UNIQUE INDEX `thread_revision_thread_revision_number_unique`
  ON `thread_revision` (`thread_id`,`revision_number`);

-- ai_thread_priority: semantic priority levels
CREATE TABLE `ai_thread_priority` (
  ...
  CONSTRAINT "ai_thread_priority_level_check"
    CHECK("ai_thread_priority"."priority_level" IN ('low', 'medium', 'high'))
);

-- action_item: nullable destination + confirmed-needs-destination CHECK
CREATE TABLE `action_item` (
  `destination_integration_id` text,  -- nullable until confirmed
  ...
  CONSTRAINT "action_item_confirmed_needs_destination"
    CHECK(("action_item"."lifecycle_state" != 'confirmed'
           OR "action_item"."destination_integration_id" IS NOT NULL))
);

-- attachment: ingestion state separate from message sync state
CREATE TABLE `attachment` (
  `ingestion_state` text DEFAULT 'pending' NOT NULL,
  `object_asset_id` text,  -- nullable until upload succeeds
  ...
  CONSTRAINT "attachment_uploaded_needs_asset"
    CHECK(("attachment"."ingestion_state" != 'uploaded'
           OR "attachment"."object_asset_id" IS NOT NULL))
);

-- thread_embedding: blob storage + search exclusion flag
CREATE TABLE `thread_embedding` (
  `embedding` blob NOT NULL,
  `embedding_dimension` integer NOT NULL,
  `embedding_model` text NOT NULL,
  `is_search_excluded` integer DEFAULT false NOT NULL,
  ...
);
```

---

## 4. CLI Verification

All commands run from the worktree root (`/Users/jose/projects/hay.worktrees/feat/spec-02-domain-db-schema`):

### `bun run generate`

```
@hay/server:generate: 22 tables
@hay/server:generate: thread_revision 6 columns 3 indexes 1 fks
@hay/server:generate: ai_thread_priority 7 columns 2 indexes 2 fks
@hay/server:generate: ai_thread_summary 6 columns 2 indexes 2 fks
@hay/server:generate: action_item 16 columns 4 indexes 3 fks
@hay/server:generate: attachment 12 columns 3 indexes 2 fks
@hay/server:generate: object_asset 8 columns 1 indexes 0 fks
@hay/server:generate: raw_payload_ref 7 columns 2 indexes 3 fks
@hay/server:generate: thread_embedding 8 columns 4 indexes 2 fks
@hay/server:generate: [✓] Your SQL migration file ➜ drizzle/0003_outstanding_mach_iv.sql 🚀
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
@hay/server:lint: Checked 27 files in 22ms. No fixes applied.
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

## 5. Validation Script

**Script:** `apps/server/src/db/validate-task-04-lifecycle.ts`

Run with:
```sh
cd apps/server && bun run src/db/validate-task-04-lifecycle.ts
```

### Output (14/14 passing)

```
── Action-item lifecycle ──────────────────────────────────────────────────
  ✅  PASS  pending action item + null destination_integration_id is valid
  ✅  PASS  confirmed action item + null destination_integration_id violates CHECK  (constraint correctly rejected the row)
  ✅  PASS  confirmed action item + destination_integration_id is valid
  ✅  PASS  dismissed action item can be inserted (retained for history)
  ✅  PASS  dismissed action item row persists (not deleted)
  ✅  PASS  second thread revision can be created (new effective content)
  ✅  PASS  confirmed action item survives later thread revision (durable)
  ✅  PASS  confirmed action item retains source_revision_id provenance

── Attachment lifecycle ───────────────────────────────────────────────────
  ✅  PASS  pending attachment + null object_asset_id is valid
  ✅  PASS  failed attachment + null object_asset_id is valid (partial success)
  ✅  PASS  uploaded attachment + null object_asset_id violates CHECK  (constraint correctly rejected the row)
  ✅  PASS  uploaded attachment + object_asset_id is valid
  ✅  PASS  parent message row is intact after attachment failure (partial success)
  ✅  PASS  parent thread row is intact with pending attachment (partial success)

── Results ─────────────────────────────────────────────────────────────────
   Passed: 14
   Failed: 0
   Total:  14

✅  All invariants PASSED — schema correctly enforces revision/action-item/attachment lifecycle rules.
```

---

## 6. Acceptance Criteria Checklist

| Criterion | Status |
|---|---|
| Task file shows sub-tasks 4.1–4.5 and parent 4.0 as `[x]` | ✅ |
| `schema/` contains separate files for thread revisions, AI artifacts, action items, embeddings, attachments, object assets, raw payload refs | ✅ |
| Derived artifacts tied to explicit source revisions; overlay-only changes do not force new revision rows | ✅ |
| AI summaries/priorities allowed for pending Screener threads; AI priority uses `low\|medium\|high` | ✅ |
| Action-item lifecycle: nullable destination before confirmation, durable confirmed items, dismissed-item retention, revision provenance | ✅ |
| Object storage references shared consistently across attachments and raw payload snapshots | ✅ |
| Attachment ingestion state separate from message sync state; partial-success permitted | ✅ |
| Migration SQL includes source-revision FKs, attachment/object-asset FKs, libSQL-compatible embedding storage, planned vector-index DDL/comments | ✅ |
| Validation script proves required lifecycle behavior (14/14 passing) | ✅ |
| `bun run generate` succeeds | ✅ |
| `bun run migrate` succeeds | ✅ |
| `bun run lint` succeeds | ✅ |
| `bun run typecheck` succeeds | ✅ |
| Proof file exists, is reviewer-friendly, includes sanitized evidence | ✅ |

---

## Reviewer Conclusion

Task 4 is complete. All five schema files are in place, the migration applies cleanly, all quality commands pass, and the 14-case validation script confirms that the action-item and attachment lifecycle invariants are correctly enforced at the database level. The embedding table ships with blob storage and a documented planned vector-index DDL comment; the actual `libsql_vector_idx` DDL is deferred to a follow-up migration as specified by the spec's technical considerations.
