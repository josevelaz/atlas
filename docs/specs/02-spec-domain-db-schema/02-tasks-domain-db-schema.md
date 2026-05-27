## Relevant Files

| File | Why It Is Relevant |
| --- | --- |
| `docs/specs/02-spec-domain-db-schema/02-spec-domain-db-schema.md` | Source spec whose functional requirements and proof artifacts must be fully covered. |
| `apps/server/src/db/schema.ts` | Current monolithic Drizzle schema that will likely be decomposed into split schema modules. |
| `apps/server/src/db/index.ts` | Current DB entry point that imports the schema barrel and will need updated exports after schema splitting. |
| `apps/server/src/db/` | Target directory for separate schema files grouped by table or domain area. |
| `apps/server/drizzle.config.ts` | Drizzle Kit configuration; may need schema entrypoint updates once the schema is split. |
| `apps/server/drizzle/` | Generated migration output directory that will receive the new domain-schema migration files. |
| `apps/server/drizzle/meta/_journal.json` | Existing Drizzle migration journal that will be advanced by the new migration set. |
| `apps/server/src/auth.ts` | Better Auth setup that already owns auth tables and helps preserve the boundary between auth `account` and domain `connected_account`. |
| `apps/server/src/config.ts` | Runtime config and env handling for libSQL/Turso and object-storage settings that influence schema validation expectations. |
| `apps/server/.env.example` | Environment documentation that may need alignment if schema work introduces new documented runtime/storage assumptions. |
| `CONTEXT.md` | Canonical glossary for domain names and invariants that the schema must preserve. |
| `README.md` | Repository workflow reference for Bun scripts, migration commands, and server DB conventions. |

### Notes

- Unit or schema-validation tests should follow existing repository patterns and run through Bun-based scripts where practical.
- Use the real repository commands in proof artifacts and implementation: `bun run generate`, `bun run migrate`, `bun run lint`, and `bun run typecheck`.
- Keep schema definitions split across files in `apps/server/src/db/`, with a single barrel export consumed by `apps/server/src/db/index.ts` and Drizzle Kit.

## Tasks

### [x] 1.0 Establish the server DB schema module layout and migration entrypoints

#### 1.0 Proof Artifact(s)

- Diff: `apps/server/src/db/` shows schema split into separate table/domain files plus updated barrel exports demonstrates Drizzle source-of-truth layout matches repository standards
- CLI: `bun run generate` from repo root exits successfully and creates a new migration under `apps/server/drizzle/` demonstrates the split schema layout is valid for Drizzle Kit
- CLI: `bun run migrate` from repo root exits successfully against a fresh local database demonstrates the migration workflow still works end-to-end

#### 1.0 Tasks

- [x] 1.1 Inventory the current auth-only schema, DB entrypoint, and Drizzle config so the split-schema refactor preserves existing Better Auth tables and migration generation behavior.
- [x] 1.2 Define the target schema module layout in `apps/server/src/db/`, including a barrel export strategy that keeps Drizzle and runtime imports pointed at one source-of-truth entrypoint.
- [x] 1.3 Split the existing auth table definitions and relations out of `schema.ts` into dedicated schema files without changing current table names or auth behavior.
- [x] 1.4 Update `apps/server/src/db/index.ts` and `apps/server/drizzle.config.ts` so both runtime DB access and Drizzle Kit read the split schema layout correctly.
- [x] 1.5 Verify the refactor baseline with `bun run generate`, `bun run migrate`, `bun run lint`, and `bun run typecheck` so later domain-table work starts from a stable structure.

### [ ] 2.0 Add account, identity, integration, and sync foundation tables

#### 2.0 Proof Artifact(s)

- File review: `apps/server/src/db/` contains separate schema files for `connected_account`, `contact`, `email_identity`, `destination_integration`, `sync_state`, and `sync_job` demonstrates foundational domain coverage
- Migration review: generated SQL under `apps/server/drizzle/` contains ownership foreign keys plus uniqueness constraints for mailbox identity, email identity, and destination integration dedupe demonstrates invariant enforcement
- Test or script: a focused schema validation command or test proves reconnect/reactivation and separate sync-state vs sync-job modeling are representable without violating constraints demonstrates lifecycle correctness

#### 2.0 Tasks

