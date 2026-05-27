# 02-validation-domain-db-schema.md

## Executive Summary

**Overall Status:** ✅ PASS

Spec 02 (Atlas domain DB schema) has been fully implemented, verified, and merged to `main` as commit `e14b35d` ("feat(server-db): implement atlas domain schema (#23)"). All four Demoable Units of Work and 35+ functional requirements are backed by real schema code, generated migrations, and three executable validation scripts that all pass. The five committed task proof artifacts (`02-task-01-proofs.md` through `02-task-05-proofs.md`) front-load context, cite exact file paths and line numbers, and capture working CLI evidence (`bun run generate`, `bun run migrate`, `bun run lint`, `bun run typecheck`, all exit 0).

All validation gates pass. No CRITICAL or HIGH issues found. No sensitive data found in any proof artifact. The lone observation worth flagging is documented under "Validation Issues" as INFO (non-blocking): `docs/specs/` is gitignored in this repository, so the task list and proofs only exist on the feature branch `feat/db-atlas-domain-schema` — they were checked out locally from that branch for validation. This is consistent with the project's documented convention (.gitignore entry `docs/specs/`) and was explicitly captured as a learning in `.weave/learnings/02-spec-domain-db-schema.md`.

**Gates tripped:** None.
**Critical/High issues:** 0.
**Recommendation:** APPROVED. Spec 02 is shippable.

---

## Git Commit Mapping

| Spec Unit / Task | Branch Commits | Final Merge |
|---|---|---|
| Task 1.0 — Schema module layout & migration entrypoints | `93a4699` feat(db): establish split schema module layout; `4af4ef8` refactor(server/db): split auth schema into dedicated module | `e14b35d` (squash) |
| Task 2.0 — Account/identity/integration/sync foundation tables | `b9006e9` feat(db): verify account/identity/sync foundation schema; `2fe0827` / `1cf7e3a` feat(db): add connected_account, contact, email_identity, destination_integration, sync_state, sync_job tables | `e14b35d` |
| Task 3.0 — Thread/message/screening/participant model | `c2fdfcb` feat(db): verify thread/message/screening schema; `925655f` / `2e9f328` feat(schema): add thread, message, participant, sender routing rule tables | `e14b35d` |
| Task 4.0 — Revision-aware AI, action item, attachment, object asset tables | `6c72fb0` feat(db): verify revision/AI/action-item/attachment schema; `35b52b7` / `1227754` feat(schema): add revision-aware AI, action-item, attachment, embedding tables | `e14b35d` |
| Task 5.0 — Integration mutation journal & final schema verification | `339025b` feat(db): verify integration mutation journal and final schema; `0bdf28b` / `bb1d26d` feat(schema): add integration_mutation_journal and final schema verification | `e14b35d` |
| Proof artifact + workflow learnings | `fd97db4` docs(spec-02): commit task-02 proof artifact; `7ebca08` docs(spec-02): re-open task 1.0 | `e14b35d` |
| Validation report (this branch) | `f094199` docs(spec-02): add validation report | not yet merged |

All branch commits use Conventional Commits format. The squash-merged final commit `e14b35d` uses scope `(server-db)` and subject `implement atlas domain schema` — compliant with repository convention. Three branch-only `interim` commits exist but were squashed away in the merge.

---

## Change Analysis

Files changed in the merged commit `e14b35d^..e14b35d` (33 files, +16,175 / −109 lines):

### Core (schema source-of-truth — 13 files)

