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

## Task 3: Base Components: Button, Avatar, Badge
- **Discrepancy**: The plan requires screenshot proof from `/dev/design-system` for task 3.0 while task 5.0 owns the committed showcase route, and the retry still produced evidence from a temporary `/dev/design_system` harness plus a non-visual pressed-state proof.
- **Resolution**: Marked task 3.0 blocked after one retry because the current artifacts do not satisfy the plan exactly enough to mark the parent task complete, even though the component code and lint/typecheck evidence are present.
- **Suggestion**: Clarify whether task 3.0 may use a temporary committed harness or whether task 5.0 should be pulled earlier so screenshot proof for Button/Avatar/Badge can be captured on the exact `/dev/design-system` route without crossing task boundaries.

## Task 3: Base Components: Button, Avatar, Badge
- **Discrepancy**: Exact task-3 proofs depended on a committed hyphenated showcase route and live hydration, which were not available during the first two proof passes.
- **Resolution**: After the shared blocker fix introduced `/dev/design-system` and working hydration, re-captured all task-3 screenshots from the committed route and adjusted the avatar demo names to cover all six hash-derived palette colors.
- **Suggestion**: Schedule shared runtime/route fixes before proof-heavy component tasks, and choose showcase data that exercises every required visual bucket from the start.

## Task 4: Base Components: Toggle + Icon
- **Discrepancy**: The plan requires proof from `/dev/design-system` and a click-driven checked-state screenshot, but the retry still depended on a temporary `/dev/design_system` harness and static checked-state evidence because of an app-wide hydration failure.
- **Resolution**: Marked task 4.0 blocked after one retry because the component implementation is present but the available proof does not meet the plan literally enough to mark the parent task complete.
- **Suggestion**: Either allow proof capture on the eventual committed task-5 showcase route after it exists, or explicitly permit nearest-exact evidence when a pre-existing hydration bug prevents trusted interactive screenshots.

## Task 4: Base Components: Toggle + Icon
- **Discrepancy**: Exact task-4 proofs depended on the shared hydration fix and the committed `/dev/design-system` route, so the original static checked-state evidence became obsolete once the blocker was resolved.
- **Resolution**: Re-captured the toggle unchecked/checked and icon screenshots from the committed route after the hydration fix, deleted the stale hydration-bug evidence artifact, and verified the checked-state screenshot was produced by a real click-driven interaction.
- **Suggestion**: When proof artifacts depend on shared runtime behavior, revisit and prune stale workaround evidence after the underlying blocker is fixed so the proof set stays minimal and exact.

## Task 5: Dev Route: `/dev/design-system` Showcase Page
- **Discrepancy**: The plan specified a hyphenated `/dev/design-system` route, but the repo enforces snake_case filenames and TanStack Router derives the actual path from `design_system.tsx`, yielding `/dev/design_system`.
- **Resolution**: Implemented and proved the committed showcase route at `/dev/design_system`, documented the framework constraint in both the task file and proof artifacts, and verified the generated route tree/build align with the underscore path.
- **Suggestion**: Update the plan to call out that snake_case route filenames in this router setup produce underscore paths, or explicitly approve an exception when a hyphenated public path is required.

## Task 5: Dev Route: `/dev/design-system` Showcase Page
- **Discrepancy**: `gh pr view` returned a PR URL under `josevelaz/atlas` while `origin` still points at `git@github.com:josevelaz/hay.git`, which initially looked like a wrong-repo PR.
- **Resolution**: Verified via `gh api repos/josevelaz/hay --jq '.full_name'` that GitHub redirects the renamed repository `hay` to `atlas`, so the created PR URL is correct for the current remote.
- **Suggestion**: Note repository renames in the workflow context before PR creation so post-push verification does not misclassify redirected URLs as failures.

## Task 5: Reconciliation — Blocker Fix Docs Sync

- **Discrepancy**: After shared blocker fix `38a721e` resolved the hydration failure and renamed the route file to `design-system.tsx`, the task list, task-5 proof doc, and validation report still contained stale references to `/dev/design_system`, the snake_case filename constraint, and the hydration limitation as an open blocker.
- **Resolution**: Updated `01-tasks-design-system.md` (Relevant Files table, Notes section, task-5 header, task 5.1 and 5.11 steps), `01-task-05-proofs.md` (route path references, removed stale hydration section), and `01-validation-design-system.md` (FAIL→PASS, all gates green, V-01/V-02/V-03 marked resolved, proof artifact table updated to PASS). Re-ran `bun run lint` and `bun run typecheck` to confirm exit 0 before committing.
- **Suggestion**: When a shared blocker fix lands, immediately identify all doc/proof/validation files that reference the fixed behavior and update them in the same commit or a dedicated reconciliation commit. Do not leave stale FAIL verdicts in validation reports after the underlying issue is resolved.
