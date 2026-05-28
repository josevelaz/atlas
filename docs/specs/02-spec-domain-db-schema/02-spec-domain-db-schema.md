# 02-spec-domain-db-schema.md

## Introduction/Overview

This feature defines the first complete Atlas domain database schema for the server app before additional backend feature work lands. Today the server database only contains Better Auth tables; this spec adds the durable domain model needed for connected mailboxes, threads, messages, screening, action items, AI-derived artifacts, sync operations, attachments, and outbound integration writes.

The primary goal is to establish a migration-backed schema in `apps/server` that is complete enough for future email sync, Screener, categories, AI, semantic search, and action-item integrations without forcing later features to invent core data structures ad hoc.

## Goals

- Define a complete Atlas domain schema in `apps/server/src/db/` that covers all agreed MVP and near-term domain entities required by issue #3.
- Generate and apply Drizzle migrations cleanly for the new schema using the repository's Bun + Drizzle workflow.
- Preserve Atlas domain language and invariants from `CONTEXT.md`, especially the distinction between Screening State, Category, Connected Account, Destination Integration, and Email Identity.
- Model future-critical data relationships now so later sync, AI, and integration work can build on stable tables instead of revisiting foundations.
- Establish proof that the schema supports the expected high-frequency queries, lifecycle states, and retention rules without relying on raw SQL-only application patterns.

## User Stories

- **As an Atlas user**, I want my connected mailboxes, synced threads, and messages stored in a consistent domain model so that Atlas can organize mail without losing state when features are added later.
- **As an Atlas user**, I want Atlas to preserve Screener decisions, categories, handling states, and hidden/recoverable thread behavior so that the app behaves consistently across syncs and restores.
- **As an Atlas user**, I want confirmed action items, AI summaries, and search artifacts tied to stable thread history so that suggestions and search results remain explainable as my threads evolve.
- **As an Atlas engineer**, I want a complete, migration-backed schema now so that later features such as email sync, AI extraction, and destination integrations can be implemented without redefining core data ownership.
- **As an Atlas engineer**, I want schema-level uniqueness, lifecycle, and retention rules encoded clearly so that junior developers can extend the system safely.

## Demoable Units of Work

### Unit 1: Account, Identity, and Integration Foundation

**Purpose:** Establish durable ownership boundaries for mailbox accounts, contacts, email identities, destination integrations, and sync state so later features build on stable roots.

**Functional Requirements:**
- The system shall define a domain `connected_account` model separate from Better Auth `account` records.
- The system shall represent `connected_account` lifecycle separately from per-run sync jobs, including retained-history disconnect and reactivation semantics.
- The system shall store encrypted provider tokens on `connected_account` with explicit encryption metadata needed for future rotation and decryption.
- The system shall define user-scoped `contact` and `email_identity` models where exact email identities are unique per user.
- The system shall preserve exact-email routing semantics so sender screening and sender routing rules remain keyed by exact email identity per connected account.
- The system shall define user-scoped `destination_integration` records that are distinct from mailbox-connected accounts.
- The system shall define durable `sync_state` and append-only `sync_job` models as separate concepts.

**Proof Artifacts:**
- File review: `apps/server/src/db/` contains separate schema files for `connected_account`, `contact`, `email_identity`, `destination_integration`, `sync_state`, and `sync_job`, with clear foreign keys and lifecycle columns, demonstrates foundational entity coverage.
- CLI: `bun run db:generate` completes successfully and produces migration SQL demonstrates Drizzle schema validity.
- CLI: `bun run db:migrate` applies cleanly against a fresh database demonstrates migration usability.
- Migration review: generated SQL contains expected uniqueness and foreign-key constraints for mailbox identity, email identity, and destination integration ownership demonstrates invariant enforcement.

### Unit 2: Thread, Message, and Screening Model

**Purpose:** Define the durable mail-conversation model that Atlas uses for Screener, accepted categories, message history, and mailbox-native thread identity.

**Functional Requirements:**
- The system shall define `thread` records scoped to a single connected account and uniquely keyed to the provider-native thread identity within that account.
- The system shall define `message` records scoped to a single connected account and uniquely keyed to the provider-native message identity within that account.
- The system shall model `screening_state` separately from `category`.
- The system shall allow `category` to be null for non-accepted threads and require exactly one category for accepted threads.
- The system shall store the thread's initiating sender explicitly to support screening and routing decisions.
- The system shall persist rejected-sender threads and messages while marking them hidden from normal Atlas experiences.
- The system shall preserve prior category values for previously accepted threads that later become hidden due to sender rejection so restoration is lossless.
- The system shall normalize message participants instead of relying only on JSON recipient arrays.
- The system shall allow Trash on Screener threads while keeping Archive and Handling State limited to accepted threads.
- The system shall keep pending Screener threads searchable by default while excluding hidden rejected and trashed threads from normal search.

