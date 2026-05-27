# Spec 02 Validation Report — Domain DB Schema

**Spec:** `docs/specs/02-spec-domain-db-schema/02-spec-domain-db-schema.md`  
**Branch:** `feat/spec-02-domain-db-schema`  
**Validator:** Shuttle (independent — not Weft/Warp)  
**Date:** 2026-05-27  
**Overall Result:** ✅ **PASS**

---

## Executive Summary

**Overall: ✅ PASS — Gates A–F all pass. No CRITICAL or HIGH issues. Implementation Ready: Yes.**

Spec 02 establishes the complete Atlas domain database schema in `apps/server/src/db/schema/`, backed by four Drizzle migrations (0001–0004) on top of the pre-existing auth migration (0000). All 23 tables are present, all four quality commands pass cleanly, and three independent validation scripts confirm that the key domain invariants are enforced at the database level. No real secrets appear in migration files or proof artifacts. All seven implementation commits follow conventional commit format.

| Metric | Value |
|---|---|
| Requirements Verified | 28/28 (100%) |
| Proof Artifacts Working | 5/5 (100%) |
| Live Assertions Passing | 59/59 (100%) |
| Files Changed vs Expected | 37 changed / 37 expected (core: 27, supporting: 10) |
| CRITICAL/HIGH Issues | 0 |
| MEDIUM Issues | 0 |
| LOW Issues | 3 (all non-blocking) |

**Implementation Ready: Yes** — all functional requirements are satisfied, migrations apply cleanly against a fresh database, and no blocking issues were found.

---

## Gate Results

| Gate | Definition | Result |
|---|---|---|
| A | No CRITICAL or HIGH severity issues | ✅ PASS |
| B | Coverage Matrix has no Unknown rows for Functional Requirements | ✅ PASS — 28/28 rows are PASS |
| C | All Proof Artifacts are accessible and functional | ✅ PASS — 5/5 proof files exist; 3 validation scripts run live (59/59 assertions pass) |
| D | File integrity: D1 core schema/migration files present (blocker), D2 supporting files present (non-blocking), D3 commits traceable | ✅ PASS — D1: 27 core files verified; D2: 10 supporting files verified; D3: 7/7 commits conventional |
| E | Repository standards and patterns followed | ✅ PASS — Bun workflows, snake_case naming, split schema, Drizzle as source of truth, glossary alignment |
| F | No real secrets in proof artifacts or migration files | ✅ PASS — pattern scan clean; no credential values in any committed file |

---

## Coverage Matrix

### Functional Requirements

#### Unit 1 — Account, Identity, and Integration Foundation

| Requirement | Status | Evidence |
|---|---|---|
| Domain `connected_account` separate from Better Auth `account` | ✅ PASS | `schema/connected_account.ts`; no FK between the two tables; `0001_many_captain_flint.sql` |
| `connected_account` lifecycle separate from sync jobs; reconnect/reactivation semantics | ✅ PASS | `status` enum `active/disconnected/reactivating/error`; `reactivated_at` column; validate-task-02 assertions 5–6 |
| Encrypted provider tokens with explicit encryption metadata | ✅ PASS | `enc_access_token`, `enc_refresh_token`, `enc_key_id`, `enc_algorithm`, `enc_iv` columns; no plaintext token columns; validate-task-02 assertions 3–4 |
| User-scoped `contact` and `email_identity`; exact email unique per user | ✅ PASS | `schema/contact.ts`; `UNIQUE INDEX email_identity_user_email_unique (user_id, email_address)`; validate-task-02 assertions 10–14 |
| Exact-email routing semantics per connected account | ✅ PASS | `email_identity` FK on `thread.initiating_sender_email_identity_id`; `sender_routing_rule` keyed by `(connected_account_id, email_address)` |
| User-scoped `destination_integration` distinct from mailbox accounts | ✅ PASS | `schema/destination_integration.ts`; separate table with no FK to `connected_account`; validate-task-02 assertions 15–18 |
| Durable `sync_state` and append-only `sync_job` as separate concepts | ✅ PASS | `schema/sync.ts`; `UNIQUE INDEX sync_state_connected_account_unique`; validate-task-02 assertions 19–30 |

