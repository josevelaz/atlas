# Web Prototype Recreation

## TL;DR
> **Summary**: Recreate `docs/prototype` as a SolidJS/TanStack Start Atlas experience under a dedicated `/atlas` route namespace, centralizing Atlas-styled UI primitives and validating every completed slice against the live prototype with browser screenshots and interaction proof.
> **Estimated Effort**: XL

## Context
### Original Request
Create an execution plan for the approved SDD spec at `docs/specs/02-spec-web-prototype-recreation/02-spec-web-prototype-recreation.md`. The implementation must recreate `docs/prototype` inside `apps/web` using SolidJS, dedicated routes, local/sample interactivity, restyled shadcn-style/Solid UI primitives, full responsive design, and pixel-exact visual parity after each task.

### Key Findings
- The SDD assessor selects `docs/specs/02-spec-web-prototype-recreation/` as Phase 2: the spec exists, but no SDD task list or audit exists yet. This Weave plan is the Tapestry execution artifact requested by the user, not a replacement for the SDD task/audit files.
- `apps/web` is a SolidJS + TanStack Start package with existing routes at `/`, `/dev/design-system`, and `/dev/tanstack-libraries`. The root route currently renders a small placeholder and must remain intact.
- `apps/web/src/routes/__root.tsx` currently loads Archivo-only fonts; the Atlas prototype and `DESIGN.md` require Bungee, Space Mono, and VT323.
- `apps/web/src/styles.css` already contains Tailwind v4 tokens and neobrutalist primitives, but the colors/fonts still reflect an earlier lavender/Archivo/JetBrains baseline rather than the final warm-cream Atlas prototype (`#F0EBE0`, `#FFFDF7`, `#1D1F27`, `#FACC00`, `#3D7EFF`).
- `apps/web/src/components/ui/` already has small local shadcn-style primitives (`Button`, `Avatar`, `Badge`, `Toggle`, `Icon`) that should be restyled/extended instead of bypassed. `apps/web/ui.config.json` points at `src/app.css`, which does not match the live `src/styles.css` layout.
- `docs/prototype/Atlas.html` is a static React/Babel prototype that loads `styles.css`, `retro.css`, `data.jsx`, `icons.jsx`, `screens.jsx`, `onboarding.jsx`, and `app.jsx`. It is the visual/interaction source of truth, but React code must be ported manually to SolidJS.
- Existing prototype screenshots cover `01-onboarding.png` and `02-inbox.png` at `1440x900`. Other states must be captured from the live prototype before or during their implementation tasks.
- Major prototype states to recreate are: onboarding steps, Screener, Inbox, Feed, Paper Trail, Tasks & Dates, Settings, Compose overlay, Assistant overlay, sidebar/topbar navigation, keyboard shortcuts, list/thread selection, screener accept/reject, local set-aside/reply-later toggles, and assistant citations.
- Repository standards require Bun-first workflows, Biome linting, SolidJS-native primitives (`createSignal`, `createMemo`, `<For>`, `<Show>`), Tailwind CSS styling, `solid-motionone` only when motion is needed, no React imports in `apps/web`, and browser validation with `npx agent-browser` after frontend changes.
- Current worktree has pre-existing modified/untracked design/prototype/spec files. Execution must preserve them, document the baseline, and commit only the intentional changes for each task.
- `apps/web/AGENTS.md` and `README.md` describe SPA/static output and `tanstackRouter({ target: "solid" })` as critical. The current `vite.config.ts` has the Solid target and plugin order; do not hand-edit `routeTree.gen.ts`.

## Objectives
### Core Objective
Ship a dedicated, interactive, responsive, pixel-exact SolidJS recreation of the Atlas prototype in `apps/web` without replacing the current `/` route or introducing backend dependencies.