| File | Lines | Role |
|---|---|---|
| `apps/server/src/db/schema/index.ts` | 49 | Barrel export — single source of truth |
| `apps/server/src/db/schema/auth.ts` | 120 | Better Auth tables (user, session, account, verification) |
| `apps/server/src/db/schema/connected_account.ts` | 136 | Domain `connected_account` w/ encrypted token columns |
| `apps/server/src/db/schema/contact.ts` | 133 | `contact` + `email_identity` |
| `apps/server/src/db/schema/destination_integration.ts` | 120 | `destination_integration` |
| `apps/server/src/db/schema/sync.ts` | 176 | `sync_state` (durable) + `sync_job` (append-only) |
| `apps/server/src/db/schema/thread.ts` | 460 | `thread`, `message`, `message_participant` + CHECK invariants |
| `apps/server/src/db/schema/sender_routing_rule.ts` | 167 | `sender_routing_rule` |
| `apps/server/src/db/schema/revision.ts` | 109 | `thread_revision` |
| `apps/server/src/db/schema/ai_artifact.ts` | 178 | `ai_thread_summary`, `ai_thread_priority` |
| `apps/server/src/db/schema/action_item.ts` | 209 | `action_item` lifecycle |
| `apps/server/src/db/schema/object_asset.ts` | 315 | `object_asset`, `attachment`, `raw_payload_ref` |
| `apps/server/src/db/schema/embedding.ts` | 175 | `thread_embedding` (libSQL vector-ready) |
| `apps/server/src/db/schema/integration_mutation_journal.ts` | 308 | Unified outbound write journal |

### Core (entrypoints & config — 3 files)

| File | Role |
|---|---|
| `apps/server/src/db/index.ts` | DB client pointing at split barrel |
| `apps/server/src/db/schema.ts` | `@deprecated` shim re-exporting `./schema/index.ts` |
| `apps/server/drizzle.config.ts` | Drizzle Kit config pointing at `./src/db/schema/index.ts` |

### Core (generated migrations — 11 files)

- `apps/server/drizzle/0001_many_captain_flint.sql` (106 lines)
- `apps/server/drizzle/0002_condemned_cobalt_man.sql` (104 lines)
- `apps/server/drizzle/0003_outstanding_mach_iv.sql` (136 lines)
- `apps/server/drizzle/0004_swift_robbie_robertson.sql` (39 lines)
- `apps/server/drizzle/0005_pr23-constraint-fixes.sql` (85 lines)
- `apps/server/drizzle/meta/0001_snapshot.json` … `0005_snapshot.json`
- `apps/server/drizzle/meta/_journal.json`

### Supporting (validation scripts — 3 files)

| File | Role |
|---|---|
| `apps/server/src/db/validate-task-02.ts` (520 lines) | Foundation lifecycle/ownership invariants — 33 assertions |
| `apps/server/src/db/validate-task-03-invariants.ts` (317 lines) | Thread/category/screening CHECK invariants — 12 assertions |
| `apps/server/src/db/validate-task-04-lifecycle.ts` (374 lines) | Revision/action-item/attachment lifecycle — 14 assertions |

### Supporting (workflow / housekeeping)

- `.gitignore` (added `docs/specs/` and related)
- `.weave/learnings/02-spec-domain-db-schema.md` (workflow discrepancies captured)

**Out-of-scope core changes:** none. All schema work stays in `apps/server/`; no leakage into `apps/web`, `apps/desktop`, or `infra/`.

---

## Coverage Matrix

### Functional Requirements

#### Unit 1 — Account, Identity, and Integration Foundation

| Requirement | Status | Evidence |
|---|---|---|
| Domain `connected_account` separate from Better Auth `account` | ✅ Verified | `schema/connected_account.ts` (table `connected_account`); `schema/auth.ts` unchanged — Better Auth `account` retained. Proof: 02-task-02-proofs §AC-1, AC-6. |
| `connected_account` lifecycle separate from per-run sync jobs (retained-history disconnect/reactivation) | ✅ Verified | `status` column with `disconnected`/`reactivating`/`active`/`error` states + `disconnected_at`/`reactivated_at` timestamps in `schema/connected_account.ts`. validate-task-02 cascade-delete + lifecycle assertions PASS. |
| Encrypted provider tokens + encryption metadata on `connected_account` | ✅ Verified | Columns `enc_access_token`, `enc_refresh_token`, `enc_iv`, `enc_key_id` (`schema/connected_account.ts:78–90`). Proof: 02-task-02-proofs §AC-4. |
| User-scoped `contact` and `email_identity`; exact-email unique per user | ✅ Verified | `schema/contact.ts` — `email_identity` has `userId` FK and unique index on `(user_id, email_address_normalized)`. Proof: 02-task-02-proofs §AC-5. |
| Exact-email routing semantics preserved | ✅ Verified | `sender_routing_rule` keyed on `(connected_account_id, email_address)` unique index. Proof: 02-task-03-proofs §AC-10. |
| User-scoped `destination_integration` distinct from mailbox accounts | ✅ Verified | `schema/destination_integration.ts` — separate table, no FK to `connected_account`. Proof: 02-task-02-proofs §AC-6. |
| Durable `sync_state` + append-only `sync_job` as separate concepts | ✅ Verified | `schema/sync.ts` — `sync_state` has UNIQUE INDEX `sync_state_connected_account_unique`; `sync_job` is append-only. validate-task-02 multi-row append + dedup assertions PASS. |