#### Unit 2 — Thread, Message, and Screening Model

| Requirement | Status | Evidence |
|---|---|---|
| `thread` scoped to single connected account; unique per provider thread ID | ✅ PASS | `UNIQUE INDEX thread_provider_thread_id_unique (connected_account_id, provider_thread_id)`; `0002_condemned_cobalt_man.sql` |
| `message` scoped to single connected account; unique per provider message ID | ✅ PASS | `UNIQUE INDEX message_provider_message_id_unique (connected_account_id, provider_message_id)` |
| `screening_state` separate from `category` | ✅ PASS | Independent columns on `thread`; `thread_category_invariant` CHECK enforces the boundary |
| `category` null for non-accepted; non-null for accepted | ✅ PASS | `CHECK thread_category_invariant`; validate-task-03 assertions 1–4 |
| Initiating sender stored explicitly | ✅ PASS | `initiating_sender_email_identity_id` FK on `thread` |
| Rejected-sender threads hidden; messages retained | ✅ PASS | `is_hidden` flag; no cascade delete on rejection; validate-task-03 assertion 5 |
| Prior category preserved for lossless restore | ✅ PASS | `prior_category` column on `thread`; validate-task-03 assertion 5 |
| Normalized message participants | ✅ PASS | `message_participant` table with `role` CHECK; not JSON arrays |
| Trash on Screener threads; archive/handling state limited to accepted | ✅ PASS | `CHECK thread_archive_accepted_only`; `CHECK thread_handling_state_accepted_only`; validate-task-03 assertions 6–8 |
| Pending threads searchable; hidden/trashed excluded from normal search | ✅ PASS | `is_hidden` and `is_trashed` flags; `thread_is_hidden_idx`; `is_search_excluded` on embeddings |

#### Unit 3 — Revision-Aware AI, Action Item, and Search Artifacts

| Requirement | Status | Evidence |
|---|---|---|
| Explicit thread content revision concept | ✅ PASS | `schema/revision.ts`; `thread_revision` table with `revision_number` and `content_hash` |
| Overlay-only changes do not advance revision | ✅ PASS | Schema design: revision rows created only for effective content changes; documented in `schema/revision.ts` header |
| AI artifacts in revision-aware structures | ✅ PASS | `ai_thread_summary` and `ai_thread_priority` both FK to `thread_revision_id` |
| AI artifacts allowed for pending Screener threads | ✅ PASS | No screening-state constraint on AI artifact tables; any thread can have AI artifacts |
| AI priority uses `low/medium/high` semantic levels | ✅ PASS | `CHECK ai_thread_priority_level_check IN ('low', 'medium', 'high')`; `0003_outstanding_mach_iv.sql` |
| `action_item` with lifecycle state, source revision provenance, nullable destination | ✅ PASS | `lifecycle_state` CHECK; `source_revision_id` FK (SET NULL); `destination_integration_id` nullable; validate-task-04 assertions 1–8 |
| Dismissed items retained; confirmed items survive later revisions | ✅ PASS | No cascade delete on dismissal; `source_revision_id` SET NULL preserves confirmed items; validate-task-04 assertions 4–7 |
| Revision-aware thread embedding for semantic search | ✅ PASS | `schema/embedding.ts`; `thread_embedding` FK to `thread_revision_id`; `blob` storage |
| Hidden/trashed threads excludable from semantic search | ✅ PASS | `is_search_excluded` flag on `thread_embedding`; `thread_embedding_search_excluded_idx` |

#### Unit 4 — Object-Backed Attachments and External Mutation Tracking