- [ ] 2.1 Add schema files for `connected_account`, `contact`, `email_identity`, `destination_integration`, `sync_state`, and `sync_job`, keeping ownership rooted in the existing `user` table.
- [ ] 2.2 Encode the agreed lifecycle and uniqueness rules for mailbox identity, reconnect/reactivation, exact-email identity uniqueness per user, and destination integration dedupe.
- [ ] 2.3 Model encrypted token storage and encryption metadata on `connected_account` without collapsing the boundary between Better Auth `account` and Atlas mailbox integrations.
- [ ] 2.4 Add relations and indexes that support mailbox lookup, exact-email routing ownership, user-scoped contact resolution, and separate current sync state versus append-only sync-job history.
- [ ] 2.5 Generate migration SQL and add a focused validation artifact that proves the foundational ownership and lifecycle constraints are representable cleanly.

### [ ] 3.0 Add the thread, message, screening, and participant model

#### 3.0 Proof Artifact(s)

- File review: `apps/server/src/db/` contains separate schema files for `thread`, `message`, participant tables, and sender routing rules demonstrates Atlas mail model coverage
- Migration review: generated SQL includes unique constraints for provider thread/message IDs per connected account and indexes for screening/category/routing lookups demonstrates query-shape support
- Test or script: a focused validation proves accepted threads require category, non-accepted threads may omit category, and Screener remains distinct from category demonstrates core glossary invariants

#### 3.0 Tasks

- [ ] 3.1 Add schema files for `thread`, `message`, normalized participant tables, and `sender_routing_rule`, scoped to a single `connected_account`.
- [ ] 3.2 Encode screening-versus-category invariants, including nullable category before acceptance, required category after acceptance, accepted-only archive/handling behavior, and trash support on Screener threads.
- [ ] 3.3 Store the initiating sender explicitly on `thread` and preserve hidden rejected-thread behavior, including retained prior category for lossless restore.
- [ ] 3.4 Add uniqueness constraints and indexes for provider thread IDs, provider message IDs, screening lookups, routing-rule lookup by exact sender email, and common thread/message joins.
- [ ] 3.5 Generate migration SQL and add a focused validation artifact that proves the thread/category/screening invariants hold in the planned schema.

### [ ] 4.0 Add revision-aware AI, action-item, search, attachment, and asset tables

#### 4.0 Proof Artifact(s)

- File review: `apps/server/src/db/` contains separate schema files for thread revisions, AI-derived artifacts, action items, embeddings, attachments, object assets, and raw payload references demonstrates derived-data and storage readiness
- Migration review: generated SQL contains source-revision relationships, attachment/object-asset foreign keys, and libSQL-compatible embedding storage/index DDL demonstrates future AI/search support
- Test or script: a focused validation proves action items can exist before destination selection and attachments can remain in a failed or pending ingestion state without invalidating the parent message demonstrates lifecycle correctness

#### 4.0 Tasks

- [ ] 4.1 Add schema files for thread content revisions, AI summaries and priorities, action items, and embeddings so derived artifacts are tied to explicit source revisions.
- [ ] 4.2 Encode action-item lifecycle rules, including nullable destination integration before confirmation, durable confirmed items across later revisions, dismissed-item retention, and `low|medium|high` semantic priority levels.
- [ ] 4.3 Add schema files for `object_asset`, raw payload references, and attachments so object storage references are shared consistently across payload and blob use cases.
- [ ] 4.4 Encode attachment ingestion state and partial-success behavior so attachment failures do not invalidate the parent message or thread records.
- [ ] 4.5 Add libSQL-compatible embedding storage and planned vector-index migration DDL, then generate migration output and a focused validation artifact for revision and attachment lifecycle behavior.

### [ ] 5.0 Add integration mutation tracking and final schema verification

#### 5.0 Proof Artifact(s)

- File review: `apps/server/src/db/` contains a dedicated schema file for `integration_mutation_journal` with typed mutation metadata and idempotency fields demonstrates outbound write tracking coverage
- Migration review: generated SQL contains indexes and foreign keys for journal reconciliation across connected accounts and destination integrations demonstrates operational readiness
- CLI: `bun run generate && bun run migrate` succeeds after all schema files are added and migration output is committed demonstrates the final schema package is reproducible

#### 5.0 Tasks

- [ ] 5.1 Add a schema file for `integration_mutation_journal` that supports both mailbox and destination-integration outbound writes in one typed journal.
- [ ] 5.2 Encode idempotency, ownership, and reconciliation relationships so journal entries can be retried safely without leaking provider secrets into proof artifacts.
- [ ] 5.3 Review all new schema files, relations, and indexes together to ensure they cover every functional requirement in the spec and preserve glossary terms from `CONTEXT.md`.
- [ ] 5.4 Regenerate and review the final migration set in `apps/server/drizzle/`, confirming foreign keys, uniqueness constraints, and vector/index DDL are present and reproducible.
- [ ] 5.5 Run the final verification commands (`bun run generate`, `bun run migrate`, `bun run lint`, `bun run typecheck`) and capture the proof artifacts needed for later validation.
