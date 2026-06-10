# 02-spec-web-prototype-recreation.md

## Introduction/Overview

Recreate the `docs/prototype` Atlas experience inside `apps/web` as a SolidJS implementation that uses reusable shadcn-style/Solid UI primitives restyled with Tailwind CSS to match the prototype's neobrutalist Atlas design language. The goal is to ship a dedicated routed web experience that preserves the prototype's screen structure, interactions, and responsive behavior without depending on production backend data.

## Goals

- Recreate all major prototype screens from `docs/prototype` inside `apps/web` using SolidJS and the repository's TanStack Start routing stack.
- Add dedicated routes for the recreated experience without replacing the existing `/` route or current dev/demo routes.
- Restyle reusable UI primitives so Atlas-specific visual rules are centralized and consistent with `docs/prototype` and `DESIGN.md`.
- Preserve interactive prototype behavior for navigation, onboarding, modal/overlay flows, and screen-local state using local/sample data.
- Deliver a fully responsive web implementation that adapts the prototype across desktop, tablet, and mobile viewports.
- Require exact visual parity with the prototype for every implemented screen and interaction state, treating any design or styling divergence as a defect that must be corrected before a task is considered complete.

## User Stories

- **As a product reviewer**, I want to open the recreated Atlas app in dedicated web routes so that I can evaluate the prototype experience without affecting the current homepage.
- **As a designer or founder**, I want the web implementation to visually match the prototype's layout, components, and motion language so that design intent survives the port into the real app.
- **As a developer**, I want Atlas-styled primitives and screen components to be reusable so that future product work builds on a coherent UI foundation instead of one-off page markup.
- **As a tester**, I want the recreated screens to be clickable and stateful so that I can verify onboarding, list/thread navigation, compose, and assistant flows as a realistic prototype experience.
- **As a mobile or tablet user**, I want the recreated app to remain usable at smaller breakpoints so that the prototype works as a responsive web product rather than only a fixed desktop mockup.

## Demoable Units of Work

### Unit 1: Atlas design foundation and routed entry points

**Purpose:** Establish the route structure, styling foundation, and reusable primitives required to host the recreated Atlas experience inside `apps/web`.

**Functional Requirements:**
- The system shall add a dedicated route namespace for the recreated Atlas experience inside `apps/web`.
- The system shall preserve the existing root route and current development/demo routes while introducing the recreated Atlas routes.
- The system shall define Atlas design tokens, typography, border, radius, and hard-shadow rules in the web styling layer so they match `docs/prototype` and repository design guidance.
- The system shall provide reusable Atlas-styled wrappers or variants around shadcn-style/Solid UI primitives for common controls such as buttons, badges, inputs, dialogs, toggles, and cards.
- The system shall use SolidJS-native control flow and state patterns rather than React-specific component patterns.
- The system shall treat pixel-exact parity with the prototype as an acceptance requirement for every route, primitive, and interaction state implemented in this unit.

**Proof Artifacts:**
- Screenshot: dedicated Atlas route landing view demonstrates the recreated app is reachable without replacing the current `/` route.
- Screenshot: primitive/component gallery or representative screen section demonstrates Atlas-styled primitives are visually aligned with the prototype.
- CLI: `bun run --cwd apps/web typecheck` passes demonstrates the routed foundation and primitives compile cleanly.

### Unit 2: Onboarding and information architecture recreation

**Purpose:** Recreate the onboarding flow and the prototype's core information architecture so users can understand the Atlas product model and navigate the full experience.

**Functional Requirements:**
- The system shall recreate the onboarding walkthrough screens shown in `docs/prototype/onboarding.jsx`.
- The user shall be able to progress forward, move backward, skip onboarding, and finish onboarding through interactive controls.
- The system shall expose navigable access to all major Atlas destinations represented by the prototype, including Screener, Inbox, Feed, Paper Trail, Tasks & Dates, and Settings.
- The system shall preserve the prototype's visual hierarchy, category language, iconography, and neobrutalist shell styling across those destinations.
- The system shall support responsive navigation patterns that keep the full information architecture usable on desktop, tablet, and mobile screens.
- The system shall validate each onboarding and navigation state against the corresponding prototype view before the related task is marked complete.

**Proof Artifacts:**
- Browser validation: onboarding next/back/skip/open flows demonstrate the walkthrough is interactive.
- Screenshot: onboarding step sequence demonstrates parity with the prototype's content and presentation.
- Screenshot: responsive navigation states at desktop, tablet, and mobile widths demonstrate all major destinations remain accessible.

### Unit 3: Mail workspace screens with interactive local-state behavior

**Purpose:** Recreate the main Atlas mail workspace so reviewers can interact with the full prototype screen set using local/sample data.

**Functional Requirements:**
- The system shall recreate the prototype's Screener, Inbox, Feed, Paper Trail, Tasks, and Settings screens within the dedicated route namespace.
- The system shall render representative list, detail, empty, and assistant-driven UI states based on local/sample data derived from the prototype.
- The user shall be able to select mail items, switch screens, and see corresponding list/detail state changes without page errors.
- The user shall be able to accept or reject Screener items and observe local state updates consistent with the prototype interaction model.
- The system shall preserve prototype-specific UI treatments such as priority chips, AI summary surfaces, extracted tasks/dates, and category-coded accents.
- The system shall reject any implementation as incomplete if spacing, typography, color, border, radius, shadow, layout, or responsive behavior diverges from the prototype for the covered screen state.

**Proof Artifacts:**
- Browser validation: clicking between Screener, Inbox, Feed, Paper Trail, Tasks, and Settings demonstrates the recreated workspace is interactive.
- Browser validation: accepting and rejecting Screener items demonstrates local state updates work as intended.
- Screenshot: list/detail workspace across the major screens demonstrates parity with the prototype's shell and content structure.

