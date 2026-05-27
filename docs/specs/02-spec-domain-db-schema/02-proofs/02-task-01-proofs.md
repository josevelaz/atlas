# Task 1.0 Proof Artifact — Establish the server DB schema module layout and migration entrypoints

**Date**: 2026-05-27  
**Branch**: `feat/spec-02-domain-db-schema`  
**Spec**: `docs/specs/02-spec-domain-db-schema/02-spec-domain-db-schema.md`

---

## 1. Schema split layout

### Before (monolithic)

```
apps/server/src/db/
  index.ts      ← imports * from ./schema.ts
  schema.ts     ← all 4 Better Auth tables + relations in one file
```

### After (split)

```
apps/server/src/db/
  index.ts                ← imports * from ./schema/index.ts (runtime DB client)
  schema.ts               ← @deprecated shim, re-exports ./schema/index.ts
  schema/
    auth.ts               ← user, session, account, verification + relations
    index.ts              ← barrel: export * from "./auth.ts"
```

**Drizzle Kit** (`drizzle.config.ts`) now points at `./src/db/schema/index.ts`.

---

## 2. Preserved Better Auth tables

All four Better Auth tables are preserved verbatim in `schema/auth.ts`:

| Table | Columns | Indexes | FKs |
|---|---|---|---|
| `user` | 7 | 1 (unique email) | 0 |
| `session` | 8 | 2 (unique token + userId idx) | 1 → user |
| `account` | 13 | 1 (userId idx) | 1 → user |
| `verification` | 6 | 1 (identifier idx) | 0 |

Table names, column names, and index names are **unchanged** from the original `schema.ts`.

---

## 3. `bun run generate` — from repo root

```
$ bun run generate
turbo run generate --filter=@hay/server

@hay/server:generate: $ drizzle-kit generate
@hay/server:generate: No config path provided, using default 'drizzle.config.ts'
@hay/server:generate: Reading config file '.../apps/server/drizzle.config.ts'
@hay/server:generate: 4 tables
@hay/server:generate: account 13 columns 1 indexes 1 fks
@hay/server:generate: session 8 columns 2 indexes 1 fks
@hay/server:generate: user 7 columns 1 indexes 0 fks
@hay/server:generate: verification 6 columns 1 indexes 0 fks
@hay/server:generate:
@hay/server:generate: No schema changes, nothing to migrate 😴

Tasks: 1 successful, 1 total
```

**Result**: ✅ PASS — Drizzle Kit reads the split schema correctly. No schema drift detected (correct: only file layout changed, not table definitions).

---

## 4. `bun run migrate` — from repo root

```
$ bun run migrate
turbo run migrate --filter=@hay/server

@hay/server:migrate: $ drizzle-kit migrate
@hay/server:migrate: No config path provided, using default 'drizzle.config.ts'
@hay/server:migrate: Reading config file '.../apps/server/drizzle.config.ts'
@hay/server:migrate: [✓] migrations applied successfully!

Tasks: 1 successful, 1 total
```

**Result**: ✅ PASS — Existing migration `0000_skinny_agent_brand` applied cleanly against a fresh local SQLite database.

---

## 5. `bun run lint` — from repo root

```
$ bun run lint
turbo run lint

@hay/server:lint: $ biome lint ./src
@hay/server:lint: Checked 14 files in 3ms. No fixes applied.
@hay/web:lint: Checked 14 files in 7ms. No fixes applied.

Tasks: 3 successful, 3 total
```

**Result**: ✅ PASS — 14 server source files checked, zero lint errors.

---

## 6. `bun run typecheck` — from repo root

```
$ bun run typecheck
turbo run typecheck

@hay/server:typecheck: $ tsc --noEmit
@hay/web:typecheck: $ tsc --noEmit
@hay/desktop:typecheck: Finished `dev` profile [unoptimized + debuginfo] target(s) in 16.12s

Tasks: 3 successful, 3 total
```

**Result**: ✅ PASS — TypeScript compilation clean across all packages.

---

## 7. Key design decisions

1. **Barrel at `schema/index.ts`**: single import point for both Drizzle Kit and the runtime `db` client. Future domain schema files (tasks 2–5) are added here with `export * from "./domain-name.ts"`.
2. **`schema.ts` shim**: kept as a `@deprecated` re-export so any existing code that imports `./schema.ts` continues to work without changes. Will be removed once all consumers migrate.
3. **Local `.env`**: created `apps/server/.env` with `TURSO_DATABASE_URL=file:./local.db` to enable `bun run generate` / `bun run migrate` without a running Turso server. This file is gitignored.
4. **No table changes**: the refactor is purely structural — zero DDL changes, confirmed by `generate` reporting "No schema changes, nothing to migrate".

---

## Reviewer conclusion

The schema module layout is established and verified. The split is clean: Better Auth tables live in `schema/auth.ts`, the barrel at `schema/index.ts` is the single source of truth for both Drizzle Kit and the runtime client, and all four verification commands pass from the repo root. The baseline is stable for subsequent domain-table work in tasks 2.0–5.0.