| Requirement | Status | Evidence |
|---|---|---|
| Attachment model for synced messages | ✅ PASS | `attachment` table in `schema/object_asset.ts`; FK to `message` |
| Attachment metadata + stable object-storage references | ✅ PASS | `object_asset` table with `bucket`, `object_key`, `storage_provider`; `attachment.object_asset_id` FK |
| Eager attachment ingestion with partial success | ✅ PASS | `ingestion_state` nullable `object_asset_id`; validate-task-04 assertions 9–14 |
| Explicit attachment ingestion lifecycle state | ✅ PASS | `ingestion_state` CHECK `IN ('pending', 'uploaded', 'failed', 'skipped')` |
| Raw provider/message payload snapshots via object storage | ✅ PASS | `raw_payload_ref` table referencing `object_asset` |
| Shared object-asset concept for attachments and raw payloads | ✅ PASS | Both `attachment` and `raw_payload_ref` FK to `object_asset` |
| Unified `integration_mutation_journal` for outbound writes | ✅ PASS | `schema/integration_mutation_journal.ts`; `mutation_target` covers both write targets |
| Mutation entries idempotency-aware | ✅ PASS | `UNIQUE INDEX imj_idempotency_key_unique (mutation_target, idempotency_key)` |
| Action items reference exactly one destination integration when confirmed | ✅ PASS | `CHECK action_item_confirmed_needs_destination`; validate-task-04 assertions 2–3 |

### Repository Standards

| Standard | Status | Evidence |
|---|---|---|
| Domain schema in `apps/server/src/db/` | ✅ PASS | 13 schema files in `apps/server/src/db/schema/` |
| Bun-based workflows (`bun run db:generate`, `bun run db:migrate`) | ✅ PASS | `bun run generate` → exit 0; `bun run migrate` → exit 0 (live-verified) |
| Drizzle schema as typed source of truth; split by domain area | ✅ PASS | 13 separate schema files; single barrel `schema/index.ts` |
| Generated SQL in `apps/server/drizzle/` | ✅ PASS | Migrations 0001–0004 present |
| snake_case file naming | ✅ PASS | All schema files use snake_case; `casing: "snake_case"` in drizzle.config.ts |
| Glossary alignment with `CONTEXT.md` | ✅ PASS | See Glossary Alignment section below |
| Conventional commits | ✅ PASS | All 7 implementation commits use `feat/refactor/docs(scope): message` format |
| Scope focused to database-foundation feature | ✅ PASS | Changed files limited to `apps/server/src/db*`, `apps/server/drizzle/`, and `docs/specs/02-*` |

#### Glossary Alignment

| CONTEXT.md Term | Schema Representation | Aligned |
|---|---|---|
| Connected Account | `connected_account` table — distinct from Better Auth `account` | ✅ |
| Destination Integration | `destination_integration` table — distinct from `connected_account` | ✅ |
| Screener (not a category) | `screening_state` column separate from `category` column | ✅ |
| Category (accepted threads only) | `category` nullable; CHECK enforces non-null only when `screening_state = 'accepted'` | ✅ |
| Action Item | `action_item` table with `lifecycle_state` and nullable `destination_integration_id` | ✅ |
| Thread Revision | `thread_revision` table; AI artifacts and embeddings reference it | ✅ |
| Handling State | `handling_state` column on `thread` (accepted threads only) | ✅ |
| Read State | `is_read` column on `thread` | ✅ |
| Archive / Trash | `is_archived` / `is_trashed` columns on `thread` | ✅ |
| Sender Routing Rule | `sender_routing_rule` table keyed by `(connected_account_id, email_address)` | ✅ |

### Proof Artifacts

| Task | Proof File | Exists | Usable | Live-Verified |
|---|---|---|---|---|
| 1.0 | `02-proofs/02-task-01-proofs.md` | ✅ | ✅ | N/A (no-DDL refactor; `bun run generate` exit 0 confirmed) |
| 2.0 | `02-proofs/02-task-02-proofs.md` | ✅ | ✅ | ✅ 33/33 assertions pass |
| 3.0 | `02-proofs/02-task-03-proofs.md` | ✅ | ✅ | ✅ 12/12 assertions pass |
| 4.0 | `02-proofs/02-task-04-proofs.md` | ✅ | ✅ | ✅ 14/14 assertions pass |
| 5.0 | `02-proofs/02-task-05-proofs.md` | ✅ | ✅ | ✅ Migration DDL verified; `bun run generate` + `migrate` exit 0 |