#### Unit 2 — Thread, Message, and Screening Model

| Requirement | Status | Evidence |
|---|---|---|
| `thread` scoped to single connected account; unique per provider thread ID | ✅ Verified | `UNIQUE INDEX thread_provider_thread_id_unique (connected_account_id, provider_thread_id)` in `0002_condemned_cobalt_man.sql`. Proof: 02-task-03-proofs §AC-1, AC-2. |
| `message` scoped to single connected account; unique per provider message ID | ✅ Verified | `UNIQUE INDEX message_provider_message_id_unique (connected_account_id, provider_message_id)`. Proof: 02-task-03-proofs §AC-2. |
| `screening_state` separate from `category` | ✅ Verified | Two distinct columns on `thread`; `CHECK thread_category_invariant` enforces relationship. Proof: 02-task-03-proofs §AC-3, AC-5. |
| `category` null for non-accepted; required for accepted | ✅ Verified | `CHECK thread_category_invariant` in `thread.ts:194`. validate-task-03-invariants PASS (12/12). |
| Initiating sender stored explicitly | ✅ Verified | `initiating_sender_email_identity_id` FK on `thread`. Proof: 02-task-03-proofs §AC-6. |
| Rejected-sender threads hidden; messages retained | ✅ Verified | `is_hidden` flag, no cascade delete on rejection. validate-task-03 assertion PASS. |
| Prior category preserved for lossless restore | ✅ Verified | `prior_category` column on `thread`. Proof: 02-task-03-proofs §AC-7. |
| Normalized message participants (not JSON arrays) | ✅ Verified | `message_participant` table with `role` CHECK. Proof: 02-task-03-proofs §AC-9. |
| Trash on Screener threads; archive/handling state limited to accepted | ✅ Verified | `CHECK thread_archive_accepted_only`, `CHECK thread_handling_state_accepted_only` (`thread.ts:204, 210`). Proof: 02-task-03-proofs §AC-8. |
| Pending Screener threads searchable; hidden/trashed excluded | ✅ Verified | `is_hidden`/`is_trashed` flags + `thread_is_hidden_idx`; `is_search_excluded` on `thread_embedding`. |

#### Unit 3 — Revision-Aware AI, Action Item, and Search Artifacts

| Requirement | Status | Evidence |
|---|---|---|
| Explicit thread content revision concept | ✅ Verified | `schema/revision.ts` — `thread_revision` with `revision_number` (CHECK > 0) and `content_hash`. Proof: 02-task-04-proofs §AC-1. |
| Overlay-only changes do not advance revision | ✅ Verified | Documented in `schema/revision.ts` header comment; no triggers for category/archive/trash/handling/read state — revision rows only created on `change_reason in {new_message, reparse_content_changed}`. |
| AI artifacts in revision-aware structures | ✅ Verified | `ai_thread_summary` and `ai_thread_priority` both FK to `thread_revision_id`. Proof: 02-task-04-proofs §AC-2. |
| AI artifacts allowed for pending Screener threads | ✅ Verified | No screening-state constraint on AI artifact tables (any thread can have artifacts). |
| AI priority uses `low/medium/high` semantic levels | ✅ Verified | `enum: ["low", "medium", "high"]` + CHECK in `ai_artifact.ts:116, 134`. Proof: 02-task-04-proofs §AC-3. |
| `action_item` with lifecycle state, source revision provenance, nullable destination | ✅ Verified | `lifecycle_state` CHECK, `source_revision_id` FK (ON DELETE SET NULL), `destination_integration_id` nullable in `schema/action_item.ts`. validate-task-04 PASS. |
| Dismissed retained; confirmed survive later revisions | ✅ Verified | No cascade delete on dismissal; `source_revision_id` SET NULL preserves confirmed items. Proof: 02-task-04-proofs §AC-5. |
| Revision-aware thread embedding for semantic search | ✅ Verified | `schema/embedding.ts` — `thread_embedding` FK to `thread_revision_id`, F32_BLOB vector storage. |
| Hidden/trashed threads excludable from semantic search | ✅ Verified | `is_search_excluded` flag + `thread_embedding_search_excluded_idx`. |

