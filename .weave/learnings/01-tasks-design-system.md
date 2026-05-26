# Learnings: 01 Tasks Design System

## Task 1: Bootstrap Tooling: Biome snake_case Rule + Solid UI Init
- **Discrepancy**: The dedicated `feat/issue-2-design-system` worktree did not contain `docs/specs/01-spec-design-system/*`, even though task execution requires task/audit/proof files to live with the implementation branch.
- **Resolution**: Copied the task and audit files from the main checkout into the feature worktree before executing task 1.0 so state/proof updates could be committed on-branch.
- **Suggestion**: Create spec/task/audit files on the implementation branch before `/SDD-3` starts, or explicitly instruct the implementer to sync them into the worktree first.

## Task 1: Bootstrap Tooling: Biome snake_case Rule + Solid UI Init
- **Discrepancy**: `solidui-cli@0.7.2 init` is fully interactive in this environment and the config schema uses `aliases.components`, not a top-level `componentDir` field named in the plan.
- **Resolution**: Recreated the init artifacts manually from the CLI’s schema/behavior, documented the schema evidence in the proof file, and used `aliases.components = "src/components/ui"` as the safe equivalent.
- **Suggestion**: Update the task wording to call out `aliases.components` for current `solidui-cli` versions and note that non-interactive environments may require manual artifact creation.

## Task 1: Bootstrap Tooling: Biome snake_case Rule + Solid UI Init
- **Discrepancy**: Proving `bunx solidui-cli@latest add button` functionality writes component files and dependencies that belong to future task 3.0, which conflicts with the task-boundary commit model.
- **Resolution**: Captured CLI evidence in the proof file, then reverted the generated component files and dependency change so task 1.0 stayed within scope.
- **Suggestion**: Explicitly instruct that CLI verification artifacts may be captured and then reverted when they would otherwise pre-implement later tasks.
