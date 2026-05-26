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

## Task 2: Design Tokens: Wire OKLCH Tokens into Tailwind v4 + Populate DESIGN.md
- **Discrepancy**: Tailwind v4 `@theme` definitions alone did not guarantee all tokens appeared as runtime CSS custom properties before components referenced them.
- **Resolution**: Added a mirrored `:root` block alongside `@theme` so proof capture and early runtime usage could resolve every token deterministically.
- **Suggestion**: Mention the `:root` mirror pattern explicitly whenever proofs or early component work need token values before utility usage exists.

## Task 2: Design Tokens: Wire OKLCH Tokens into Tailwind v4 + Populate DESIGN.md
- **Discrepancy**: Biome did not parse `@theme {}` out of the box and flagged reduced-motion `!important` declarations needed for accessibility overrides.
- **Resolution**: Enabled `css.parser.tailwindDirectives` in `biome.json` and added narrowly scoped `biome-ignore` comments for the reduced-motion rule.
- **Suggestion**: Add Biome Tailwind-directive parser setup and reduced-motion lint expectations to the task steps when introducing Tailwind v4 tokens.

## Task 2: Design Tokens: Wire OKLCH Tokens into Tailwind v4 + Populate DESIGN.md
- **Discrepancy**: Running the dev server surfaced an existing mismatch between the snake_case route filename `tanstack_libraries.tsx` and its hyphenated `createFileRoute("/dev/tanstack-libraries")`, which dirtied `routeTree.gen.ts` during verification.
- **Resolution**: Corrected the route path to `/dev/tanstack_libraries` and committed the regenerated route tree so the worktree stayed clean after frontend validation.
- **Suggestion**: After filename-normalization tasks, immediately run the route generator once and reconcile any file-path-to-route-path drift before later tasks depend on a clean worktree.