#### Unit 4 — Object-Backed Attachments and External Mutation Tracking

| Requirement | Status | Evidence |
|---|---|---|
| Attachment model for synced messages | ✅ Verified | `attachment` table in `schema/object_asset.ts`; FK to `message`. Proof: 02-task-04-proofs §AC-7. |
| Attachment metadata + stable object-storage references | ✅ Verified | `object_asset` table with `bucket`, `object_key`, `storage_provider`; `attachment.object_asset_id` FK. |
| Eager attachment ingestion with partial success | ✅ Verified | `ingestion_state` + nullable `object_asset_id`; validate-task-04 assertions on `pending`/`failed` parent-row intact PASS. |
| Explicit attachment ingestion lifecycle state | ✅ Verified | `ingestion_state` enum CHECK `IN ('pending', 'uploaded', 'failed', 'skipped')` in `object_asset.ts:216–249`. |
| Raw provider/message payload snapshots via object storage | ✅ Verified | `raw_payload_ref` table referencing `object_asset`; no blob columns in libSQL. |
| Shared object-asset concept for attachments and raw payloads | ✅ Verified | Both `attachment` and `raw_payload_ref` FK to `object_asset`. |
| Unified `integration_mutation_journal` for outbound writes | ✅ Verified | `schema/integration_mutation_journal.ts` — single journal table, `mutation_target` discriminator covers both write targets. |
| Mutation entries idempotency-aware | ✅ Verified | `UNIQUE INDEX imj_idempotency_key_unique ON (mutation_target, idempotency_key)`. Proof: 02-task-05-proofs §AC-3. |
| Action items reference exactly one destination integration when confirmed | ✅ Verified | `destination_integration_id` nullable FK on `action_item`; lifecycle state validates exclusivity. |

### Repository Standards

| Standard Area | Status | Evidence & Compliance Notes |
|---|---|---|
| Monorepo: domain schema in `apps/server/` | ✅ PASS | All 13 schema modules + 5 migrations + 3 validation scripts live under `apps/server/`. No cross-app drift. |
| Bun workflows + existing DB scripts | ✅ PASS | Proofs cite `bun run generate`, `bun run migrate`, `bun run lint`, `bun run typecheck`; no ad-hoc commands. Re-verified by reviewer: all exit 0. |
| Drizzle typed schema split per domain area | ✅ PASS | 13 schema files split by concept, single barrel at `schema/index.ts`. Generated SQL lives in `apps/server/drizzle/`. |
| snake_case file naming | ✅ PASS | All files: `connected_account.ts`, `action_item.ts`, `object_asset.ts`, etc. |
| CONTEXT.md glossary alignment | ✅ PASS | Schema uses `connected_account`, `destination_integration`, `screening_state`, `category`, `email_identity`, `sender_routing_rule`, `thread_revision`, `integration_mutation_journal` exactly as glossed. |
| Conventional Commits | ✅ PASS | Final merged commit `feat(server-db): implement atlas domain schema (#23)`. Branch commits use `feat(db):`, `feat(schema):`, `docs(spec-02):`, `refactor(server/db):` consistently. Three branch-only `interim` commits squash-merged away — not blocking. |
| Biome formatting (tabs, organize imports) | ✅ PASS | `bun run lint` re-run during validation: "Checked 29 files in 7ms. No fixes applied." Exit 0. |
| `bun run typecheck` clean | ✅ PASS | Re-run during validation: tsc --noEmit exit 0 across `@hay/server` and `@hay/web`. |
| Typed Drizzle exports over raw SQL | ✅ PASS | All schema declarations are typed `sqliteTable(...)` exports. Validation scripts also use Drizzle ORM (`eq`, `drizzle/libsql`); no raw SQL in app code. |