### Deliverables
- [ ] Dedicated route namespace for the recreated experience, recommended as `/atlas`, `/atlas/onboarding`, `/atlas/inbox`, `/atlas/screener`, `/atlas/feed`, `/atlas/paper-trail`, `/atlas/tasks`, and `/atlas/settings`.
- [ ] Centralized Atlas tokens, fonts, and local shadcn-style/Solid UI primitive variants matching `DESIGN.md`, `docs/prototype/styles.css`, and `docs/prototype/retro.css`.
- [ ] SolidJS sample-data and local-state layer ported from `docs/prototype/data.jsx` and `docs/prototype/app.jsx` without runtime imports from `docs/prototype`.
- [ ] All major prototype screens recreated with local interactions: onboarding, mail workspace, screener, feed, paper trail, tasks, settings, compose, and assistant.
- [ ] Full responsive behavior for desktop, tablet, and mobile, preserving the prototype hierarchy and required functionality.
- [ ] Per-task browser proof artifacts showing pixel-exact parity for the covered prototype state before the task is committed.

### Definition of Done
- [ ] `http://localhost:3001/` still renders the existing root route and is not replaced by the Atlas prototype.
- [ ] All dedicated Atlas routes are reachable and do not expose incomplete placeholder screens by final verification.
- [ ] Every visual task has app/prototype screenshots and an interaction log under `docs/specs/02-spec-web-prototype-recreation/proof/`.
- [ ] Every task that changes visible UI includes desktop, tablet, and mobile proof for the state it covers.
- [ ] No unresolved divergence remains in layout, spacing, typography, color, border, radius, shadow, alignment, or responsive behavior for any completed state.
- [ ] `bun run --cwd apps/web typecheck` passes.
- [ ] `bun run --cwd apps/web lint` passes.
- [ ] `bun run --cwd apps/web build` passes and route generation remains automatic.
- [ ] A final browser smoke using `npx agent-browser` exercises onboarding, navigation, screener actions, compose, assistant, and responsive resize without runtime errors.
- [ ] Each execution task is committed separately with a focused Conventional Commit after its parity proof passes.

### Guardrails (Must NOT)
- Do not replace or remove `apps/web/src/routes/index.tsx` or the existing `/` route.
- Do not introduce production backend/API/auth/email dependencies; use safe local/sample data only.
- Do not copy React patterns into `apps/web`; port to SolidJS signals, memos, stores, `<For>`, `<Show>`, and Solid event conventions.
- Do not import from `docs/prototype/**` at runtime. Treat it as source material only.
- Do not add React, React DOM, `@types/react`, or the `motion` package.
- Do not hand-edit `apps/web/src/routeTree.gen.ts`; let TanStack Router generate it.
- Do not mark a UI task complete or create its commit while visual parity drift remains.
- Do not hide required functionality at smaller breakpoints; responsive layouts may restructure, but all destinations and overlays must remain usable.

## TODOs

- [x] 1. Lock the parity baseline and validation workflow
  **What**: Establish the repeatable proof workflow before changing UI. Record the dirty worktree baseline, serve the live prototype, load the current `agent-browser` workflow (`npx agent-browser skills get core`), capture source-of-truth screenshots for the implementation matrix, and create a proof README that future tasks append to. Capture the current prototype at minimum for onboarding step 1, default inbox, screener, feed, paper trail, tasks, settings, compose, assistant initial state, and the target responsive viewports (`1440x900`, `1024x768`, `768x1024`, `390x844`).
  **Files**: `docs/specs/02-spec-web-prototype-recreation/proof/README.md`, `docs/specs/02-spec-web-prototype-recreation/proof/task-01-baseline/manifest.md`
  **Acceptance**: `git status --short` is recorded with pre-existing changes; the prototype is served from `docs/prototype/Atlas.html`; baseline screenshots and commands are saved; the proof README defines the viewport matrix, screenshot naming convention, and the rule that every UI task compares app screenshots to the corresponding prototype state before commit.

