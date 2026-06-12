# Atlas State + Tailwind Cleanup

## TL;DR
> **Summary**: Replace the leftover URL/proof-param interaction model with a shared Solid store/context, make Atlas routes thin root-based view selectors, and migrate Atlas component styling out of the 2,256-line `styles.css` into Tailwind utility classes while preserving the DESIGN.md neobrutalist system.
> **Estimated Effort**: Large

## Context
### Original Request
Create an executable Weave plan for remediating Atlas web prototype code-quality review findings: remove the dead broken-hydration URL state model, centralize UI state in a shared Solid store/context, purge contradictory hydration comments, avoid `/atlas/**`, and reduce the monolithic Atlas CSS by moving component styling to Tailwind utilities/classes.

### Key Findings
- `apps/web/src/lib/atlas/app_state.ts` already has pure `acceptScreener` / `rejectScreener` reducers, but also still contains `decodeDecisions` / `encodeDecisions`, `?d=` comments, and broken-hydration rationale.
- `apps/web/src/components/atlas/screener_card.tsx` renders Accept/Reject as `<Link>` navigations with `search={{ d: ... }}`; `screener_screen.tsx` builds those tokens.
- `apps/web/src/routes/{screener,inbox,feed,paper-trail,tasks,settings}.tsx` still validate/read URL search params to seed proof state even though hydration is healthy.
- State is split between route search params, local `AtlasApp` signals, and local `MailWorkspace` signals for decisions, selection, set-aside/reply-later, compose, and assistant visibility.
- `apps/web/src/styles.css` is 2,256 lines and contains global concerns plus most Atlas component/layout styling via `.atlas-*` selectors.
- Tailwind v4 is already wired through `@theme` in `apps/web/src/styles.css`. Context7 Tailwind docs confirm `@theme` CSS-first tokens and CSS-variable arbitrary utilities are first-class patterns for moving component styling into class strings.
- Current repo state observed during planning is not clean (`CONTEXT.md`, `apps/web/src/routeTree.gen.ts`, and an untracked prior plan). Execution should start from a clean worktree or intentionally isolate/remediate those changes before committing this work.

## Objectives
### Core Objective
Make the hydrated Atlas web prototype maintainable by moving interaction state into a shared Solid state layer and moving Atlas-specific styles into Tailwind/component-level utilities, without changing the accepted root-based route structure.

### Deliverables
- [ ] Shared Solid Atlas state provider/context owns screener decisions, mail selection, set-aside/reply-later, compose overlay state, and assistant overlay state.
- [ ] Screener Accept/Reject are live signal/store actions using pure reducers, not `?d=` Link navigations.
- [ ] Root-based routes remain (`/inbox`, `/screener`, `/feed`, `/paper-trail`, `/tasks`, `/settings`, `/onboarding`) and `/atlas/**` is not restored.
- [ ] Routes are thin view selectors; repeated feed/paper/inbox route wiring is removed where sensible.
- [ ] Broken-hydration/proof-param comments and dead URL codec plumbing are removed from live source.
- [ ] `apps/web/src/styles.css` contains only global concerns: Tailwind import/theme tokens, root/dark tokens, fonts/reset/base/body, grain/scanline, selection, reduced-motion, view-transition/keyframes/global rules.
- [ ] Atlas component styling lives in Tailwind utility classes or reusable component-level class variants.
- [ ] Proof docs reflect live hydrated interactions and the Tailwind migration.

### Definition of Done
- [ ] `bun run --cwd apps/web typecheck` passes.
- [ ] `bun run --cwd apps/web lint` passes.
- [ ] `bun run --cwd apps/web build` passes.
- [ ] `npx agent-browser` UI validation covers changed frontend flows; if unavailable, the proof update records the limitation and curl/build fallbacks are used.
- [ ] `grep -RniE "broken-hydration|Client hydration is disabled|pre-existing broken|SSR-proof|\\?d=|encodeDecisions|decodeDecisions|decodeComposeMode" apps/web/src` returns no live-source matches except intentionally retained dev/proof comments, if any are explicitly justified.
- [ ] `grep -Rni '"/atlas\|to="/atlas\|/atlas/' apps/web/src` returns no matches.
- [ ] `wc -l apps/web/src/styles.css` is materially reduced, target `<= 350` lines unless a specific global rule is justified in the proof update.
- [ ] `grep -nE '^\\.atlas-|^\\.is-' apps/web/src/styles.css` returns no component selector matches, except any explicitly documented global view-transition hook.