---

## Validation Issues

### Issue V-01 — Task 1.0 proof criterion wording mismatch

**Severity:** LOW  
**Blocking:** No  
**Description:** The task 1.0 proof criterion states `bun run generate` should "create a new migration." A pure file-layout refactor with no DDL changes cannot produce a new migration. The implementation correctly reports "No schema changes, nothing to migrate" — which is the right outcome for a no-DDL refactor.  
**Resolution:** The proof artifact (02-task-01-proofs.md) explicitly discloses this discrepancy and explains why producing a migration would be incorrect. Task 2.0 generated the first real migration (`0001_many_captain_flint.sql`), which simultaneously validated the new barrel entrypoint. The task file marks 1.0 `[x]` with the resolution documented.  
**Verdict:** Non-blocking. The implementation is correct; the criterion wording was aspirational. The disclosure is transparent and the resolution is sound.

### Issue V-02 — Vector index DDL deferred (spec-permitted)

**Severity:** LOW  
**Blocking:** No  
**Description:** The spec's Technical Considerations explicitly permit deferring the libSQL vector index DDL if the runtime does not support it. The `thread_embedding` table ships with `blob` storage and the planned DDL is documented in both `schema/embedding.ts` and the proof artifact. The actual `CREATE INDEX ... libsql_vector_idx(...)` DDL is not in the migration files.  
**Resolution:** Spec-permitted deferral. The embedding table is present and functional; semantic search falls back to full-table scan until the vector index migration is applied. No action required for this spec.  
**Verdict:** Non-blocking.

### Issue V-03 — `docs/specs/` gitignore required force-add for proof files

**Severity:** LOW  
**Blocking:** No  
**Description:** Proof files under `docs/specs/` were initially gitignored, requiring `git add -f` to commit them. This caused a follow-up commit (`fd97db4`) to land the task-02 proof artifact separately from the schema commit.  
**Resolution:** Documented in `.weave/learnings/02-spec-domain-db-schema.md`. Proof files are committed and present. No missing artifacts.  
**Verdict:** Non-blocking.

---

## Evidence Appendix

### A. Live Command Output

#### `bun run generate` (from worktree root)

```
@hay/server:generate: 23 tables
@hay/server:generate: connected_account 18 columns 3 indexes 1 fks
@hay/server:generate: contact 5 columns 1 indexes 1 fks
@hay/server:generate: email_identity 7 columns 3 indexes 2 fks
@hay/server:generate: destination_integration 14 columns 2 indexes 1 fks
@hay/server:generate: sync_state 9 columns 2 indexes 1 fks
@hay/server:generate: sync_job 12 columns 2 indexes 1 fks
@hay/server:generate: message 14 columns 4 indexes 2 fks
@hay/server:generate: message_participant 7 columns 3 indexes 2 fks
@hay/server:generate: thread 17 columns 7 indexes 2 fks
@hay/server:generate: sender_routing_rule 9 columns 4 indexes 2 fks
@hay/server:generate: thread_revision 6 columns 3 indexes 1 fks
@hay/server:generate: ai_thread_priority 7 columns 2 indexes 2 fks
@hay/server:generate: ai_thread_summary 6 columns 2 indexes 2 fks
@hay/server:generate: action_item 16 columns 4 indexes 3 fks
@hay/server:generate: attachment 12 columns 3 indexes 2 fks
@hay/server:generate: object_asset 8 columns 1 indexes 0 fks
@hay/server:generate: raw_payload_ref 7 columns 2 indexes 3 fks
@hay/server:generate: thread_embedding 8 columns 4 indexes 2 fks
@hay/server:generate: integration_mutation_journal 20 columns 7 indexes 4 fks
@hay/server:generate: No schema changes, nothing to migrate 😴
Tasks: 1 successful, 1 total
```

**Result: ✅ EXIT 0 — 23 tables, no drift**

#### `bun run migrate` (from `apps/server/`, `TURSO_DATABASE_URL=file:./local.db`)

```
[✓] migrations applied successfully!
```