- [x] 2. Restyle Atlas tokens and shadcn-style/Solid UI primitives
  **What**: Align the web styling foundation with `DESIGN.md` and the prototype: warm paper/surface colors, Bungee/Space Mono/VT323 fonts, 2px ink borders, 5px/8px radii, hard offset shadows, kinetic button states, badge/tag/priority styling, input focus lift, card surfaces, dialog/overlay shell, kbd styling, avatar sizing, and toggle behavior. Keep styles centralized in Tailwind/classes and small scoped CSS utilities; do not scatter one-off primitive styling through later screens.
  **Files**: `apps/web/src/styles.css`, `apps/web/src/routes/__root.tsx`, `apps/web/ui.config.json`, `apps/web/src/components/ui/button.tsx`, `apps/web/src/components/ui/badge.tsx`, `apps/web/src/components/ui/avatar.tsx`, `apps/web/src/components/ui/toggle.tsx`, `apps/web/src/components/ui/icon.tsx`, `apps/web/src/components/ui/card.tsx`, `apps/web/src/components/ui/input.tsx`, `apps/web/src/components/ui/dialog.tsx`, `apps/web/src/components/ui/kbd.tsx`, `apps/web/src/components/ui/index.ts`, `apps/web/src/routes/dev/design-system.tsx`, `docs/specs/02-spec-web-prototype-recreation/proof/task-02-primitives/manifest.md`
  **Acceptance**: `bun run --cwd apps/web typecheck` and `bun run --cwd apps/web lint` pass; `/dev/design-system` shows Atlas-styled primitives; screenshots at `1440x900` and `390x844` demonstrate primitive parity against the prototype's buttons, badges, cards, inputs, overlays, avatars, and toggles; `/` still renders the existing root route.

- [x] 3. Port prototype data, icons, logo, and Solid state contracts
  **What**: Convert the prototype sample data and interaction model into typed Solid-friendly local modules. Preserve sample content, ordering, IDs, timestamps, category labels, assistant canned responses, onboarding copy, icon names, and the Atlas compass logo. Define state contracts for selected mail per category, accepted/rejected screener items, compose/assistant visibility, set-aside/reply-later toggles, onboarding step, and route-derived active screen.
  **Files**: `apps/web/src/lib/atlas/types.ts`, `apps/web/src/lib/atlas/sample_data.ts`, `apps/web/src/lib/atlas/assistant_responses.ts`, `apps/web/src/lib/atlas/app_state.ts`, `apps/web/src/components/atlas/atlas_icon.tsx`, `apps/web/src/components/atlas/logo.tsx`, `docs/specs/02-spec-web-prototype-recreation/proof/task-03-data-state/manifest.md`
  **Acceptance**: `bun run --cwd apps/web typecheck` passes; sample counts match the prototype (`4` screener, `9` inbox, `7` feed, `7` paper trail, `5` tasks, `5` dates); no runtime imports reference `docs/prototype/**`; grep verification finds no React imports in new Atlas files; the previous primitive screenshots are rechecked to prove no visual drift from Task 2.

- [x] 4. Build the routed Inbox workspace vertical slice
  **What**: Add the first dedicated Atlas route and full desktop mail workspace slice. Implement `/atlas/inbox` with the prototype topbar, logo/version chip, assistant/search button, compose button, account avatar, sidebar nav, AI usage card, inbox list, selected mail row, thread toolbar, AI summary, extracted tasks/dates, message cards, and local set-aside/reply-later toggles. Keep unimplemented destinations visually present where needed for inbox parity, but do not route users to incomplete placeholder screens.
  **Files**: `apps/web/src/routes/atlas.tsx`, `apps/web/src/routes/atlas/inbox.tsx`, `apps/web/src/components/atlas/atlas_app.tsx`, `apps/web/src/components/atlas/app_shell.tsx`, `apps/web/src/components/atlas/top_bar.tsx`, `apps/web/src/components/atlas/sidebar_nav.tsx`, `apps/web/src/components/atlas/ai_usage_card.tsx`, `apps/web/src/components/atlas/mail_workspace.tsx`, `apps/web/src/components/atlas/mail_list.tsx`, `apps/web/src/components/atlas/mail_row.tsx`, `apps/web/src/components/atlas/thread_view.tsx`, `apps/web/src/components/atlas/ai_summary.tsx`, `apps/web/src/components/atlas/priority_chip.tsx`, `apps/web/src/components/atlas/empty_state.tsx`, `docs/specs/02-spec-web-prototype-recreation/proof/task-04-inbox/manifest.md`
  **Acceptance**: `/atlas/inbox` renders without replacing `/`; the `1440x900` app screenshot matches `docs/prototype/screenshots/02-inbox.png` for the covered state; tablet and mobile screenshots preserve all visible inbox functionality; selecting another inbox row updates the thread pane; set-aside and reply-later buttons toggle local state; `bun run --cwd apps/web typecheck` passes.