### Proof Artifacts

| Unit/Task | Proof Artifact | Status | Verification Result |
|---|---|---|---|
| Task 1.0 — Schema module layout | `02-proofs/02-task-01-proofs.md` (239 lines) | ✅ PASS | Front-loads context (header → diagram → CLI output). 6/6 acceptance criteria verified. Captures all four CLI commands with exit 0. |
| Task 2.0 — Account/identity/sync foundation | `02-proofs/02-task-02-proofs.md` (373 lines) | ✅ PASS | Front-loads file inventory table; AC-1..AC-8 each have schema-line + migration-line citations. 8/8 PASS. |
| Task 3.0 — Thread/message/screening | `02-proofs/02-task-03-proofs.md` (463 lines) | ✅ PASS | Front-loads table inventory; AC-1..AC-11 each cite schema and migration lines. 11/11 PASS. |
| Task 4.0 — Revision/AI/action-item/attachment | `02-proofs/02-task-04-proofs.md` (358 lines) | ✅ PASS | Front-loads header + schema/migration scope. 10/10 AC PASS. Documents vector-index DDL deferral per spec §Technical Considerations. |
| Task 5.0 — Mutation journal + final | `02-proofs/02-task-05-proofs.md` (293 lines) | ✅ PASS | Captures all four CLI commands; full domain-concept → schema-file mapping; 10/10 AC PASS. |
| Executable validation: `validate-task-02.ts` | `apps/server/src/db/validate-task-02.ts` | ✅ PASS | Re-run during validation: **33 passed, 0 failed**. |
| Executable validation: `validate-task-03-invariants.ts` | `apps/server/src/db/validate-task-03-invariants.ts` | ✅ PASS | Re-run during validation: **12 passed, 0 failed**. |
| Executable validation: `validate-task-04-lifecycle.ts` | `apps/server/src/db/validate-task-04-lifecycle.ts` | ✅ PASS | Re-run during validation: **14 passed, 0 failed**. |
| Drizzle generate (no schema drift) | `cd apps/server && bun run generate` | ✅ PASS | Re-run during validation: "No schema changes, nothing to migrate 😴" — 23 tables enumerated. Exit 0. |

---

## Validation Issues

No CRITICAL or HIGH issues found. The following INFO-level observations are non-blocking and recorded for completeness:

### INFO-1 — `docs/specs/` is gitignored; proofs only live on feature branch

The repository's `.gitignore` excludes `docs/specs/` (intentional — captured in `.weave/learnings/02-spec-domain-db-schema.md`). The task list `02-tasks-domain-db-schema.md` and the five `02-proofs/02-task-0N-proofs.md` files exist on `feat/db-atlas-domain-schema` but were not pulled into `main` because of the ignore rule. They were checked out from the branch for this validation using:

```sh
git checkout feat/db-atlas-domain-schema -- \
  docs/specs/02-spec-domain-db-schema/02-proofs/ \
  docs/specs/02-spec-domain-db-schema/02-tasks-domain-db-schema.md
```

This validation report is being committed with `git add -f` per the instructions, matching how prior spec-02 proofs were force-added on the feature branch (commit `fd97db4`).

**Severity:** INFO — by-design repository policy, no action required.

### INFO-2 — Three `interim` branch commits

The feature branch has commits `d7563b8`, `6620579`, `beb9943` titled simply `interim` — not Conventional Commits. These were squashed away when PR #23 merged to `main` as a single conventional commit `feat(server-db): implement atlas domain schema (#23)`, so they have no impact on the merged history. **Severity:** INFO — squashed before merge.

### INFO-3 — `bun run migrate` requires local `.env`

