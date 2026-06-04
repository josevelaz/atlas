## Relevant Files

| File | Why It Is Relevant |
| --- | --- |
| `apps/web/src/routes/dev/hay-inbox.tsx` | Planned protected demo route entry point for the recreated Hay inbox experience. |
| `apps/web/src/components/hay-demo/hay-inbox-demo.tsx` | Planned top-level demo screen container coordinating onboarding, shell state, overlays, and keyboard interactions. |
| `apps/web/src/components/hay-demo/hay-inbox-data.ts` | Planned mock sample data source for screener items, inbox/feed/paper lists, thread bodies, and assistant citations. |
| `apps/web/src/components/hay-demo/hay-inbox-styles.css` | Planned route-local fidelity styles for prototype-specific layout, colors, shadows, and spacing that should not leak globally. |
| `apps/web/src/components/hay-demo/onboarding.tsx` | Planned onboarding walkthrough recreation matching the prototype’s first-run flow. |
| `apps/web/src/components/hay-demo/app-shell.tsx` | Planned main Hay shell component containing topbar, sidebar, counters, and screen switching layout. |
| `apps/web/src/components/hay-demo/mail-list.tsx` | Planned reusable list component for Inbox, Feed, and Paper Trail rows and selected state rendering. |
| `apps/web/src/components/hay-demo/thread-view.tsx` | Planned thread reading pane with sender metadata, tags, AI summary, extracted tasks/dates, and reply controls. |
| `apps/web/src/components/hay-demo/screener-screen.tsx` | Planned Screener surface and local accept/reject/category-routing interactions. |
| `apps/web/src/components/hay-demo/tasks-screen.tsx` | Planned Tasks & Dates screen recreation from the prototype. |
| `apps/web/src/components/hay-demo/settings-screen.tsx` | Planned Settings screen recreation from the prototype. |
| `apps/web/src/components/hay-demo/compose-overlay.tsx` | Planned Compose overlay recreation with local-only fields and controls. |
| `apps/web/src/components/hay-demo/assistant-overlay.tsx` | Planned Ask Hay/search overlay recreation with local mock chat and citations. |
| `apps/web/src/components/ui/icon.tsx` | Existing icon primitive likely to be extended or supplemented for prototype-specific brutalist icons. |
| `apps/web/src/styles.css` | Existing global design tokens source that must remain stable while supporting any needed demo-route token usage. |
| `apps/web/src/routes/__root.tsx` | Existing root route and head config; relevant for font loading and route-level document behavior. |

### Notes

- Use `bun run --cwd apps/web lint` and `bun run --cwd apps/web typecheck` as the default quality gates for this feature.
- Validate frontend behavior with `npx agent-browser` after implementation because repository guidance requires browser-based verification for frontend changes.
- Keep the demo route in SolidJS conventions only; do not introduce React runtime code or embed the prototype bundle.
- Assumption resolving the spec’s open question: validation will use a single agreed desktop viewport captured during implementation, with the exact dimensions recorded in proof artifacts.

## Tasks

### [x] 1.0 Create the protected demo route, prototype styling foundation, and onboarding recreation

#### 1.0 Proof Artifact(s)

- URL: `http://localhost:3001/dev/hay-inbox` loads the protected demo route and shows the recreated onboarding flow.
- Screenshot set: `docs/specs/04-spec-inbox-ui-recreation/proof/01-onboarding-*.png` shows each onboarding step with prototype-matched layout and styling.
- CLI: `bun run --cwd apps/web typecheck` completes successfully after adding the route and onboarding components.
- Browser validation: `npx agent-browser` run against `/dev/hay-inbox` shows onboarding navigation works without console errors.

#### 1.0 Tasks

- [x] 1.1 Add a new protected internal demo route at `/dev/hay-inbox` using TanStack Start file routing, without replacing any existing production-facing route.
- [x] 1.2 Scaffold a route-local Hay demo component structure and styles file so prototype-specific fidelity work stays isolated from the rest of `apps/web`.
- [x] 1.3 Recreate the multi-step onboarding walkthrough with local state for forward/back/skip/finish transitions and a visual treatment that matches the prototype.
- [x] 1.4 Ensure onboarding loads as the default first-run surface within the demo experience and hands off cleanly to the main Hay shell when dismissed.
- [x] 1.5 Verify the new route and onboarding flow compile cleanly and are ready for browser proof capture.

### [ ] 2.0 Recreate the main Hay shell, sidebar navigation, and category-specific layouts

#### 2.0 Proof Artifact(s)

