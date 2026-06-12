# Learnings: Atlas State + Tailwind Cleanup

## Task 2: Convert Screener decisions from `?d=` links to live store actions
- **Discrepancy**: The plan listed `apps/web/src/routeTree.gen.ts` as a task file, but the task's real code changes were in `apps/web/src/components/atlas/atlas_app.tsx` and `apps/web/src/components/atlas/assistant_dialog.tsx` because they still generated/consumed `?d=`-related link plumbing; `routeTree.gen.ts` had only a pre-existing transient diff from the router plugin.
- **Resolution**: Verified the functional `?d=` removal by updating `atlas_app.tsx` and `assistant_dialog.tsx`, while leaving the unrelated `routeTree.gen.ts` dirty state untouched.
- **Suggestion**: Future plans should list all real `?d=` producer/consumer files explicitly and treat `routeTree.gen.ts` as generated output to commit only when a task materially changes route definitions.

- **Discrepancy**: The repo started this plan with unrelated dirty state (`CONTEXT.md`, `apps/web/src/routeTree.gen.ts`, untracked plan files), which made generated-file expectations less deterministic during verification.
- **Resolution**: Task execution and verification were scoped to intended Atlas files only; unrelated dirty files stayed uncommitted.
- **Suggestion**: Add an explicit preflight cleanup/isolation task at the top of future multi-commit refactor plans when the repo is known dirty.

## Task 3: Centralize mail selection and handling-state toggles
- **Discrepancy**: The plan over-scoped the task file list (`mail_list.tsx`, `mail_row.tsx`, `thread_view.tsx`, `atlas_state.tsx`, `app_state.ts`, and `routeTree.gen.ts`) even though the actual `sel` / toggle removal only required `mail_workspace.tsx`, `atlas_app.tsx`, `assistant_dialog.tsx`, `nav_links.ts`, and the three route files.
- **Resolution**: Verified the behavioral change through the narrower set of real producer/consumer files and left `routeTree.gen.ts` uncommitted because no material route definition changed.
- **Suggestion**: For future state-plumbing tasks, scope file lists to concrete producer/consumer ownership rather than every adjacent component in the interaction path.

## Task 4: Centralize compose and assistant overlay state
- **Discrepancy**: The plan listed `top_bar.tsx`, `thread_view.tsx`, `atlas_state.tsx`, `types.ts`, and `routeTree.gen.ts`, but the live URL-param removal only required `atlas_app.tsx`, `compose_dialog.tsx`, `assistant_dialog.tsx`, `app_state.ts`, `types.ts`, and `routes/inbox.tsx`; the button surfaces were already callback-driven.
- **Resolution**: Verified the overlay-state migration through the actual URL-param producer/consumer files and left unrelated/generated files untouched.
- **Suggestion**: Future overlay-state tasks should distinguish callback emitters from true state owners so task scopes stay tighter and verification is less noisy.

## Task 5: Collapse route duplication into thin view selectors
- **Discrepancy**: The plan listed `sidebar_nav.tsx`, `app_shell.tsx`, `nav_links.ts`, and `routeTree.gen.ts`, but the actual route-thinning work only required `atlas_app.tsx` plus the six route files; the shared shell/navigation pieces were already reusable and `routeTree.gen.ts` had no material route-definition delta.
- **Resolution**: Collapsed the route wiring into `AtlasApp` and left the already-DRY shared components plus unrelated/generated churn untouched.
- **Suggestion**: For future consolidation tasks, split “possible touch points” from “required files” so the executor can target the real duplication boundary without noisy scope.

## Task 6: Purge stale hydration/proof-param comments and dead plumbing
- **Discrepancy**: The plan expected wider dead-plumbing cleanup across 14 files, but the actual remaining work was comment-only in 6 files, including `sidebar_nav.tsx` which was not listed but still owned one stale `?d=` mention.
- **Resolution**: Removed the last stale URL-param references from the real comment owners and verified the full grep pattern returned zero live-source matches.
- **Suggestion**: For future grep-driven cleanup tasks, seed the plan from the actual grep hit list so comment owners are explicit and already-clean files do not inflate scope.