- [x] 5. Implement onboarding entry and replay flow
  **What**: Add `/atlas` and `/atlas/onboarding` as the first-run/replay entry flow. Port all five onboarding steps, visual panels, progress dots, Back/Next/Skip/Open Atlas controls, and the sidebar "Replay onboarding" action. Finishing or skipping onboarding must land on `/atlas/inbox`, which already exists from Task 4.
  **Files**: `apps/web/src/routes/atlas.tsx`, `apps/web/src/routes/atlas/onboarding.tsx`, `apps/web/src/components/atlas/onboarding.tsx`, `apps/web/src/components/atlas/onboarding_visuals.tsx`, `apps/web/src/components/atlas/sidebar_nav.tsx`, `apps/web/src/lib/atlas/app_state.ts`, `docs/specs/02-spec-web-prototype-recreation/proof/task-05-onboarding/manifest.md`
  **Acceptance**: Browser validation demonstrates Back, Next, Skip, Open Atlas, and Replay onboarding; screenshots for steps `1` through `5` match the corresponding live prototype states; `/atlas` is dedicated to the Atlas experience while `/` remains unchanged; desktop/tablet/mobile onboarding screenshots show no layout, spacing, typography, color, border, radius, or shadow divergence for the covered states.

- [x] 6. Implement Screener route and accept/reject local behavior
  **What**: Add `/atlas/screener` with the prototype screener card layout, sender avatars, AI recommendation strip, accept/reject action bars, pending-state filtering, empty state after all items are decided, and nav count updates. Accepted items must join the local inbox/feed/paper datasets using the same derived-list behavior as the prototype.
  **Files**: `apps/web/src/routes/atlas/screener.tsx`, `apps/web/src/components/atlas/screener_screen.tsx`, `apps/web/src/components/atlas/screener_card.tsx`, `apps/web/src/components/atlas/empty_state.tsx`, `apps/web/src/components/atlas/sidebar_nav.tsx`, `apps/web/src/lib/atlas/app_state.ts`, `docs/specs/02-spec-web-prototype-recreation/proof/task-06-screener/manifest.md`
  **Acceptance**: Browser validation clicks Accept into Inbox, Accept into Feed, Accept into Paper Trail, and Reject; pending count decreases and the empty screener state appears after decisions; accepted Inbox items appear in `/atlas/inbox`; screenshots of initial, mid-action, and empty Screener states match the live prototype at desktop, tablet, and mobile widths.

- [x] 7. Implement Feed and Paper Trail routes
  **What**: Add `/atlas/feed` and `/atlas/paper-trail` using the shared mail workspace components. Match the prototype list headers, row treatments, category counts, empty/no-thread pane behavior, accepted screener item insertion, tags, time metadata, and active sidebar state for both destinations.
  **Files**: `apps/web/src/routes/atlas/feed.tsx`, `apps/web/src/routes/atlas/paper-trail.tsx`, `apps/web/src/components/atlas/mail_workspace.tsx`, `apps/web/src/components/atlas/mail_list.tsx`, `apps/web/src/components/atlas/mail_row.tsx`, `apps/web/src/components/atlas/thread_view.tsx`, `apps/web/src/components/atlas/sidebar_nav.tsx`, `apps/web/src/lib/atlas/app_state.ts`, `docs/specs/02-spec-web-prototype-recreation/proof/task-07-feed-paper/manifest.md`
  **Acceptance**: Browser validation switches between Inbox, Feed, and Paper Trail without runtime errors; selecting rows updates the appropriate per-category selected state; screenshots for Feed and Paper Trail match the live prototype source state at desktop, tablet, and mobile widths; accepted screener items routed to Feed/Paper Trail appear with correct local ordering and styling.