### Unit 4: Overlays, auxiliary interactions, and responsive parity

**Purpose:** Recreate the prototype's high-value overlays and interaction affordances so the web build feels like a faithful, usable Atlas application rather than a static mock.

**Functional Requirements:**
- The system shall provide interactive compose and assistant overlays or modals that can be opened and closed from the recreated Atlas routes.
- The system shall support prototype-level UI interactions such as toolbar actions, navigation toggles, and screen-local controls using local/sample state.
- The system shall restyle overlay, form, and control primitives to match Atlas visual primitives using Tailwind CSS.
- The system shall adapt multi-pane desktop layouts into responsive tablet and mobile layouts without hiding required functionality.
- The system shall avoid runtime errors when users open overlays, change screens, or resize across supported breakpoints.
- The system shall validate overlay and responsive states after each implementation task using side-by-side or equivalent visual comparison against the prototype, and any mismatch shall block task completion.

**Proof Artifacts:**
- Browser validation: opening and closing compose and assistant overlays demonstrates interactive modal behavior.
- Screenshot: desktop, tablet, and mobile views of a representative mail route demonstrate responsive parity.
- CLI: app dev/build verification output demonstrates the recreated UI renders without frontend errors.

## Non-Goals (Out of Scope)

1. [**Production backend integration**: wiring the recreated Atlas routes to real email, auth, persistence, or server APIs is not required in this spec.]
2. [**Root-route replacement**: replacing the current `/` route or removing existing dev/demo routes is not included.]
3. [**Functional expansion beyond the prototype**: adding new product capabilities not represented by `docs/prototype` is out of scope unless required for responsive adaptation or primitive reuse.]

## Design Considerations

The recreated experience must treat `docs/prototype/` as the visual and interaction source material and `DESIGN.md` as the governing design system language. Styling must preserve the Atlas identity: warm paper surfaces, heavy 2px ink borders, hard offset shadows, Bungee for display moments, Space Mono for body/labels, electric accent restraint, and electric blue AI-authored surfaces. Tailwind CSS should express these primitives consistently across routes and components rather than duplicating ad hoc inline styles. Responsive adaptations may restructure layout for tablet/mobile, but they must retain the prototype's information hierarchy, category semantics, overlays, and tactile interaction feel. Pixel-exact parity is required: spacing, sizing, typography, alignment, borders, shadows, and color treatment must match the prototype for every implemented state, and any visual divergence is considered a defect rather than an acceptable approximation.

## Repository Standards

- `apps/web` is SolidJS, not React; implementation should use Solid primitives such as `createSignal`, `createMemo`, `<For>`, and `<Show>`.
- The web app uses TanStack Start file-based routing and existing route structure under `apps/web/src/routes/`.
- Reusable UI belongs under `apps/web/src/components/ui/` and shared helpers under `apps/web/src/lib/` following existing project organization.
- Tailwind CSS is already present in the web app and should be used for styling work.
- Frontend changes should be validated with browser automation after implementation, per repository guidance.
- Use Bun-native scripts for build/typecheck/lint workflows where available.
- Follow existing repository commit conventions and keep future implementation commits focused and reviewable.

## Technical Considerations

- The implementation should add dedicated route files within `apps/web/src/routes/` for the recreated Atlas experience and keep those routes isolated from the placeholder homepage and dev showcases.
- The recreated app should use local/sample data sourced from the prototype structure rather than introducing production data dependencies during this spec.
- Atlas-specific primitive restyling should be centralized through reusable variants/wrappers around shadcn-style/Solid UI components instead of scattering one-off utility combinations across every screen.
- Mail-application-specific surfaces such as the multi-pane shell, message rows, thread view, screener cards, and AI summary blocks will likely require custom composed components even when underlying primitives are reused.
- Responsive behavior must be an implementation requirement, not a post-pass. Layout decisions should account for desktop, tablet, and mobile from the outset.
- Current SolidJS best-practice guidance favors Solid-native control flow and component composition, so implementation should avoid React carryovers from the original prototype source.
- The current `ui.config.json` appears to point at styling paths that may not match the live web app layout; implementation should align any primitive tooling or copied components with the actual `apps/web` structure instead of assuming the config is already accurate.
- After each implementation task, the UI must be validated against the corresponding prototype state with browser-based inspection and visual comparison before the task can be closed.
- Implementation sequencing should favor small slices whose parity can be checked immediately, because unresolved design drift must not accumulate across multiple tasks.

## Security Considerations

No real credentials, inbox contents, OAuth flows, or production API tokens are required for this prototype recreation spec. Any local/sample data used to recreate screens shall be non-sensitive and safe to commit. Proof artifacts shall avoid including secrets, personal data, or live third-party account information. If later implementation introduces browser automation captures, those captures shall use the local prototype experience and not authenticated production mailboxes.

## Success Metrics

1. [**Prototype coverage**: all major screens from `docs/prototype` are recreated in dedicated `apps/web` routes and are reachable through the implemented navigation model.]
2. [**Interactive fidelity**: onboarding, screen switching, screener actions, compose, and assistant interactions work with local/sample state and produce no visible runtime errors during browser validation.]
3. [**Responsive quality**: the recreated experience remains usable and visually coherent at desktop, tablet, and mobile breakpoints.]
4. [**Exact visual parity**: each completed task includes proof that the implemented UI state matches the prototype exactly, with no unresolved divergence in layout, spacing, typography, color, border, radius, or shadow treatment.]

## Open Questions

1. The exact public route names for the dedicated Atlas experience can be finalized during task planning as long as the implementation preserves a dedicated route namespace and screen-addressable navigation.