## Task 7: Move UI primitive styling to Tailwind utilities
- **Discrepancy**: The plan listed only primitive components plus `styles.css`, but several direct string consumers outside `components/ui/` (`onboarding.tsx`, `onboarding_visuals.tsx`, `tasks_screen.tsx`, `priority_chip.tsx`, `mail_row.tsx`, `assistant_dialog.tsx`, `routes/dev/design-system.tsx`) also depended on the removed primitive CSS selectors.
- **Resolution**: Created `component_classes.ts`, migrated the primitives to Tailwind/CVA utilities, and updated the necessary non-primitive consumers so they retained styling after selector deletion.
- **Suggestion**: Future Tailwind migration tasks should include a preflight selector-usage sweep so every direct string consumer of a removed CSS primitive is explicitly named up front.

## Task 8: Move app shell, nav, and mail-list styling to Tailwind utilities
- **Discrepancy**: The first Task 8 pass missed the remaining in-scope `.atlas-tag` selector, and the true selector-owner set extended beyond the original plan file list to `mail_workspace.tsx`, `atlas_app.tsx`, `thread_view.tsx`, and `routes/dev/design-system.tsx`.
- **Resolution**: Re-delegated once, removed the lingering `.atlas-tag` CSS plus its `.atlas-app` retro variants, and replaced them with explicit Tailwind class exports (`tagAppClasses` / `tagAppRowClasses`) in the real consuming components.
- **Suggestion**: For future CSS-migration tasks, verify acceptance with the exact selector-removal grep before declaring success, and treat marker-scope retro flourishes as first-class consumers during planning.

## Task 9: Move thread, screener, tasks, and settings screen styling to Tailwind utilities
- **Discrepancy**: The plan implied a mostly straightforward selector-to-utility migration, but the actual work also had to account for Tailwind v4 font-arbitrary-value behavior (`font-[family-name:var(--font-display)]` did not emit for screener action bars), shared generic helpers (`.atlas-row` / `.atlas-gap-8`) still used by out-of-scope overlay/onboarding components, and a no-op `.atlas-tasks-col` wrapper with no real CSS owner.
- **Resolution**: Baked the in-scope retro flourishes directly into new Tailwind utility exports in `component_classes.ts`, used the literal `font-[family-name:'Bungee',var(--font-display)]` form where required, kept one shared `.atlas-row` / `.atlas-gap-8` CSS definition for out-of-scope consumers, migrated settings cards onto the shared `Card` primitive, and removed the dead `.atlas-tasks-col` class.
- **Suggestion**: Future late-stage CSS migration tasks should include a quick built-CSS inspection for arbitrary font utilities, explicitly separate shared helper classes still consumed out of scope from true in-scope selectors, and call out dead no-op marker classes early so they can be deleted intentionally rather than carried forward.

## Task 10: Move overlay and onboarding styling to Tailwind utilities
- **Discrepancy**: The plan’s listed file set was accurate, but the real migration also required minor comment-only updates in `apps/web/src/components/ui/dialog.tsx` and `apps/web/src/components/ui/input.tsx` because their selector-hook comments became stale once compose/assistant field overrides moved onto `class` props.
- **Resolution**: Migrated the real overlay/onboarding selector owners, removed the in-scope `.atlas-row` / `.atlas-gap-8` helpers after confirming they were no longer needed outside this scope, and included the two comment-fix touchups in the same focused commit.
- **Suggestion**: For future TSX-first styling migrations, pair selector-removal tasks with a quick comment-audit of shared primitives whose documented hook examples may become outdated even when their runtime code stays the same.

## Task 11: Finalize and enforce the global CSS boundary
- **Discrepancy**: The plan listed only `styles.css` and `component_classes.ts`, but achieving a true zero-selector CSS boundary also required removing now-dead marker classes from the JSX emitters (`button.tsx`, `badge.tsx`, `avatar.tsx`, `priority_chip.tsx`, `mail_row.tsx`, and `onboarding.tsx`) after migrating the last contextual retro flourishes into Tailwind ancestor variants.
- **Resolution**: Moved the final `.atlas-app`-scoped visual rules and onboarding card view-transition hook into `component_classes.ts` using Tailwind utilities/ancestor variants, then deleted the obsolete marker emissions in the relevant components and reduced `styles.css` to 309 global-only lines.
- **Suggestion**: When a plan’s goal is a truly selector-free global CSS file, future tasks should explicitly include both the stylesheet and the components that still emit the final hook classes, because the last mile is often deleting dead class names rather than editing CSS alone.