### Guardrails (Must NOT)
- Do not restore `/atlas` or any `/atlas/**` route/path/link.
- Do not reintroduce React patterns/imports in `apps/web`; this app is SolidJS + TanStack Start.
- Do not preserve the URL/search-param proof model as the source of live UX state.
- Do not move the monolithic CSS into another large CSS file or broad `@apply` layer.
- Do not remove DESIGN.md visual language: 2px ink borders, hard offset shadows, warm paper surfaces, Bungee/Space Mono/VT323 roles, and rationed accent colors must survive.
- Do not manually edit generated `apps/web/src/routeTree.gen.ts` except to commit tool-generated changes from the router plugin/build.
- Do not mix this remediation with unrelated dirty work already present in the repo.

## TODOs

- [x] 1. Add the shared Atlas state provider scaffold
  **What**: Create a root-level Solid state provider that will persist across SPA route changes. Keep pure reducers framework-free in `app_state.ts`, harden `acceptScreener` / `rejectScreener` so each clears the opposite decision for the same screener id, and expose typed store actions for decisions, selection, handling-state toggles, compose state, assistant state, and citation selection.
  **Files**: `apps/web/src/lib/atlas/app_state.ts`, `apps/web/src/lib/atlas/types.ts`, `apps/web/src/lib/atlas/atlas_state.tsx`, `apps/web/src/routes/__root.tsx`
  **Acceptance**: `AtlasProvider` wraps `<Outlet />` once in `__root.tsx`; `useAtlasState()` / `useAtlasActions()` throw a clear error outside the provider; no UI behavior changes yet; `bun run --cwd apps/web typecheck` and `bun run --cwd apps/web lint` pass.
  **Commit**: `git add apps/web/src/lib/atlas/app_state.ts apps/web/src/lib/atlas/types.ts apps/web/src/lib/atlas/atlas_state.tsx apps/web/src/routes/__root.tsx && git commit -m "refactor(web): add atlas state provider"`

- [x] 2. Convert Screener decisions from `?d=` links to live store actions
  **What**: Replace Accept/Reject `<Link>` controls with buttons that call store actions backed by `acceptScreener` / `rejectScreener`. Remove decision-token builders from `ScreenerScreen`, remove `decodeDecisions` / `encodeDecisions` usage from routes and nav links, and ensure sidebar counts/list derivations read from provider state.
  **Files**: `apps/web/src/components/atlas/screener_card.tsx`, `apps/web/src/components/atlas/screener_screen.tsx`, `apps/web/src/components/atlas/sidebar_nav.tsx`, `apps/web/src/lib/atlas/app_state.ts`, `apps/web/src/lib/atlas/nav_links.ts`, `apps/web/src/routes/screener.tsx`, `apps/web/src/routes/inbox.tsx`, `apps/web/src/routes/feed.tsx`, `apps/web/src/routes/paper-trail.tsx`, `apps/web/src/routes/tasks.tsx`, `apps/web/src/routes/settings.tsx`, `apps/web/src/routeTree.gen.ts`
  **Acceptance**: `/screener` Accept/Reject shrink the pending list without changing the URL; accepted items update Inbox/Feed/Paper counts through provider state; `?d=` is no longer generated or consumed in live source; run `bun run --cwd apps/web typecheck`, `bun run --cwd apps/web lint`, and `bun run --cwd apps/web build`; with dev server running, validate `/screener` via `npx agent-browser` by accepting one sender and rejecting one sender. If `npx agent-browser` is unavailable, record that limitation in the proof manifest and verify `curl -fsS http://localhost:3001/screener` plus the successful build as fallback.
  **Commit**: `git add apps/web/src/components/atlas/screener_card.tsx apps/web/src/components/atlas/screener_screen.tsx apps/web/src/components/atlas/sidebar_nav.tsx apps/web/src/lib/atlas/app_state.ts apps/web/src/lib/atlas/nav_links.ts apps/web/src/routes/screener.tsx apps/web/src/routes/inbox.tsx apps/web/src/routes/feed.tsx apps/web/src/routes/paper-trail.tsx apps/web/src/routes/tasks.tsx apps/web/src/routes/settings.tsx apps/web/src/routeTree.gen.ts && git commit -m "fix(web): make screener decisions live"`