- [x] 8. Implement Tasks & Dates route
  **What**: Add `/atlas/tasks` with the prototype Tasks & Dates screen, thread toolbar title/subtitle, sync buttons, two-column task/date grid, task cards, calendar date tiles, source metadata, and responsive collapse. Preserve AI-extracted copy and category-coded task/date accents.
  **Files**: `apps/web/src/routes/atlas/tasks.tsx`, `apps/web/src/components/atlas/tasks_screen.tsx`, `apps/web/src/components/atlas/task_card.tsx`, `apps/web/src/components/atlas/date_card.tsx`, `apps/web/src/components/atlas/sidebar_nav.tsx`, `apps/web/src/lib/atlas/sample_data.ts`, `docs/specs/02-spec-web-prototype-recreation/proof/task-08-tasks/manifest.md`
  **Acceptance**: `/atlas/tasks` is reachable from the sidebar; task/date counts and copy match the prototype; screenshots match the live prototype at desktop, tablet, and mobile widths; sync buttons render with exact primitive styling; `bun run --cwd apps/web typecheck` passes.

- [x] 9. Implement Settings route and interactive toggles
  **What**: Add `/atlas/settings` with connected account cards, AI & Privacy settings, notification settings, Atlas icon tiles, active/upgrade/connect controls, and Solid local toggle state. Reuse the restyled Toggle primitive without one-off styling leaks.
  **Files**: `apps/web/src/routes/atlas/settings.tsx`, `apps/web/src/components/atlas/settings_screen.tsx`, `apps/web/src/components/atlas/settings_row.tsx`, `apps/web/src/components/atlas/sidebar_nav.tsx`, `apps/web/src/components/ui/toggle.tsx`, `docs/specs/02-spec-web-prototype-recreation/proof/task-09-settings/manifest.md`
  **Acceptance**: Browser validation toggles each switch and preserves local visual state; screenshots for Settings match the live prototype at desktop, tablet, and mobile widths; rows stack without hiding controls on mobile; `bun run --cwd apps/web typecheck` passes.

- [x] 10. Implement Compose overlay and reply prefill
  **What**: Add the compose modal/overlay shared across Atlas routes. The topbar Compose button opens a new-message overlay; Thread Reply opens a reply overlay prefilled with the selected sender and prototype reply text; Close, backdrop, Discard, and Escape close the overlay. Form fields must match the prototype's borderless compose-row treatment and footer controls.
  **Files**: `apps/web/src/components/atlas/compose_dialog.tsx`, `apps/web/src/components/atlas/atlas_app.tsx`, `apps/web/src/components/atlas/top_bar.tsx`, `apps/web/src/components/atlas/thread_view.tsx`, `apps/web/src/lib/atlas/app_state.ts`, `apps/web/src/components/ui/dialog.tsx`, `apps/web/src/components/ui/input.tsx`, `docs/specs/02-spec-web-prototype-recreation/proof/task-10-compose/manifest.md`
  **Acceptance**: Browser validation opens Compose from the topbar, opens Reply from a thread, verifies prefilled values, closes via close button/backdrop/Discard/Escape, and shows no runtime errors; screenshots for new-message and reply overlay states match the live prototype at desktop and mobile widths.

- [x] 11. Implement Assistant overlay, canned chat, citations, and shortcuts
  **What**: Add the Ask Atlas overlay and keyboard shortcuts from the prototype. The Search/Ask button, `/`, and `Meta/Ctrl+K` open the assistant; Escape closes it; example prompts append user/AI chat bubbles; canned responses and citations match `docs/prototype/screens.jsx`; clicking a citation navigates to the referenced route/thread and closes the assistant.
  **Files**: `apps/web/src/components/atlas/assistant_dialog.tsx`, `apps/web/src/components/atlas/atlas_app.tsx`, `apps/web/src/components/atlas/top_bar.tsx`, `apps/web/src/lib/atlas/assistant_responses.ts`, `apps/web/src/lib/atlas/app_state.ts`, `apps/web/src/components/ui/dialog.tsx`, `apps/web/src/components/ui/input.tsx`, `docs/specs/02-spec-web-prototype-recreation/proof/task-11-assistant/manifest.md`
  **Acceptance**: Browser validation opens/closes the assistant via click and keyboard shortcuts, submits the Priya/Stripe/screener/Marcus examples, shows the busy/response state, and opens cited threads; screenshots for initial assistant, chat response, citation hover/click target, desktop, and mobile match the live prototype states.

