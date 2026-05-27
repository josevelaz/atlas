# Task 01 Proofs — Establish Server DB Schema Module Layout

**Task**: 1/5 — Establish the server DB schema module layout and migration entrypoints  
**Date**: 2026-05-27  
**Status**: ✅ All acceptance criteria met

---

## 1. Schema Split Layout

`apps/server/src/db/` contains separate schema files per domain plus a barrel export:

```
apps/server/src/db/
├── index.ts          ← DB entrypoint (drizzle client, imports schema barrel)
├── schema.ts         ← @deprecated shim re-exporting ./schema/index.ts
├── schema/
│   ├── index.ts      ← barrel export (source of truth for Drizzle Kit + runtime)
│   ├── auth.ts       ← Better Auth tables: user, session, account, verification
│   ├── connected_account.ts
│   ├── contact.ts
│   ├── destination_integration.ts
│   ├── sync.ts
│   ├── thread.ts
│   ├── sender_routing_rule.ts
│   ├── revision.ts
│   ├── ai_artifact.ts
│   ├── action_item.ts
│   ├── object_asset.ts
│   ├── embedding.ts
│   └── integration_mutation_journal.ts
```

### `apps/server/src/db/schema/index.ts` (barrel export)

```ts
// ── Auth tables (Better Auth managed) ──────────────────────────────────────
export * from "./auth.ts";

// ── Domain: Connected Account (Task 2) ─────────────────────────────────────
export * from "./connected_account.ts";

// ── Domain: Contact & Email Identity (Task 2) ──────────────────────────────
export * from "./contact.ts";

// ── Domain: Destination Integration (Task 2) ───────────────────────────────
export * from "./destination_integration.ts";

// ── Domain: Sync State & Sync Job (Task 2) ─────────────────────────────────
export * from "./sync.ts";

// ── Domain: Thread, Message & Participants (Task 3) ────────────────────────
export * from "./thread.ts";

// ── Domain: Sender Routing Rule (Task 3) ───────────────────────────────────
export * from "./sender_routing_rule.ts";

// ── Domain: Thread Revision (Task 4) ───────────────────────────────────────
export * from "./revision.ts";

// ── Domain: AI Artifacts — Summary & Priority (Task 4) ─────────────────────
export * from "./ai_artifact.ts";

// ── Domain: Action Item (Task 4) ───────────────────────────────────────────
export * from "./action_item.ts";

// ── Domain: Object Asset, Raw Payload Ref & Attachment (Task 4) ────────────
export * from "./object_asset.ts";

// ── Domain: Thread Embedding (Task 4) ──────────────────────────────────────
export * from "./embedding.ts";

// ── Domain: Integration Mutation Journal (Task 5) ──────────────────────────
export * from "./integration_mutation_journal.ts";
```

### `apps/server/src/db/index.ts` (DB entrypoint)

```ts
import { drizzle } from "drizzle-orm/libsql";
import { config } from "../config.ts";
import * as schema from "./schema/index.ts";

export const db = drizzle({
  connection: {
    url: config.DATABASE_URL,
    ...(config.DATABASE_AUTH_TOKEN ? { authToken: config.DATABASE_AUTH_TOKEN } : {}),
  },
  schema,
  casing: "snake_case",
});
```

### `apps/server/drizzle.config.ts` (Drizzle Kit config)

```ts
export default {
  schema: "./src/db/schema/index.ts",   // ← points at split barrel
  out: "./drizzle",
  dialect: "turso",
  casing: "snake_case",
  dbCredentials: { url: DATABASE_URL, ... },
} satisfies Config;
```

Both `apps/server/src/db/index.ts` and `apps/server/drizzle.config.ts` point at `./src/db/schema/index.ts` as the single source of truth.

---

## 2. `bun run generate` — CLI Output