- URL: `http://localhost:3001/dev/hay-inbox` shows the Hay shell after onboarding is dismissed.
- Screenshot: `docs/specs/04-spec-inbox-ui-recreation/proof/02-main-shell.png` shows topbar, sidebar, counters, AI usage card, and active category state.
- Video/GIF: `docs/specs/04-spec-inbox-ui-recreation/proof/02-nav-switching.gif` demonstrates switching between Screener, Inbox, Feed, Paper Trail, Tasks & Dates, and Settings.
- CLI: `bun run --cwd apps/web lint` completes successfully for the shell/navigation changes.

#### 2.0 Tasks

- [ ] 2.1 Build the main Hay shell layout with topbar, wordmark, search/ask control, compose control, avatar, sidebar sections, counts, and AI usage card.
- [ ] 2.2 Implement local screen-navigation state for Screener, Inbox, Feed, Paper Trail, Tasks & Dates, and Settings, matching the prototype’s desktop-first pane behavior.
- [ ] 2.3 Recreate category-specific shell styling, active states, badges, counters, and pane layouts so the primary desktop composition matches the prototype.
- [ ] 2.4 Add replay-onboarding affordance and shell-level mock counters/labels consistent with the prototype’s information hierarchy.
- [ ] 2.5 Verify navigation flows and shell visuals are stable enough for screenshot and demo capture.

### [ ] 3.0 Recreate mock mail data flows, thread reading, and local Screener triage behavior

#### 3.0 Proof Artifact(s)

- Screenshot: `docs/specs/04-spec-inbox-ui-recreation/proof/03-thread-view.png` shows a populated thread view with sender metadata, tags, AI summary, extracted tasks, and extracted dates.
- Video/GIF: `docs/specs/04-spec-inbox-ui-recreation/proof/03-thread-selection.gif` demonstrates selecting different list rows and updating the reading pane.
- Video/GIF: `docs/specs/04-spec-inbox-ui-recreation/proof/03-screener-triage.gif` demonstrates accepting/rejecting Screener items and routing accepted items into local category lists.
- Browser validation: `npx agent-browser` run against `/dev/hay-inbox` demonstrates the list-selection and Screener triage flows without runtime errors.

#### 3.0 Tasks

- [ ] 3.1 Add structured mock data for screener items, inbox/feed/paper lists, tasks, dates, and detailed thread content derived from the prototype findings.
- [ ] 3.2 Build reusable mail-list rendering for Inbox, Feed, and Paper Trail with selected-row state, unread indicators, previews, and category-specific labels.
- [ ] 3.3 Build the thread-view pane with sender details, tags, AI summary, extracted tasks/dates, and visible reply/archive-related controls shown in the prototype.
- [ ] 3.4 Implement local selection state so choosing a thread updates the reading pane correctly across Inbox, Feed, and Paper Trail.
- [ ] 3.5 Implement Screener accept/reject/category-routing behavior in local state so accepted items appear in the correct destination list and rejected items are removed from pending review.
- [ ] 3.6 Verify thread-reading and Screener-triage flows are demonstrable and error-free in-browser.

### [ ] 4.0 Recreate overlays, secondary screens, keyboard interactions, and final fidelity polish

#### 4.0 Proof Artifact(s)

- Video/GIF: `docs/specs/04-spec-inbox-ui-recreation/proof/04-compose-overlay.gif` demonstrates opening and closing the Compose overlay.
- Video/GIF: `docs/specs/04-spec-inbox-ui-recreation/proof/04-assistant-overlay.gif` demonstrates opening and closing the Ask Hay overlay and interacting with mock citations.
- Screenshot set: `docs/specs/04-spec-inbox-ui-recreation/proof/04-secondary-screens-*.png` shows Tasks & Dates and Settings screens.
- CLI: `bun run --cwd apps/web typecheck && bun run --cwd apps/web lint` completes successfully after final polish.
- Browser validation: `npx agent-browser` run verifies keyboard shortcuts, overlay interactions, and absence of console errors on the demo route.

#### 4.0 Tasks

- [ ] 4.1 Recreate the Compose overlay with local-only fields, close/discard controls, and prototype-aligned layout and styling.
- [ ] 4.2 Recreate the Ask Hay/search overlay with mock chat history, example prompts, cited result links, and open-thread affordances consistent with the prototype.
- [ ] 4.3 Recreate the Tasks & Dates and Settings screens with their prototype content blocks and visual hierarchy.
- [ ] 4.4 Add prototype keyboard shortcuts and local toggle interactions where specified, ensuring they remain scoped to the demo experience.
- [ ] 4.5 Perform final fidelity polish for spacing, shadows, borders, typography, and state feedback against the prototype source of truth.
- [ ] 4.6 Run lint, typecheck, and browser validation to confirm the demo route is ready for implementation proof artifacts and later validation.