- [x] 12. Harden full responsive parity across all completed Atlas routes
  **What**: Perform the cross-route responsive pass after all major screens and overlays exist. Finalize desktop three-column behavior, tablet collapse, mobile navigation access, list/detail stacking, overlay sizing, scroll containment, focus visibility, reduced-motion behavior, and resize safety without changing the desktop prototype geometry.
  **Files**: `apps/web/src/styles.css`, `apps/web/src/components/atlas/app_shell.tsx`, `apps/web/src/components/atlas/top_bar.tsx`, `apps/web/src/components/atlas/sidebar_nav.tsx`, `apps/web/src/components/atlas/mail_workspace.tsx`, `apps/web/src/components/atlas/thread_view.tsx`, `apps/web/src/components/atlas/screener_screen.tsx`, `apps/web/src/components/atlas/tasks_screen.tsx`, `apps/web/src/components/atlas/settings_screen.tsx`, `apps/web/src/components/atlas/compose_dialog.tsx`, `apps/web/src/components/atlas/assistant_dialog.tsx`, `docs/specs/02-spec-web-prototype-recreation/proof/task-12-responsive/manifest.md`
  **Acceptance**: Screenshot matrix covers `/atlas/onboarding`, `/atlas/inbox`, `/atlas/screener`, `/atlas/feed`, `/atlas/paper-trail`, `/atlas/tasks`, `/atlas/settings`, compose, and assistant at `1440x900`, `1024x768`, `768x1024`, and `390x844`; every required control remains reachable; no horizontal body overflow appears on mobile; resizing between breakpoints produces no runtime errors; any desktop divergence introduced by responsive changes is fixed before commit.

- [x] 13. Run final verification, proof index, and PR handoff
  **What**: Execute the complete engineering and UI verification sweep, update the proof index, ensure generated route tree behavior is healthy, confirm no React/backend leakage, create the final implementation commit if needed, push the branch, and open a PR using the GitHub CLI per repository instructions.
  **Files**: `docs/specs/02-spec-web-prototype-recreation/proof/final/manifest.md`
  **Acceptance**: `bun run --cwd apps/web typecheck`, `bun run --cwd apps/web lint`, and `bun run --cwd apps/web build` pass; final `npx agent-browser` smoke covers onboarding, all nav destinations, screener accept/reject, compose, assistant, keyboard shortcuts, and responsive resize; grep verification finds no React imports/dependencies in `apps/web`; `/` and `/dev/*` routes still work; `git status --short` is clean after focused commits; a remote branch is pushed and a PR link is recorded in the final proof manifest.

## Verification
- [x] `bun run --cwd apps/web typecheck` passes after every implementation task that touches `apps/web` source.
- [x] `bun run --cwd apps/web lint` passes before each task commit.
- [x] `bun run --cwd apps/web build` passes after route changes and at final verification.
- [x] `npx agent-browser` captures browser screenshots and interaction evidence after each visible UI task.
- [x] `docs/specs/02-spec-web-prototype-recreation/proof/**/manifest.md` records exact commands, URLs, viewport sizes, screenshots, and unresolved differences for each task.
- [x] `/` remains the existing root route and `/atlas/**` contains the recreated Atlas experience.
- [x] All final Atlas route screenshots have zero unresolved visual parity defects against the corresponding prototype states.
- [x] The final implementation contains no React imports, no runtime `docs/prototype/**` imports, no backend/email/auth integration, and no manual edits to `apps/web/src/routeTree.gen.ts`.