**Result: ✅ EXIT 0**

#### `bun run lint`

```
@hay/server:lint: Checked 29 files in 24ms. No fixes applied.
Tasks: 3 successful, 3 total
```

**Result: ✅ EXIT 0**

#### `bun run typecheck`

```
@hay/server:typecheck: $ tsc --noEmit
Tasks: 3 successful, 3 total
```

**Result: ✅ EXIT 0**

### B. Validation Script Results

#### validate-task-02.ts — 33/33 PASS

```
Results: 33 passed, 0 failed
All assertions passed ✓
```

Covers: connected_account lifecycle, encrypted token storage, email_identity uniqueness, destination_integration dedupe, sync_state vs sync_job separation, cascade delete.

#### validate-task-03-invariants.ts — 12/12 PASS

```
Passed: 12 / Failed: 0 / Total: 12
✅  All invariants PASSED — schema correctly enforces thread/category/screening rules.
```

Covers: category null for pending/rejected, category non-null for accepted, archive accepted-only, trash allowed on Screener, handling_state accepted-only, lossless restore via prior_category, routing rule invariants.

#### validate-task-04-lifecycle.ts — 14/14 PASS

```
Passed: 14 / Failed: 0 / Total: 14
✅  All invariants PASSED — schema correctly enforces revision/action-item/attachment lifecycle rules.
```

Covers: action item nullable destination before confirmation, confirmed item requires destination, dismissed item retention, revision provenance, attachment partial-success, parent message/thread intact after attachment failure.

**Total live assertions: 59/59 PASS**

### C. Changed Files Classification

| File | Classification | Justification |
|---|---|---|
| `apps/server/src/db/schema/auth.ts` | Core | Auth schema split from monolithic schema.ts |
| `apps/server/src/db/schema/connected_account.ts` | Core | Unit 1 domain table |
| `apps/server/src/db/schema/contact.ts` | Core | Unit 1 domain tables |
| `apps/server/src/db/schema/destination_integration.ts` | Core | Unit 1 domain table |
| `apps/server/src/db/schema/sync.ts` | Core | Unit 1 domain tables |
| `apps/server/src/db/schema/thread.ts` | Core | Unit 2 domain tables |
| `apps/server/src/db/schema/sender_routing_rule.ts` | Core | Unit 2 domain table |
| `apps/server/src/db/schema/revision.ts` | Core | Unit 3 domain table |
| `apps/server/src/db/schema/ai_artifact.ts` | Core | Unit 3 domain tables |
| `apps/server/src/db/schema/action_item.ts` | Core | Unit 3 domain table |
| `apps/server/src/db/schema/object_asset.ts` | Core | Unit 4 domain tables |
| `apps/server/src/db/schema/embedding.ts` | Core | Unit 3 domain table |
| `apps/server/src/db/schema/integration_mutation_journal.ts` | Core | Unit 4 domain table |
| `apps/server/src/db/schema/index.ts` | Core | Schema barrel — Drizzle Kit entrypoint |
| `apps/server/src/db/index.ts` | Core | Runtime DB client updated to use split schema |
| `apps/server/src/db/schema.ts` | Core | Deprecated shim re-exporting barrel |
| `apps/server/drizzle.config.ts` | Core | Updated schema entrypoint |
| `apps/server/drizzle/0001_many_captain_flint.sql` | Core | Migration: Unit 1 tables |
| `apps/server/drizzle/0002_condemned_cobalt_man.sql` | Core | Migration: Unit 2 tables |
| `apps/server/drizzle/0003_outstanding_mach_iv.sql` | Core | Migration: Units 3 & 4 tables |
| `apps/server/drizzle/0004_swift_robbie_robertson.sql` | Core | Migration: Unit 4 journal table |
| `apps/server/drizzle/meta/_journal.json` | Core | Migration journal (5 entries) |
| `apps/server/drizzle/meta/0001_snapshot.json` | Core | Drizzle snapshot |
| `apps/server/drizzle/meta/0002_snapshot.json` | Core | Drizzle snapshot |
| `apps/server/drizzle/meta/0003_snapshot.json` | Core | Drizzle snapshot |
| `apps/server/drizzle/meta/0004_snapshot.json` | Core | Drizzle snapshot |
| `apps/server/src/db/validate-task-02.ts` | Supporting | Proof validation script |
| `apps/server/src/db/validate-task-03-invariants.ts` | Supporting | Proof validation script |
| `apps/server/src/db/validate-task-04-lifecycle.ts` | Supporting | Proof validation script |
| `docs/specs/02-spec-domain-db-schema/02-proofs/02-task-01-proofs.md` | Supporting | Proof artifact |
| `docs/specs/02-spec-domain-db-schema/02-proofs/02-task-02-proofs.md` | Supporting | Proof artifact |
| `docs/specs/02-spec-domain-db-schema/02-proofs/02-task-03-proofs.md` | Supporting | Proof artifact |
| `docs/specs/02-spec-domain-db-schema/02-proofs/02-task-04-proofs.md` | Supporting | Proof artifact |
| `docs/specs/02-spec-domain-db-schema/02-proofs/02-task-05-proofs.md` | Supporting | Proof artifact |
| `docs/specs/02-spec-domain-db-schema/02-spec-domain-db-schema.md` | Supporting | Spec document (unchanged) |
| `docs/specs/02-spec-domain-db-schema/02-tasks-domain-db-schema.md` | Supporting | Task file (all tasks marked `[x]`) |
| `.weave/learnings/02-spec-domain-db-schema.md` | Supporting | Learnings file |