- [x] 3. Centralize mail selection and handling-state toggles
  **What**: Move selected mail id, set-aside, and reply-later state out of route search params and `MailWorkspace` local signals into the shared provider. Keep selection per category (`inbox`, `feed`, `paper`) and keep thread derivation pure via `currentThread` / `listForView`.
  **Files**: `apps/web/src/components/atlas/atlas_app.tsx`, `apps/web/src/components/atlas/mail_workspace.tsx`, `apps/web/src/components/atlas/mail_list.tsx`, `apps/web/src/components/atlas/mail_row.tsx`, `apps/web/src/components/atlas/thread_view.tsx`, `apps/web/src/components/atlas/assistant_dialog.tsx`, `apps/web/src/lib/atlas/atlas_state.tsx`, `apps/web/src/lib/atlas/app_state.ts`, `apps/web/src/lib/atlas/nav_links.ts`, `apps/web/src/routes/inbox.tsx`, `apps/web/src/routes/feed.tsx`, `apps/web/src/routes/paper-trail.tsx`, `apps/web/src/routeTree.gen.ts`
  **Acceptance**: Clicking rows updates the thread pane through provider state; Set aside / Reply later remain active while navigating away and back during the SPA session; Assistant citation clicks select the cited thread through store actions instead of `?sel=`; `sel`, `setAside`, and `replyLater` search params are removed from route validators; run `bun run --cwd apps/web typecheck`, `bun run --cwd apps/web lint`, and `bun run --cwd apps/web build`; validate row selection and toggles in `/inbox` with `npx agent-browser` or record fallback limitation.
  **Commit**: `git add apps/web/src/components/atlas/atlas_app.tsx apps/web/src/components/atlas/mail_workspace.tsx apps/web/src/components/atlas/mail_list.tsx apps/web/src/components/atlas/mail_row.tsx apps/web/src/components/atlas/thread_view.tsx apps/web/src/components/atlas/assistant_dialog.tsx apps/web/src/lib/atlas/atlas_state.tsx apps/web/src/lib/atlas/app_state.ts apps/web/src/lib/atlas/nav_links.ts apps/web/src/routes/inbox.tsx apps/web/src/routes/feed.tsx apps/web/src/routes/paper-trail.tsx apps/web/src/routeTree.gen.ts && git commit -m "refactor(web): centralize mail workspace state"`

- [x] 4. Centralize compose and assistant overlay state
  **What**: Move compose mode/reply target and assistant open/close state into the shared provider. Remove `?compose=`, `?assistant=`, and `?ask=` proof seeding from live routes/components, while keeping the assistant transcript/query local to `AssistantDialog` unless a future product requirement needs global chat history.
  **Files**: `apps/web/src/components/atlas/atlas_app.tsx`, `apps/web/src/components/atlas/compose_dialog.tsx`, `apps/web/src/components/atlas/assistant_dialog.tsx`, `apps/web/src/components/atlas/top_bar.tsx`, `apps/web/src/components/atlas/thread_view.tsx`, `apps/web/src/lib/atlas/atlas_state.tsx`, `apps/web/src/lib/atlas/app_state.ts`, `apps/web/src/lib/atlas/types.ts`, `apps/web/src/routes/inbox.tsx`, `apps/web/src/routeTree.gen.ts`
  **Acceptance**: Top-bar Compose opens a blank compose dialog; thread Reply opens compose with the selected sender address; Search/Ask, `/`, and `⌘K` open the assistant; Escape closes overlays; live behavior uses store actions, not URL params; `decodeComposeMode` is deleted; run `bun run --cwd apps/web typecheck`, `bun run --cwd apps/web lint`, and `bun run --cwd apps/web build`; validate compose, reply, assistant, and Escape with `npx agent-browser` or record fallback limitation.
  **Commit**: `git add apps/web/src/components/atlas/atlas_app.tsx apps/web/src/components/atlas/compose_dialog.tsx apps/web/src/components/atlas/assistant_dialog.tsx apps/web/src/components/atlas/top_bar.tsx apps/web/src/components/atlas/thread_view.tsx apps/web/src/lib/atlas/atlas_state.tsx apps/web/src/lib/atlas/app_state.ts apps/web/src/lib/atlas/types.ts apps/web/src/routes/inbox.tsx apps/web/src/routeTree.gen.ts && git commit -m "refactor(web): centralize overlay state"`

