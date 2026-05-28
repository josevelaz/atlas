# 01-spec-design-system.md

## Introduction/Overview

Establish the visual foundation for the Atlas inbox application. This spec defines the token system (colors, typography, spacing, motion), wires those tokens into Tailwind v4, and builds the five primitive UI components that all subsequent screens will consume. Components are scaffolded via Solid UI (a shadcn-style copy-into-project library built on Kobalte/corvu) and then styled with Hay's neobrutalist design tokens. Without this foundation, no UI work can proceed consistently.

## Goals

- Define and document all design tokens (color, typography, border, shadow, spacing, motion) in `DESIGN.md` as the single source of truth
- Wire all tokens into Tailwind v4 via CSS custom properties so utility classes reflect the design system
- Deliver five reusable, accessible base components (`Button`, `Avatar`, `Toggle`, `Icon`, `Badge`) in SolidJS
- Provide a `/dev/design-system` route that renders every component in every variant for visual verification
- Ensure reduced-motion preferences are respected globally

## User Stories

**As a developer building Atlas screens**, I want a documented token system so that I can apply consistent colors, spacing, and typography without guessing values.

**As a developer building Atlas screens**, I want pre-built primitive components so that I can compose screens without re-implementing buttons, badges, or avatars from scratch.

**As a designer reviewing the UI**, I want a `/dev/design-system` page so that I can inspect all components and variants in one place without navigating through the full app.

**As a user with motion sensitivity**, I want the UI to respect `prefers-reduced-motion` so that animations do not cause discomfort.

## Demoable Units of Work

### Unit 1: Token System + Tailwind Wiring

**Purpose:** Establish the visual vocabulary. All subsequent components and screens depend on these tokens being available as CSS custom properties and Tailwind utilities.

**Functional Requirements:**
- The system shall define all color tokens as OKLCH CSS custom properties in `apps/web/src/styles.css` under a `@theme` block: `--color-main`, `--color-ai`, `--color-background`, `--color-secondary-background`, `--color-border`, `--color-muted`, `--color-foreground`, `--color-feed`, `--color-paper`, `--color-danger`, `--color-inbox`
- The system shall define shadow tokens: `--shadow-x: 4px`, `--shadow-y: 4px`, `--shadow`, `--shadow-sm`, `--shadow-lg`
- The system shall define border tokens: `--border-w: 2px`, `--radius: 5px`, `--radius-lg: 8px`
- The system shall define typography tokens: `--font-sans` (Archivo), `--font-mono` (JetBrains Mono stack), `--font-weight-base: 600`, `--font-weight-heading: 900`
- The system shall define motion tokens: `--duration-fast: 60ms`, `--duration-base: 120ms`, `--ease-base: ease`
- The system shall define a spacing scale via Tailwind's default spacing (no override needed unless custom values are required)
- The system shall include dark mode token overrides using `@media (prefers-color-scheme: dark)` or a `.dark` class selector, providing alternate values for `--color-background`, `--color-secondary-background`, `--color-foreground`, `--color-muted`, and `--color-border`
- The system shall load Archivo (weights 400, 600, 700, 900) via Google Fonts preconnect links added to the `head()` in `apps/web/src/routes/__root.tsx`
- The system shall add a `font-mono` utility class in `styles.css` that applies `--font-mono`
- `DESIGN.md` at the repo root shall be fully populated with: all token names and values, typography scale, border/shadow system, spacing scale, motion tokens, and dark mode token table

**Proof Artifacts:**
- Screenshot: `apps/web` dev server at `/` with Archivo font loaded — browser DevTools Network tab shows `fonts.googleapis.com` request demonstrates font loading
- Screenshot: Tailwind utility `bg-main` applied to a test element renders the correct OKLCH purple demonstrates token wiring
- File review: `DESIGN.md` contains all token sections demonstrates documentation completeness

---

### Unit 2: Base Components

**Purpose:** Deliver the five primitive components that all Atlas screens will use. Each component must be visually correct per the prototype and functionally complete.

**Functional Requirements:**