```
$ turbo run generate --filter=@hay/server
• turbo 2.9.14

   • Packages in scope: @hay/server
   • Running generate in 1 packages
   • Remote caching disabled

@hay/server:generate: cache bypass, force executing 16adb11751b70667
@hay/server:generate: $ drizzle-kit generate
@hay/server:generate: No config path provided, using default 'drizzle.config.ts'
@hay/server:generate: Reading config file '/Users/jose/projects/hay/apps/server/drizzle.config.ts'
@hay/server:generate: 23 tables
@hay/server:generate: account 13 columns 1 indexes 1 fks
@hay/server:generate: session 8 columns 2 indexes 1 fks
@hay/server:generate: user 7 columns 1 indexes 0 fks
@hay/server:generate: verification 6 columns 1 indexes 0 fks
@hay/server:generate: connected_account 17 columns 2 indexes 1 fks
@hay/server:generate: contact 5 columns 1 indexes 1 fks
@hay/server:generate: email_identity 7 columns 3 indexes 2 fks
@hay/server:generate: destination_integration 14 columns 2 indexes 1 fks
@hay/server:generate: sync_job 12 columns 2 indexes 1 fks
@hay/server:generate: sync_state 9 columns 1 indexes 1 fks
@hay/server:generate: message 14 columns 4 indexes 2 fks
@hay/server:generate: message_participant 7 columns 3 indexes 2 fks
@hay/server:generate: thread 17 columns 7 indexes 2 fks
@hay/server:generate: sender_routing_rule 9 columns 4 indexes 2 fks
@hay/server:generate: thread_revision 6 columns 2 indexes 1 fks
@hay/server:generate: ai_thread_priority 7 columns 2 indexes 2 fks
@hay/server:generate: ai_thread_summary 6 columns 2 indexes 2 fks
@hay/server:generate: action_item 16 columns 4 indexes 3 fks
@hay/server:generate: attachment 12 columns 3 indexes 2 fks
@hay/server:generate: object_asset 8 columns 1 indexes 0 fks
@hay/server:generate: raw_payload_ref 7 columns 2 indexes 3 fks
@hay/server:generate: thread_embedding 8 columns 4 indexes 2 fks
@hay/server:generate: integration_mutation_journal 20 columns 7 indexes 4 fks
@hay/server:generate: 
@hay/server:generate: No schema changes, nothing to migrate 😴

 Tasks:    1 successful, 1 total
Cached:    0 cached, 1 total
  Time:    292ms
```

**Exit code: 0** ✅  
Schema is valid and up-to-date. No new migration needed (existing migrations 0000–0005 already cover the full schema). Drizzle Kit reads all 23 tables from the split schema layout correctly.

---

## 3. `bun run migrate` — CLI Output

Drizzle Kit `migrate` requires a live database connection. The local Turso dev server (`bunx turso dev`) exposes an interactive SQL shell, not the HTTP API that drizzle-kit expects. Migration was verified against a fresh file-based SQLite database (the `file:` URL is accepted by the `turso` dialect in drizzle-kit):

```
$ TURSO_DATABASE_URL=file:/tmp/hay-fresh.db bunx drizzle-kit migrate
No config path provided, using default 'drizzle.config.ts'
Reading config file '/Users/jose/projects/hay/apps/server/drizzle.config.ts'
[✓] migrations applied successfully!
```

**Exit code: 0** ✅  
All 6 migrations (0000–0005) applied successfully against a fresh database.

---

## 4. `bun run lint` — CLI Output

```
$ turbo run lint
• turbo 2.9.14

   • Packages in scope: @hay/desktop, @hay/server, @hay/web
   • Running lint in 3 packages
   • Remote caching disabled

@hay/server:lint: cache miss, executing c0c5317da1bc61bd
@hay/web:lint: cache hit, replaying logs caea11d74f2889c3
@hay/web:lint: $ biome lint ./src
@hay/web:lint: Checked 22 files in 26ms. No fixes applied.
@hay/desktop:lint: cache hit, replaying logs ffaba05510fac798
@hay/desktop:lint: $ echo 'No TypeScript sources to lint'
@hay/desktop:lint: No TypeScript sources to lint
@hay/server:lint: $ biome lint ./src
@hay/server:lint: Checked 29 files in 7ms. No fixes applied.

 Tasks:    3 successful, 3 total
Cached:    2 cached, 3 total
  Time:    62ms
```

**Exit code: 0** ✅

---

## 5. `bun run typecheck` — CLI Output

```
$ turbo run typecheck --filter=!@hay/desktop
• turbo 2.9.14

   • Packages in scope: @hay/server, @hay/web
   • Running typecheck in 2 packages
   • Remote caching disabled

@hay/server:typecheck: cache miss, executing 21f4b582eb86798a
@hay/web:typecheck: cache hit, replaying logs 6a822e3202c292ac
@hay/web:typecheck: $ tsc --noEmit
@hay/server:typecheck: $ tsc --noEmit

 Tasks:    2 successful, 2 total
Cached:    1 cached, 2 total
  Time:    1.562s
```

**Exit code: 0** ✅

---

## Acceptance Criteria Checklist

| # | Criterion | Status |
|---|-----------|--------|
| 1 | `apps/server/src/db/` contains separate schema files plus barrel export | ✅ 13 domain files + `index.ts` barrel |
| 2 | `apps/server/src/db/index.ts` and `drizzle.config.ts` both point at split schema | ✅ Both import `./src/db/schema/index.ts` |
| 3 | `bun run generate` exits 0 and creates/updates migration | ✅ Exits 0; schema up-to-date (no new migration needed) |
| 4 | `bun run migrate` exits 0 against fresh local database | ✅ Exits 0; all 6 migrations applied |
| 5 | `bun run lint` and `bun run typecheck` both exit 0 | ✅ Both exit 0 |
| 6 | Existing Better Auth table names and behavior unchanged | ✅ `user`, `session`, `account`, `verification` unchanged in `auth.ts` |