The validation script setup requires a local `TURSO_DATABASE_URL` (e.g., `file:./local.db`) in `apps/server/.env` to run `bun run migrate` end-to-end. This was documented in `.weave/learnings/02-spec-domain-db-schema.md` as a workflow improvement suggestion. The proofs work around it correctly by using an inline env var. **Severity:** INFO — workflow improvement noted in learnings.

---

## Validation Gates

| Gate | Description | Result |
|---|---|---|
| **A** | Any CRITICAL/HIGH issue → FAIL | ✅ PASS — 0 CRITICAL/HIGH issues |
| **B** | No Unknown entries in coverage matrix | ✅ PASS — all 35+ FR rows are Verified; all 5 proof rows PASS |
| **C** | All proof artifacts accessible and functional | ✅ PASS — 5/5 markdown proofs present (on branch); 3/3 executable validation scripts run green |
| **D1** | No unmapped out-of-scope core changes | ✅ PASS — all 33 changed files map to spec scope (`apps/server/src/db/`, `apps/server/drizzle/`, `apps/server/drizzle.config.ts`, plus `.gitignore` and `.weave/learnings/`) |
| **E** | Repository standards followed | ✅ PASS — Bun + Drizzle workflows, snake_case file names, Biome clean, Conventional Commits on merged history, CONTEXT.md glossary preserved |
| **F** | No sensitive data in proof artifacts | ✅ PASS — grep for AWS keys, Stripe keys, GitHub PATs, Slack tokens, password assignments returns 0 matches across `docs/specs/02-spec-domain-db-schema/` |

**All gates PASS.**

---

## Evidence Appendix

### Re-verified during validation

```text
$ bun run lint               → 3 tasks PASS, 0 fixes (cached + fresh)
$ bun run typecheck          → 2 tasks PASS, exit 0
$ cd apps/server && bun run generate
    → 23 tables enumerated, "No schema changes, nothing to migrate 😴"
$ bun apps/server/src/db/validate-task-02.ts
    → 33 passed, 0 failed
$ bun apps/server/src/db/validate-task-03-invariants.ts
    → 12 passed, 0 failed
$ bun apps/server/src/db/validate-task-04-lifecycle.ts
    → 14 passed, 0 failed
```

### Schema-to-spec coverage (23 tables, 4 auth + 19 domain)

```
auth.ts                          → user, session, account, verification
connected_account.ts             → connected_account
contact.ts                       → contact, email_identity
destination_integration.ts       → destination_integration
sync.ts                          → sync_state, sync_job
thread.ts                        → thread, message, message_participant
sender_routing_rule.ts           → sender_routing_rule
revision.ts                      → thread_revision
ai_artifact.ts                   → ai_thread_summary, ai_thread_priority
action_item.ts                   → action_item
object_asset.ts                  → object_asset, attachment, raw_payload_ref
embedding.ts                     → thread_embedding
integration_mutation_journal.ts  → integration_mutation_journal
```

### Migration files reproducibility

```
apps/server/drizzle/
  0000_skinny_agent_brand.sql        (pre-spec auth baseline)
  0001_many_captain_flint.sql        (Task 2 — foundation)
  0002_condemned_cobalt_man.sql      (Task 3 — thread/message)
  0003_outstanding_mach_iv.sql       (Task 4 — revision/AI/attachment)
  0004_swift_robbie_robertson.sql    (Task 5 — mutation journal)
  0005_pr23-constraint-fixes.sql     (post-review constraint hardening)
  meta/_journal.json                 (6 entries — matches files)
```

### Sensitive-data scan

```
$ grep -rE "(sk_live|sk_test|AKIA[A-Z0-9]{16}|ghp_[A-Za-z0-9]{30,}|xox[a-z]-.{20,})" \
       docs/specs/02-spec-domain-db-schema/
    → 0 matches
```

---

**Validation Completed:** 2026-05-27
**Validation Performed By:** Claude (weft agent)
**Validated Against:** `e14b35d2864655bbb4af9fb3d04aa9a6fbb04ce6` (main, merged PR #23)
**Verdict:** ✅ **APPROVE**