**Button (`apps/web/src/components/ui/button.tsx`):**
- The system shall render a `<button>` element with variants: `primary` (purple `--color-main` background), `ghost` (transparent, no shadow), and default (secondary background with offset shadow)
- The system shall support a `sm` size modifier (28px height, 10px padding, 12px font)
- The system shall apply pressable feedback on active state: translate by `(shadow-x, shadow-y)` and collapse box-shadow to zero using `solid-motionone` `<Motion>` with `whileTap`
- The system shall apply a subtle lift on hover: translate `(-1px, -1px)` and expand shadow
- The system shall accept a `disabled` prop that sets `opacity: 0.5` and `cursor: not-allowed`
- The system shall accept an `onClick` prop and forward all native button attributes via `JSX.ButtonHTMLAttributes`

**Avatar (`apps/web/src/components/ui/avatar.tsx`):**
- The system shall render a square element (36×36px default) with `--radius` border and `--border-w` border
- The system shall display the first two characters of the `name` prop as initials (uppercase)
- The system shall derive background color by hashing the `name` string to an index in a fixed palette: `[main, feed, paper, ai, inbox, danger]` using the corresponding CSS custom property values
- The system shall support `sm` (28×28px) and `lg` (48×48px) size variants via a `size` prop
- The system shall apply a slight rotation (`rotate(-1deg)`) as a neobrutalist detail

**Toggle (`apps/web/src/components/ui/toggle.tsx`):**
- The system shall render an accessible toggle using a visually hidden `<input type="checkbox">` with a custom styled track and thumb
- The system shall accept `checked: boolean` and `onChange: (checked: boolean) => void` props (controlled)
- The system shall animate the thumb sliding from left to right using `solid-motionone` `<Motion>` with `animate` driven by the `checked` prop
- The system shall accept an optional `label` prop rendered as visible text beside the toggle
- The system shall respect `prefers-reduced-motion` by disabling the slide animation when reduced motion is preferred

**Icon (`apps/web/src/components/ui/icon.tsx`):**
- The system shall accept an `icon` prop typed as a `LucideIcon` component from `lucide-solid`
- The system shall accept `size` (number, default `16`) and `strokeWidth` (number, default `2`) props
- The system shall forward `class` and other SVG attributes to the underlying icon component
- The system shall render the icon at the specified size with consistent stroke width

**Badge (`apps/web/src/components/ui/badge.tsx`):**
- The system shall render an inline pill (border-radius 999px) with `--border-w` border
- The system shall support a `variant` prop with values: `default`, `main`, `feed`, `paper`, `ai`, `danger`, `inbox`, `muted` — each applying the corresponding background color
- The system shall support a `square` prop that switches border-radius to `--radius` instead of pill
- The system shall support priority display: when `priority` prop is `"P1"`, `"P2"`, or `"P3"`, render the label with appropriate styling (P1 = danger, P2 = feed, P3 = default)
- The system shall apply a subtle rotation (`rotate(-1.2deg)`) with hover scale-up as a neobrutalist detail

**Proof Artifacts:**
- Screenshot: `/dev/design-system` route showing all Button variants (primary, ghost, default, sm, disabled) demonstrates component completeness
- Screenshot: `/dev/design-system` route showing Avatar with multiple names — each renders different background color demonstrates hash derivation
- Screenshot: `/dev/design-system` route showing Toggle in checked and unchecked states demonstrates controlled behavior
- Screenshot: `/dev/design-system` route showing all Badge variants and priority badges demonstrates variant coverage
- Screenshot: `/dev/design-system` route showing Icon component with several lucide-solid icons demonstrates wrapper correctness

---

### Unit 3: Design System Dev Route

**Purpose:** Provide a single page where all components and variants can be visually inspected, serving as both a development tool and acceptance validation surface.

**Functional Requirements:**
- The system shall register a route at `/dev/design-system` via `apps/web/src/routes/dev/design-system.tsx`
- The route shall render all five components in all documented variants and states
- The route shall include interactive demos: a Toggle that can be clicked to change state, a Button that shows press feedback
- The route shall display token swatches for all color tokens with their names and OKLCH values
- The route shall include a typography specimen showing Archivo at weights 400, 600, 700, 900
- The route shall include a `@media (prefers-reduced-motion: reduce)` note visible in the UI