**Proof Artifacts:**
- File review: `apps/server/src/db/` contains separate schema files for `thread`, `message`, participant-related tables, and sender routing rules, with screening/category columns whose nullability aligns to the glossary, demonstrates thread model correctness.
- Migration review: generated SQL includes indexes for connected-account thread listing, category filtering, screening/routing lookups, and thread/message joins demonstrates query-shape support.
- Test or script output: a schema-level validation script or focused test proving accepted threads require category while non-accepted threads may omit category demonstrates core state invariants.

### Unit 3: Revision-Aware AI, Action Item, and Search Artifacts

**Purpose:** Model derived Atlas intelligence in a way that remains auditable as thread content changes.

**Functional Requirements:**
- The system shall define an explicit thread content revision concept that advances when effective thread content changes, including reparsing that materially changes normalized content.
- The system shall not advance thread content revision for Atlas-only overlay changes such as read state, category, archive, trash, or handling state.
- The system shall store AI-derived artifacts in revision-aware structures rather than only as mutable thread columns.
- The system shall allow AI summary and AI priority artifacts to exist for pending Screener threads.
- The system shall represent AI priority using semantic levels `low`, `medium`, and `high` rather than numeric ordinals.
- The system shall define `action_item` records with explicit lifecycle state, source revision provenance, and nullable destination reference until confirmation.
- The system shall retain dismissed action items and preserve confirmed action items across later thread revisions.
- The system shall define revision-aware thread embedding storage suitable for semantic search and compatible with libSQL vector indexing.
- The system shall support exclusion of hidden rejected and trashed threads from normal semantic search.

**Proof Artifacts:**
- File review: `apps/server/src/db/` contains separate schema files for thread revision, AI artifact, action item, and thread embedding models with source-revision relationships demonstrates revision-aware design.
- Migration review: generated SQL includes vector-storage columns and index DDL for embeddings demonstrates semantic-search readiness.
- Test or script output: a focused validation proving action items can exist before destination selection and retain provenance to source revision demonstrates lifecycle correctness.

### Unit 4: Object-Backed Attachments and External Mutation Tracking

**Purpose:** Add the storage and outbound-write support required for attachments, raw payload retention, and reliable external integrations.

**Functional Requirements:**
- The system shall define an attachment model for synced messages.
- The system shall store attachment metadata and stable object-storage references in the relational schema while storing binary attachment content in object storage rather than libSQL.
- The system shall support eager attachment ingestion during sync while allowing partial success when attachment upload fails.
- The system shall define explicit attachment ingestion/storage lifecycle state separate from message sync state.
- The system shall retain raw provider/message payload snapshots using object storage references rather than database blobs.
- The system shall introduce a shared object-asset/blob reference concept for attachment content and raw payload snapshots.
- The system shall define a unified `integration_mutation_journal` model for outbound writes to connected accounts and destination integrations.
- The system shall make integration mutation entries idempotency-aware so retries can be recognized safely.
- The system shall allow action items to reference exactly one destination integration when confirmed.

**Proof Artifacts:**
- File review: `apps/server/src/db/` contains separate schema files for attachment, object-asset, raw-payload reference, and integration mutation journal tables demonstrates storage/integration completeness.
- Migration review: generated SQL shows foreign keys and indexes for attachment lookups, object-asset references, and integration mutation reconciliation demonstrates operational readiness.
- Test or script output: a focused validation proving an attachment record can exist in a failed/pending ingestion state without invalidating the parent message demonstrates partial-success behavior.

## Non-Goals (Out of Scope)

1. **Feature implementation**: This spec does not implement mailbox sync, UI flows, AI pipelines, or integration jobs; it only defines the schema and migration blueprint they will depend on.
2. **Historical mailbox backfill logic**: The schema must support the product model, but this work does not add import or sync behavior beyond what the data model requires.
3. **Full destination preference system**: User-level routing preferences for choosing default destination integrations are deferred.
4. **Multi-destination action-item fanout**: One action item syncing to many external systems is out of scope.
5. **Blob-serving infrastructure**: S3/object-storage provisioning, delivery URLs, and runtime file-serving behavior are not part of this schema spec.