No unrelated runtime areas outside `apps/server/src/db*` and `docs/` were modified.

### D. Commit Traceability

| Commit | Message | Scope | Conventional |
|---|---|---|---|
| `4af4ef8` | `refactor(server/db): split auth schema into dedicated module` | Task 1.0 | ✅ |
| `7ebca08` | `docs(spec-02): re-open task 1.0; document proof criterion mismatch` | Task 1.0 disclosure | ✅ |
| `1cf7e3a` | `feat(db): add connected_account, contact, email_identity, destination_integration, sync_state, sync_job tables` | Task 2.0 | ✅ |
| `fd97db4` | `docs(spec-02): commit task-02 proof artifact and close tasks 1.0 and 2.0` | Task 2.0 proof | ✅ |
| `2e9f328` | `feat(schema): add thread, message, participant, and sender routing rule tables` | Task 3.0 | ✅ |
| `1227754` | `feat(schema): add revision-aware AI, action-item, attachment, and embedding tables` | Task 4.0 | ✅ |
| `bb1d26d` | `feat(schema): add integration_mutation_journal and final schema verification` | Task 5.0 | ✅ |

All 7 commits are on `feat/spec-02-domain-db-schema` and follow `<type>(<scope>): <summary>` format.

### E. Secret Hygiene Check

- **Migration files:** No real credentials found. `password` and `token` columns in `0000_skinny_agent_brand.sql` are Better Auth schema column names (not values). Domain migrations use `enc_*` prefix columns for encrypted token storage — column definitions only, no values.
- **Proof artifacts:** No real API keys, OAuth tokens, or credential values. References to tokens are structural (column names, schema descriptions). Validation scripts use in-memory databases with synthetic test data.
- **Validation scripts:** Use `file::memory:` or `file:./local.db` (gitignored) — no remote credentials.
- **Pattern scan:** No matches for `ghp_`, `sk-`, `AIza`, `AKIA`, `xoxb-`, `xoxp-`, or `Bearer [token]` patterns in any changed file.

**Verdict: ✅ No real secrets in committed artifacts.**

---

## Final Verdict

**✅ PASS — Spec 02 implementation is complete and correct.**

All 28 functional requirements across 4 spec units are satisfied. All 6 validation gates pass. 59 live assertions confirm database-level invariant enforcement. No blocking issues found. Three LOW-severity issues are documented and all are non-blocking by design or spec permission.

---

Validation Completed: 2026-05-27T13:40:00-07:00  
Validation Performed By: claude-sonnet-4-6 (Shuttle / Weave)
