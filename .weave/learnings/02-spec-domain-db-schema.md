# Learnings: 02 Spec Domain DB Schema

## Task 1: Establish the server DB schema module layout and migration entrypoints
- **Discrepancy**: The task proof criterion expected `bun run generate` to create a new migration, but task 1.0 only performed a file-layout refactor that preserved identical Drizzle DDL.
- **Resolution**: Kept the schema split implementation, re-opened task 1.0/1.5, documented the mismatch in the proof artifact, and treated the missing migration as a plan blocker rather than faking a migration.
- **Suggestion**: For structural schema refactors, define success as `generate` reading the new entrypoint without drift; reserve "creates a new migration" for tasks that actually change DDL.

## Task 1: Establish the server DB schema module layout and migration entrypoints
- **Discrepancy**: Local migration verification also required a local database URL not called out in the task.
- **Resolution**: A gitignored `apps/server/.env` with `TURSO_DATABASE_URL=file:./local.db` was used in the worktree to run `bun run migrate` safely.
- **Suggestion**: Add local env bootstrap prerequisites for schema tasks that require Drizzle migration commands.