## Design Considerations

No specific visual design requirements are identified for this feature. The main UX-sensitive requirement is preserving Atlas domain language and behavior from `CONTEXT.md`, including:

- Screener is not a category.
- Categories apply only to accepted threads.
- Connected Account and Destination Integration are distinct concepts.
- Search and visibility behavior must align with hidden rejected threads, archived threads, trashed threads, and pending Screener threads.

## Repository Standards

- Follow the existing monorepo structure: domain schema work belongs in `apps/server/`.
- Use Bun-based repository workflows and existing database scripts (`bun run db:generate`, `bun run db:migrate`) rather than ad hoc commands.
- Keep Drizzle schema definitions as the typed source of truth in `apps/server/src/db/`, split by table or domain area into separate schema files, and keep generated SQL in `apps/server/drizzle/`.
- Preserve existing snake_case file naming and current code style conventions already enforced in the repository.
- Keep implementation aligned with `CONTEXT.md` glossary terms and existing ADR/doc language.
- Use conventional commits for later implementation work, and keep scope focused to this database-foundation feature.
- Prefer typed Drizzle schema exports over scattering raw SQL strings through application code.

## Technical Considerations

- Atlas uses Drizzle ORM with the SQLite/libSQL dialect in `apps/server`; the implementation should extend that existing pattern rather than introducing a second data-access layer.
- Current Drizzle guidance supports keeping schema definitions in TypeScript as the source of truth, expressing relations and indexes close to table definitions, splitting schema declarations into maintainable files, and generating migrations from those schema files. This spec follows that pattern.
- For enum-like fields in SQLite/libSQL, implementation should use explicit constrained value sets in the application schema and migration logic so semantic domain values remain clear and type-safe.
- Current libSQL guidance supports vector storage and vector-search primitives in SQLite-compatible schemas. The implementation should store embeddings in a libSQL-compatible vector representation and create the appropriate vector index DDL supported by the installed runtime.
- Because repository/runtime support for exact vector-index DDL can vary by libSQL version, implementation must verify the concrete vector index syntax against the version in use before finalizing migration SQL. If the installed runtime does not support the planned vector index DDL, the implementation shall still ship the embedding table in this feature and defer only the vector-index DDL to a follow-up migration.
- The schema should favor explicit lifecycle/state columns where Atlas domain behavior depends on state transitions, rather than inferring meaning from nullable timestamps alone.
- Revision-aware derived data should be modeled explicitly because Atlas already defines thread-version-sensitive AI behavior in `CONTEXT.md`.
- The schema should separate durable current stream state (`sync_state`) from append-only operational run history (`sync_job`).
- The schema should use a shared object-asset concept so attachment blobs and raw payload snapshots do not invent independent storage-reference semantics.
- The implementation should use both database-level `CHECK` constraints and application-level validation where practical: database constraints for stable single-row invariants such as enum-like state sets and nullability rules, and application-level validation for cross-table or workflow invariants that would be brittle or unclear in SQLite/libSQL constraint logic.

## Security Considerations

- Provider access and refresh tokens are sensitive credentials and must remain encrypted at rest.
- Encryption metadata required for future key rotation/decryption must be stored alongside encrypted token material.
- Migration files, proof artifacts, and committed fixtures must not contain live provider tokens, secrets, real user message bodies, or real object-storage credentials.
- Raw message/provider payload snapshots may contain sensitive personal content; retention and access should be treated as sensitive-data storage, not debugging convenience.
- Object-storage references for attachments and raw payloads must avoid exposing public secrets in committed code or proofs.
- Outbound integration mutation records should carry idempotency-safe identifiers but should not leak provider secrets.

## Success Metrics

1. **Schema completeness**: The approved schema covers all in-scope domain concepts from issue #3 plus the clarified domain decisions captured during planning, with no known missing root entity required for MVP backend work.
2. **Migration reliability**: `bun run db:generate` and `bun run db:migrate` succeed against a fresh database with no manual cleanup required.
3. **Invariant coverage**: The final schema and migration artifacts encode the agreed uniqueness, lifecycle, and nullability rules for connected accounts, threads, messages, routing rules, revisions, and action items.
4. **Future-feature readiness**: Follow-on work for sync, Screener, AI, semantic search, and action-item integrations can reference existing tables rather than inventing new foundational ownership models.

## Open Questions

No open questions at this time.