- [x] 5. Collapse route duplication into thin view selectors
  **What**: Make `AtlasApp` the single shell for all Atlas screens. Routes should only select the active root-based view and render `<AtlasApp view="..." />`; `AtlasApp` should switch between mail workspace, screener, tasks, and settings content internally. Remove repeated `AppShell`/`TopBar`/`SidebarNav` setup from individual routes.
  **Files**: `apps/web/src/components/atlas/atlas_app.tsx`, `apps/web/src/components/atlas/app_shell.tsx`, `apps/web/src/components/atlas/sidebar_nav.tsx`, `apps/web/src/lib/atlas/nav_links.ts`, `apps/web/src/routes/screener.tsx`, `apps/web/src/routes/inbox.tsx`, `apps/web/src/routes/feed.tsx`, `apps/web/src/routes/paper-trail.tsx`, `apps/web/src/routes/tasks.tsx`, `apps/web/src/routes/settings.tsx`, `apps/web/src/routeTree.gen.ts`
  **Acceptance**: Each route file has no business-state decoding and only selects its view; `/feed` and `/paper-trail` no longer duplicate mail-shell wiring; sidebar navigation still reaches all accepted root routes; no `/atlas/**` links exist; run `bun run --cwd apps/web typecheck`, `bun run --cwd apps/web lint`, and `bun run --cwd apps/web build`; validate navigation across `/inbox`, `/screener`, `/feed`, `/paper-trail`, `/tasks`, and `/settings` with `npx agent-browser` or fallback.
  **Commit**: `git add apps/web/src/components/atlas/atlas_app.tsx apps/web/src/components/atlas/app_shell.tsx apps/web/src/components/atlas/sidebar_nav.tsx apps/web/src/lib/atlas/nav_links.ts apps/web/src/routes/screener.tsx apps/web/src/routes/inbox.tsx apps/web/src/routes/feed.tsx apps/web/src/routes/paper-trail.tsx apps/web/src/routes/tasks.tsx apps/web/src/routes/settings.tsx apps/web/src/routeTree.gen.ts && git commit -m "refactor(web): make atlas routes thin"`

- [x] 6. Purge stale hydration/proof-param comments and dead plumbing
  **What**: Remove comments that claim client hydration is disabled, interactions are SSR-proof, or proof variants are required for live UX. Delete now-unused types/helpers/imports tied to `?d=`, `?sel=`, `?compose=`, `?assistant=`, and `?ask=`. Keep only accurate comments about current hydrated behavior.
  **Files**: `apps/web/src/lib/atlas/app_state.ts`, `apps/web/src/lib/atlas/nav_links.ts`, `apps/web/src/components/atlas/atlas_app.tsx`, `apps/web/src/components/atlas/assistant_dialog.tsx`, `apps/web/src/components/atlas/compose_dialog.tsx`, `apps/web/src/components/atlas/mail_workspace.tsx`, `apps/web/src/components/atlas/screener_card.tsx`, `apps/web/src/components/atlas/screener_screen.tsx`, `apps/web/src/routes/screener.tsx`, `apps/web/src/routes/inbox.tsx`, `apps/web/src/routes/feed.tsx`, `apps/web/src/routes/paper-trail.tsx`, `apps/web/src/routes/tasks.tsx`, `apps/web/src/routes/settings.tsx`
  **Acceptance**: `grep -RniE "broken-hydration|Client hydration is disabled|pre-existing broken|SSR-proof|proof variant|\\?d=|\\?sel=|\\?compose=|\\?assistant=|\\?ask=|encodeDecisions|decodeDecisions|decodeComposeMode" apps/web/src` has no stale live-source matches; run `bun run --cwd apps/web typecheck`, `bun run --cwd apps/web lint`, and `bun run --cwd apps/web build`.
  **Commit**: `git add apps/web/src/lib/atlas/app_state.ts apps/web/src/lib/atlas/nav_links.ts apps/web/src/components/atlas/atlas_app.tsx apps/web/src/components/atlas/assistant_dialog.tsx apps/web/src/components/atlas/compose_dialog.tsx apps/web/src/components/atlas/mail_workspace.tsx apps/web/src/components/atlas/screener_card.tsx apps/web/src/components/atlas/screener_screen.tsx apps/web/src/routes/screener.tsx apps/web/src/routes/inbox.tsx apps/web/src/routes/feed.tsx apps/web/src/routes/paper-trail.tsx apps/web/src/routes/tasks.tsx apps/web/src/routes/settings.tsx && git commit -m "chore(web): purge stale hydration comments"`