**Proof Artifacts:**
- Screenshot: `/dev/design-system` fully rendered with no console errors demonstrates route registration and component rendering
- Screenshot: Toggle clicked — thumb animates to checked position demonstrates motion integration
- Screenshot: Button pressed — shadow collapses and element translates demonstrates pressable feedback

---

## Non-Goals (Out of Scope)

1. **Form inputs**: Text inputs, selects, textareas, and checkboxes are not part of this spec — only the five listed components
2. **Navigation components**: Sidebar, header, nav links, and breadcrumbs are out of scope
3. **Dark mode toggle UI**: The dark mode tokens will be implemented (via `prefers-color-scheme` media query), but no user-facing toggle to switch themes is included
4. **Storybook or component documentation site**: The `/dev/design-system` route is the only documentation surface
5. **Animation library beyond solid-motionone**: No additional animation dependencies
6. **Server-side component logic**: All components are pure presentational SolidJS components with no server functions or API calls

## Design Considerations

The design system follows a **neobrutalist** aesthetic:
- Hard black borders (`--border-w: 2px solid`)
- Offset box shadows (4px × 4px, no blur, solid color)
- Bold font weights (600 base, 900 headings)
- Slight rotations on avatars and badges for playfulness
- Pressable button feedback: translate to shadow offset on active, collapsing shadow to zero
- Primary font: **Archivo** (variable, Google Fonts) — weights 400, 600, 700, 900
- Mono font: JetBrains Mono → SF Mono → Menlo fallback stack

**Token reference (light mode):**

| Token | Value |
|---|---|
| `--color-background` | `oklch(92.13% 0.0388 282.36)` |
| `--color-secondary-background` | `oklch(100% 0 0)` |
| `--color-foreground` | `oklch(0% 0 0)` |
| `--color-muted` | `oklch(40% 0.02 282)` |
| `--color-main` | `oklch(66.34% 0.1806 277.2)` |
| `--color-main-foreground` | `oklch(0% 0 0)` |
| `--color-border` | `oklch(0% 0 0)` |
| `--color-feed` | `#FACC00` |
| `--color-paper` | `#00D696` |
| `--color-danger` | `#FF4D50` |
| `--color-ai` | `#0099FF` |
| `--color-inbox` | `#7A83FF` |

**Dark mode token overrides:**

| Token | Dark value |
|---|---|
| `--color-background` | `oklch(26.58% 0.0737 283.96)` |
| `--color-secondary-background` | `oklch(20% 0 0)` |
| `--color-foreground` | `oklch(96% 0 0)` |
| `--color-muted` | `oklch(75% 0.02 282)` |
| `--color-border` | `oklch(0% 0 0)` |

The full interactive prototype at `docs/prototype/hay-inbox-prototype.html` is the visual source of truth for component appearance and interaction behavior.

## Repository Standards

- **Framework**: SolidJS — use `Component<Props>`, `JSX.Element`, `class` (not `className`), `<For>`, `<Show>`, `createSignal`
- **Styling**: Tailwind v4 CSS-first — all token additions go in `apps/web/src/styles.css` under `@theme {}`; no `tailwind.config.js`
- **Animation**: `solid-motionone` only — import `{ Motion, Presence }` from `"solid-motionone"`; do not use `motion` package
- **Icons**: `lucide-solid` — import individual icon components, not the React variants
- **File naming**: All source files use `snake_case` (e.g., `button.tsx`, `avatar.tsx`, `design_system.tsx`). This is enforced by Biome's `useFilenamingConvention` rule with `filenameCases: ["snake_case"]`. TanStack Router special prefixes (`__root.tsx`, `_layout.tsx`) and bracket syntax (`[id].tsx`) are natively supported by the rule and remain valid.
- **Biome rule**: `linter.rules.style.useFilenamingConvention` set to `"error"` with `filenameCases: ["snake_case"]` in root `biome.json`. Route files under `apps/web/src/routes/` are included — TanStack Router's `__root.tsx` and `[param].tsx` patterns are exempt by Biome's built-in exceptions.
- **Formatter**: Biome — all files must pass `biome check` without errors
- **Commits**: Conventional Commits — `feat(ui): add button component`, `feat(tokens): wire OKLCH tokens into Tailwind v4`
- **Package manager**: Bun — use `bun add` for any new dependencies
- **Component library**: Solid UI (`bunx solidui-cli@latest`) — scaffold base components via CLI, then customize with Atlas tokens. Run `bunx solidui-cli@latest init` once to set up `ui.config.json`, then `bunx solidui-cli@latest add <component>` per component.

