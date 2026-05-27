# Task 1.0 Proof Artifact — Establish the server DB schema module layout and migration entrypoints

**Date**: 2026-05-27 (revised)
**Branch**: `feat/spec-02-domain-db-schema`
**Commit**: `4af4ef8` (schema split) — no new commit; task state re-opened pending resolution
**Spec**: `docs/specs/02-spec-domain-db-schema/02-spec-domain-db-schema.md`

---

## ⚠️ Proof criterion mismatch — explicit disclosure

The task 1.0 proof criterion states:

> CLI: `bun run generate` from repo root exits successfully and **creates a new migration** under `apps/server/drizzle/`

**This criterion cannot be satisfied by a pure file-layout refactor.**

### Why no new migration is produced

Drizzle Kit's `generate` command compares the TypeScript schema against the last committed snapshot (`apps/server/drizzle/meta/0000_snapshot.json`). The split-schema refactor moved table definitions from `schema.ts` into `schema/auth.ts` and wired a barrel at `schema/index.ts` — but the exported tables, columns, indexes, and foreign keys are **byte-for-byte identical** to what the snapshot recorded. Drizzle Kit correctly reports:

```
No schema changes, nothing to migrate 😴
```

This is the **correct and expected output** for a structural refactor with no DDL changes.

### Why producing a new migration would be wrong

The three mechanically possible ways to force a new migration file are all incorrect for this task:

| Approach | Why it is wrong |
|---|---|
| Add a new table/column/index | Out of scope for 1.0; belongs in tasks 2.0–5.0 |
| Delete `0000_snapshot.json` and regenerate | Produces a `0001` migration that re-creates already-applied tables; `bun run migrate` would fail on any existing database with "table already exists" |
| Manually write a no-op migration | Drizzle Kit does not support empty/comment-only migrations; the journal would be inconsistent with the snapshot |

### What the "No schema changes" output actually proves

`generate` reporting "No schema changes, nothing to migrate" with 4 tables, 13+8+7+6 columns, and correct FK/index counts **is the proof** that:

1. Drizzle Kit can read the new barrel entrypoint (`./src/db/schema/index.ts`) correctly
2. The split schema exports exactly the same DDL as the original monolithic `schema.ts`
3. No accidental table/column/index was dropped or added during the refactor
4. The layout is valid for Drizzle Kit

The proof criterion's wording "creates a new migration" was written anticipating that pointing Drizzle Kit at a new entrypoint for the first time might require reconciliation. In practice, because the tables are identical, no reconciliation is needed — which is the correct outcome.

---

## 1. Schema split layout (implemented)

### Before (monolithic)

```
apps/server/src/db/
  index.ts      ← imports * from ./schema.ts
  schema.ts     ← all 4 Better Auth tables + relations in one file
```

### After (split — committed at 4af4ef8)

```
apps/server/src/db/
  index.ts                ← imports * from ./schema/index.ts (runtime DB client)
  schema.ts               ← @deprecated shim, re-exports ./schema/index.ts
  schema/
    auth.ts               ← user, session, account, verification + relations
    index.ts              ← barrel: export * from "./auth.ts"
```

**Drizzle Kit** (`drizzle.config.ts`) points at `./src/db/schema/index.ts`.

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

## 3. `bun run generate` — from repo root (exact output)

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

**Result**: ✅ EXIT 0 — Drizzle Kit reads the split barrel correctly. "No schema changes" is the correct output for a no-DDL refactor.
**New migration produced**: ❌ None — correct; no DDL changed.

---

## 4. `bun run migrate` — from repo root (exact output)

```
$ bun run migrate
turbo run migrate --filter=@hay/server

@hay/server:migrate: $ drizzle-kit migrate
@hay/server:migrate: No config path provided, using default 'drizzle.config.ts'
@hay/server:migrate: Reading config file '.../apps/server/drizzle.config.ts'
@hay/server:migrate: [✓] migrations applied successfully!

Tasks: 1 successful, 1 total
```

**Result**: ✅ PASS — Existing migration `0000_skinny_agent_brand` applied cleanly.

---

## 5. `bun run lint` — from repo root (exact output)

```
$ bun run lint
turbo run lint

@hay/server:lint: $ biome lint ./src
@hay/server:lint: Checked 14 files in 3ms. No fixes applied.
@hay/web:lint: Checked 14 files in 7ms. No fixes applied.

Tasks: 3 successful, 3 total
```

**Result**: ✅ PASS — 14 server source files, 0 errors.

---

## 6. `bun run typecheck` — from repo root (exact output)

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

## 7. Migration files present

```
apps/server/drizzle/
  0000_skinny_agent_brand.sql   ← original auth-table migration (unchanged)
  meta/
    _journal.json               ← 1 entry: 0000_skinny_agent_brand
    0000_snapshot.json          ← snapshot of 4 auth tables (unchanged)
```

No new migration file was produced. This is correct for a no-DDL refactor.

---

## 8. Task 1.0 status assessment

| Sub-task | Status | Evidence |
|---|---|---|
| 1.1 Inventory | ✅ complete | Auth tables, DB entrypoint, Drizzle config documented |
| 1.2 Define layout | ✅ complete | `schema/auth.ts` + `schema/index.ts` barrel created |
| 1.3 Split auth tables | ✅ complete | Tables moved to `schema/auth.ts`, no DDL changes |
| 1.4 Update index.ts + drizzle.config.ts | ✅ complete | Both point at `./schema/index.ts` |
| 1.5 Verify baseline | ⚠️ partial | generate/migrate/lint/typecheck all pass; "new migration" criterion unmet by design |

**Parent task 1.0**: ⚠️ **Blocked on proof criterion wording**

The structural work is complete and correct. The single unmet criterion — "creates a new migration" — conflicts with the no-DDL scope of task 1.0. A new migration can only be produced by adding DDL, which belongs in tasks 2.0–5.0.

---

## 9. Recommended resolution

**Option A (recommended)**: Accept that "No schema changes, nothing to migrate" satisfies the *intent* of the criterion (layout is valid for Drizzle Kit), update the task file to mark 1.0 `[x]`, and note the criterion wording discrepancy here. The first real new migration will be produced in task 2.0 when domain tables are added.

**Option B**: Defer task 1.0 completion until task 2.0 adds the first domain table, at which point `bun run generate` will produce a new migration that also validates the barrel entrypoint. Mark 1.0 `[~]` until then.

**Option C**: Add a minimal placeholder domain table now (e.g., a stub `connected_account` with just `id`) to force a migration, then expand it in task 2.0. This satisfies the criterion literally but adds scope to 1.0.

The safest path that does not hand-wave the discrepancy is **Option B**: keep 1.0 `[~]`, complete it as part of task 2.0 when the first domain migration is generated.

---

## Reviewer conclusion

The schema module layout is established, wired correctly, and verified by all four commands. The sole discrepancy is that the task 1.0 proof criterion requires a new migration file, but a pure file-layout refactor with no DDL changes cannot produce one. This is not a defect in the implementation — it is a mismatch between the proof criterion wording and the no-DDL scope of task 1.0. The recommended resolution is to complete task 1.0 formally when task 2.0 generates the first domain migration, which will simultaneously validate the barrel entrypoint.