- [x] 7. Move UI primitive styling to Tailwind utilities
  **What**: Replace primitive `.atlas-*` class dependencies with Tailwind utility/variant strings. Use reusable class maps or CVA-style helpers in TypeScript for repeated design-system variants instead of CSS selectors. Keep Tailwind v4 `@theme` tokens in `styles.css` and use token utilities/arbitrary values like `bg-secondary-background`, `border-border`, `shadow-[var(--shadow)]`, `rounded-[var(--radius)]`, and responsive prefixes.
  **Files**: `apps/web/src/lib/atlas/component_classes.ts`, `apps/web/src/components/ui/button.tsx`, `apps/web/src/components/ui/badge.tsx`, `apps/web/src/components/ui/card.tsx`, `apps/web/src/components/ui/input.tsx`, `apps/web/src/components/ui/kbd.tsx`, `apps/web/src/components/ui/dialog.tsx`, `apps/web/src/components/ui/toggle.tsx`, `apps/web/src/components/ui/avatar.tsx`, `apps/web/src/styles.css`
  **Acceptance**: Buttons, badges, cards, inputs, dialogs, toggles, and kbd chips no longer depend on `.atlas-btn`, `.atlas-badge`, `.atlas-card`, `.atlas-input`, `.atlas-overlay-*`, `.atlas-toggle`, or `.atlas-kbd` CSS definitions; `styles.css` primitive sections are removed; run `bun run --cwd apps/web typecheck`, `bun run --cwd apps/web lint`, and `bun run --cwd apps/web build`; validate `/dev/design-system` with `npx agent-browser` or record fallback limitation and curl content checks.
  **Commit**: `git add apps/web/src/lib/atlas/component_classes.ts apps/web/src/components/ui/button.tsx apps/web/src/components/ui/badge.tsx apps/web/src/components/ui/card.tsx apps/web/src/components/ui/input.tsx apps/web/src/components/ui/kbd.tsx apps/web/src/components/ui/dialog.tsx apps/web/src/components/ui/toggle.tsx apps/web/src/components/ui/avatar.tsx apps/web/src/styles.css && git commit -m "refactor(web): move ui primitives to tailwind"`

- [x] 8. Move app shell, nav, and mail-list styling to Tailwind utilities
  **What**: Migrate layout/navigation/list classes from CSS selectors into component class strings while preserving the fixed desktop grid and responsive mobile/tablet stacking. Prefer extracted constants for long repeated neobrutalist surfaces; keep semantic `data-*` hooks where useful for tests instead of styling hooks.
  **Files**: `apps/web/src/components/atlas/app_shell.tsx`, `apps/web/src/components/atlas/top_bar.tsx`, `apps/web/src/components/atlas/sidebar_nav.tsx`, `apps/web/src/components/atlas/ai_usage_card.tsx`, `apps/web/src/components/atlas/mail_list.tsx`, `apps/web/src/components/atlas/mail_row.tsx`, `apps/web/src/components/atlas/priority_chip.tsx`, `apps/web/src/components/atlas/empty_state.tsx`, `apps/web/src/components/atlas/logo.tsx`, `apps/web/src/lib/atlas/component_classes.ts`, `apps/web/src/styles.css`
  **Acceptance**: App shell grid, top bar, sidebar/nav rows, usage card, mail list header/scroll area, mail rows, avatars, tags, priority chips, and empty states render from Tailwind classes; corresponding `.atlas-app`, `.atlas-topbar`, `.atlas-sidebar`, `.atlas-nav-*`, `.atlas-list*`, `.atlas-mail-row`, `.atlas-avatar`, `.atlas-tag`, `.atlas-priority`, `.atlas-empty*`, and related CSS selectors are removed; run `bun run --cwd apps/web typecheck`, `bun run --cwd apps/web lint`, and `bun run --cwd apps/web build`; validate `/inbox` desktop and mobile layouts with `npx agent-browser` or fallback.
  **Commit**: `git add apps/web/src/components/atlas/app_shell.tsx apps/web/src/components/atlas/top_bar.tsx apps/web/src/components/atlas/sidebar_nav.tsx apps/web/src/components/atlas/ai_usage_card.tsx apps/web/src/components/atlas/mail_list.tsx apps/web/src/components/atlas/mail_row.tsx apps/web/src/components/atlas/priority_chip.tsx apps/web/src/components/atlas/empty_state.tsx apps/web/src/components/atlas/logo.tsx apps/web/src/lib/atlas/component_classes.ts apps/web/src/styles.css && git commit -m "refactor(web): move shell styles to tailwind"`