## Technical Considerations

- **Solid UI scaffold workflow**: Run `bunx solidui-cli@latest init` in `apps/web/` to initialize (creates `ui.config.json`, installs Kobalte/corvu deps, sets up `cn` utility). Then `bunx solidui-cli@latest add button badge toggle` etc. to copy component source into `apps/web/src/components/ui/`. After copying, rename files to `snake_case` and replace Solid UI's default Tailwind classes with Atlas's token-based classes. Preserve Kobalte/corvu accessibility primitives — only change visual styling.
- **Solid UI + Tailwind v4 compatibility**: Solid UI's `init` command may configure Tailwind v3-style. Since this project uses Tailwind v4 (CSS-first), do not let `solidui-cli init` overwrite `styles.css` or add a `tailwind.config.js`. Run init, then manually verify `styles.css` still uses `@import "tailwindcss"` and `@theme {}` — not `@tailwind base/components/utilities`.
- **Biome `useFilenamingConvention`**: Add to root `biome.json` under `linter.rules.style`: `"useFilenamingConvention": { "level": "error", "options": { "filenameCases": ["snake_case"] } }`. Biome natively exempts `__root.tsx`, `[param].tsx`, and `.filename` patterns — no overrides needed for TanStack Router route files.
- **Tailwind v4 `@theme` block**: All design tokens are declared as CSS custom properties inside `@theme {}` in `styles.css`. Tailwind v4 automatically generates utility classes from `--color-*`, `--font-*`, `--shadow-*` etc. No JavaScript config file is needed.
- **Google Fonts loading**: Add `<link rel="preconnect" href="https://fonts.googleapis.com">`, `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`, and the Archivo stylesheet link to the `links` array in `__root.tsx`'s `head()` function — this is the TanStack Start pattern for injecting `<head>` content.
- **solid-motionone `whileTap`**: Use `whileTap={{ x: "var(--shadow-x)", y: "var(--shadow-y)" }}` and `animate={{ boxShadow: ... }}` for button press feedback. Wrap the `<button>` element in `<Motion>`.
- **Reduced motion**: Add `@media (prefers-reduced-motion: reduce) { * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; } }` to `styles.css`. For `solid-motionone` components, read `window.matchMedia("(prefers-reduced-motion: reduce)").matches` and conditionally disable animation props.
- **Avatar hash function**: A simple deterministic hash — sum char codes of the name string, modulo palette length — is sufficient. No external library needed.
- **Dark mode implementation**: Use `@media (prefers-color-scheme: dark)` to override CSS custom properties. The `.dark` class approach (as in the prototype) is an alternative if a manual toggle is added later — for this spec, media query is sufficient.
- **Component barrel export**: Create `apps/web/src/components/ui/index.ts` that re-exports all five components for clean import paths.

## Security Considerations

No specific security considerations identified. These are purely presentational components with no API calls, authentication, or sensitive data handling. No environment variables or secrets are involved.

## Success Metrics

1. **All 5 components render** at `/dev/design-system` with no console errors
2. **Tailwind token utilities work**: `bg-main`, `text-foreground`, `font-sans` etc. apply correct values
3. **Archivo loads**: Network tab shows font request to `fonts.googleapis.com`
4. **Reduced motion respected**: With `prefers-reduced-motion: reduce` set in OS, button press and toggle slide animations are disabled
5. **Biome passes**: `bun run check` exits 0 with no errors across all new files, including `useFilenamingConvention` snake_case enforcement
6. **All new files are snake_case**: No PascalCase or kebab-case source files introduced (route files with `__` prefix and `[param]` brackets are exempt)

## Open Questions

1. Should the `/dev/design-system` route be protected (e.g., only accessible in development builds) or is it acceptable to ship it in production for now? The existing `/dev/tanstack-libraries` route has no protection, suggesting dev routes are currently unguarded — this spec follows the same pattern.