- [x] 9. Move thread, screener, tasks, and settings screen styling to Tailwind utilities
  **What**: Migrate the main content screens and cards out of CSS selectors into Tailwind classes, including responsive fixes currently expressed in `styles.css` media queries. Keep AI-authored surfaces keyed to `bg-ai text-white`, coded accents as small tokens, and hard 2px borders/shadows.
  **Files**: `apps/web/src/components/atlas/thread_view.tsx`, `apps/web/src/components/atlas/ai_summary.tsx`, `apps/web/src/components/atlas/screener_screen.tsx`, `apps/web/src/components/atlas/screener_card.tsx`, `apps/web/src/components/atlas/tasks_screen.tsx`, `apps/web/src/components/atlas/task_card.tsx`, `apps/web/src/components/atlas/date_card.tsx`, `apps/web/src/components/atlas/settings_screen.tsx`, `apps/web/src/components/atlas/settings_row.tsx`, `apps/web/src/lib/atlas/component_classes.ts`, `apps/web/src/styles.css`
  **Acceptance**: Thread toolbar/body/messages, AI summary/extractions, Screener intro/card/action bar, Tasks & Dates grid/cards, and Settings rows/controls no longer depend on component selectors in `styles.css`; responsive tablet/mobile behavior is implemented with Tailwind responsive utilities; run `bun run --cwd apps/web typecheck`, `bun run --cwd apps/web lint`, and `bun run --cwd apps/web build`; validate `/screener`, `/tasks`, and `/settings` at desktop and mobile widths with `npx agent-browser` or fallback.
  **Commit**: `git add apps/web/src/components/atlas/thread_view.tsx apps/web/src/components/atlas/ai_summary.tsx apps/web/src/components/atlas/screener_screen.tsx apps/web/src/components/atlas/screener_card.tsx apps/web/src/components/atlas/tasks_screen.tsx apps/web/src/components/atlas/task_card.tsx apps/web/src/components/atlas/date_card.tsx apps/web/src/components/atlas/settings_screen.tsx apps/web/src/components/atlas/settings_row.tsx apps/web/src/lib/atlas/component_classes.ts apps/web/src/styles.css && git commit -m "refactor(web): move screen styles to tailwind"`

- [x] 10. Move overlay and onboarding styling to Tailwind utilities
  **What**: Migrate compose dialog, assistant dialog, onboarding shell, and onboarding visuals to Tailwind utilities. Preserve global view-transition/keyframe rules, but move component sizing, borders, spacing, typography, and responsive behavior into TSX class strings.
  **Files**: `apps/web/src/components/atlas/compose_dialog.tsx`, `apps/web/src/components/atlas/assistant_dialog.tsx`, `apps/web/src/components/atlas/onboarding.tsx`, `apps/web/src/components/atlas/onboarding_visuals.tsx`, `apps/web/src/lib/atlas/component_classes.ts`, `apps/web/src/styles.css`
  **Acceptance**: Compose and assistant overlays work with Tailwind classes; onboarding card/step visuals and small-screen adaptations are Tailwind-based; `styles.css` retains only global view-transition/keyframe hooks for onboarding motion; run `bun run --cwd apps/web typecheck`, `bun run --cwd apps/web lint`, and `bun run --cwd apps/web build`; validate `/`, `/onboarding`, compose, and assistant flows with `npx agent-browser` or fallback.
  **Commit**: `git add apps/web/src/components/atlas/compose_dialog.tsx apps/web/src/components/atlas/assistant_dialog.tsx apps/web/src/components/atlas/onboarding.tsx apps/web/src/components/atlas/onboarding_visuals.tsx apps/web/src/lib/atlas/component_classes.ts apps/web/src/styles.css && git commit -m "refactor(web): move overlay styles to tailwind"`

- [x] 11. Finalize and enforce the global CSS boundary
  **What**: Delete any remaining Atlas component selectors from `styles.css`, tighten comments so it is explicitly global-only, and keep only Tailwind import/theme tokens, root/dark variables, fonts/reset/base/body, selection/grain/scanline, reduced-motion, and global view-transition rules. If a selector must remain, document why it is truly global.
  **Files**: `apps/web/src/styles.css`, `apps/web/src/lib/atlas/component_classes.ts`
  **Acceptance**: `wc -l apps/web/src/styles.css` reports `<= 350` lines or a justified documented exception; `grep -nE '^\\.atlas-|^\\.is-' apps/web/src/styles.css` has no component selector matches; `grep -nE '@apply|docs/prototype/styles|retro.css' apps/web/src/styles.css` returns no matches; run `bun run --cwd apps/web typecheck`, `bun run --cwd apps/web lint`, and `bun run --cwd apps/web build`.
  **Commit**: `git add apps/web/src/styles.css apps/web/src/lib/atlas/component_classes.ts && git commit -m "chore(web): shrink atlas global css"`

- [x] 12. Update proof docs and run final remediation validation
  **What**: Update proof documentation to describe the new live hydrated interaction model, removal of URL proof params, accepted root route structure, Tailwind migration, CSS boundary, validation results, and any `agent-browser` limitation/fallback. Capture/record final UI smoke evidence for the changed flows.
  **Files**: `docs/specs/02-spec-web-prototype-recreation/proof/final/manifest.md`, `docs/specs/02-spec-web-prototype-recreation/proof/state-tailwind-cleanup/manifest.md`
  **Acceptance**: Run `bun run --cwd apps/web typecheck`, `bun run --cwd apps/web lint`, and `bun run --cwd apps/web build`; run `grep -RniE "broken-hydration|Client hydration is disabled|pre-existing broken|SSR-proof|\\?d=|encodeDecisions|decodeDecisions|decodeComposeMode" apps/web/src`; run `grep -Rni '"/atlas\|to="/atlas\|/atlas/' apps/web/src`; run `wc -l apps/web/src/styles.css`; validate with `npx agent-browser` across `/`, `/inbox`, `/screener`, `/feed`, `/paper-trail`, `/tasks`, `/settings`, `/dev/design-system`; if `npx agent-browser` is unavailable, record the limitation in the proof manifest and use `curl -fsS` route/content checks plus successful build as fallback; confirm `git status --short` only contains intended proof docs before committing.
  **Commit**: `git add docs/specs/02-spec-web-prototype-recreation/proof/final/manifest.md docs/specs/02-spec-web-prototype-recreation/proof/state-tailwind-cleanup/manifest.md && git commit -m "docs(web): update prototype remediation proof"`

## Verification
- [x] All task commits are small, focused, and use the Conventional Commit messages listed above.
- [x] `bun run --cwd apps/web typecheck` passes after state tasks, after each styling batch, and in the final task.
- [x] `bun run --cwd apps/web lint` passes after state tasks, after each styling batch, and in the final task.
- [x] `bun run --cwd apps/web build` passes after URL-state removal, after route consolidation, after each styling batch, and in the final task.
- [x] `npx agent-browser` validates Screener Accept/Reject, row selection, set-aside/reply-later, compose, assistant, navigation, onboarding, responsive layouts, and `/dev/design-system`; any unavailability is documented with curl/build fallback proof.
- [x] No `/atlas/**` routes, links, or docs are reintroduced as current behavior.
- [x] No live-source broken-hydration/proof-param comments or URL codecs remain.
- [x] `apps/web/src/styles.css` is global-only and materially reduced from 2,256 lines.
- [x] Proof docs clearly distinguish historical screenshots from current live hydrated behavior.
