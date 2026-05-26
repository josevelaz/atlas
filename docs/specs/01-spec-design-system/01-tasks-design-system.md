# 01-tasks-design-system.md

## Relevant Files

| File | Why It Is Relevant |
| --- | --- |
| `biome.json` | Add `useFilenamingConvention` snake_case rule here |
| `apps/web/src/styles.css` | Add all `@theme` tokens, dark mode overrides, reduced-motion rule |
| `apps/web/src/routes/__root.tsx` | Add Google Fonts preconnect + Archivo stylesheet links |
| `apps/web/ui.config.json` | Created by `solidui-cli init`; configure `componentDir` |
| `apps/web/src/lib/utils.ts` | `cn` helper created by `solidui-cli init` |
| `apps/web/src/components/ui/button.tsx` | Button component (scaffolded by Solid UI, restyled with Hay tokens) |
| `apps/web/src/components/ui/avatar.tsx` | Avatar component (custom — Solid UI has no avatar; build from scratch) |
| `apps/web/src/components/ui/badge.tsx` | Badge component (scaffolded by Solid UI, restyled) |
| `apps/web/src/components/ui/toggle.tsx` | Toggle component (scaffolded by Solid UI, restyled + animated) |
| `apps/web/src/components/ui/icon.tsx` | Icon wrapper (custom — thin wrapper around `lucide-solid`) |
| `apps/web/src/components/ui/index.ts` | Barrel export for all five components |
| `apps/web/src/routes/dev/design_system.tsx` | `/dev/design-system` showcase route |
| `DESIGN.md` | Populate with all token documentation |

### Notes

- All new source files must use `snake_case` naming (enforced by Biome after task 1.0).
- TanStack Router route files with `__` prefix (`__root.tsx`) and `[param]` bracket syntax are exempt from snake_case by Biome's built-in exceptions — do not rename them.
- The route file for `/dev/design-system` must be named `design_system.tsx` (snake_case), not `design-system.tsx`.
- No test files are required for this spec — proof artifacts are screenshot/CLI/file-review based.
- Run `bun run lint` and `bun run typecheck` from `apps/web/` after each task to catch issues early.
- Use `bunx solidui-cli@latest` (not `npx`) per Bun-first repo convention.
- After any frontend change, validate with `npx agent-browser` per `AGENTS.md`.

---

## Tasks

### [ ] 1.0 Bootstrap Tooling: Biome snake_case Rule + Solid UI Init

#### 1.0 Proof Artifact(s)

- CLI: `bun run lint` from repo root exits 0 with no errors after adding `useFilenamingConvention` rule demonstrates Biome enforcement is live
- File: `apps/web/ui.config.json` exists and contains `componentDir` pointing to `src/components/ui` demonstrates Solid UI is initialized
- File: `apps/web/src/lib/utils.ts` (or equivalent `cn` helper) exists demonstrates Solid UI init completed successfully
- CLI: `bunx solidui-cli@latest add button` dry-run or interactive picker lists available components demonstrates CLI is functional

#### 1.0 Tasks

- [x] 1.1 Open `biome.json` at the repo root. Under `linter.rules.style`, add: `"useFilenamingConvention": { "level": "error", "options": { "filenameCases": ["snake_case"] } }`. Save the file.
- [x] 1.2 Run `bun run lint` from the repo root. Confirm it exits 0. If existing files fail the new rule, rename them to snake_case (check `apps/web/src/` — existing files like `routeTree.gen.ts`, `client.tsx`, `router.tsx`, `ssr.tsx` may need renaming or Biome ignore comments if they are auto-generated).
- [x] 1.3 `cd apps/web` and run `bunx solidui-cli@latest init`. When prompted, set the component directory to `src/components/ui`. Do **not** allow the init command to overwrite `styles.css` or add a `tailwind.config.js` — if prompted, decline those options.
- [x] 1.4 After init, open `apps/web/src/styles.css` and verify it still contains `@import "tailwindcss"` and the `@view-transition` block. If init overwrote it, restore those lines.
- [x] 1.5 Verify `apps/web/ui.config.json` was created and contains the correct `componentDir`. Verify `apps/web/src/lib/utils.ts` (or `src/components/ui/utils.ts`) was created with a `cn` helper function.
- [x] 1.6 Run `bun run lint` again from repo root to confirm no new Biome errors were introduced by the Solid UI init files.

---

### [ ] 2.0 Design Tokens: Wire OKLCH Tokens into Tailwind v4 + Populate DESIGN.md

#### 2.0 Proof Artifact(s)

- Screenshot: `apps/web` dev server at `http://localhost:3001` — browser DevTools Elements panel shows `--color-main` CSS custom property resolving to `oklch(66.34% 0.1806 277.2)` on `:root` demonstrates token wiring
- Screenshot: DevTools Network tab showing `fonts.googleapis.com` request for Archivo demonstrates font loading
- Screenshot: DevTools Elements panel showing `--color-background` switching value when OS dark mode is toggled demonstrates dark mode token override
- File review: `DESIGN.md` contains all sections (Color Tokens, Typography, Border/Shadow, Motion, Dark Mode table) demonstrates documentation completeness

#### 2.0 Tasks

- [ ] 2.1 Open `apps/web/src/styles.css`. After the `@import "tailwindcss"` line, add an `@theme {}` block. Inside it, define all color tokens as CSS custom properties:
  ```css
  @theme {
    --color-background: oklch(92.13% 0.0388 282.36);
    --color-secondary-background: oklch(100% 0 0);
    --color-foreground: oklch(0% 0 0);
    --color-muted: oklch(40% 0.02 282);
    --color-main: oklch(66.34% 0.1806 277.2);
    --color-main-foreground: oklch(0% 0 0);
    --color-border: oklch(0% 0 0);
    --color-feed: #FACC00;
    --color-paper: #00D696;
    --color-danger: #FF4D50;
    --color-ai: #0099FF;
    --color-inbox: #7A83FF;
  }
  ```
- [ ] 2.2 Still in `@theme {}`, add shadow tokens:
  ```css
    --shadow-x: 4px;
    --shadow-y: 4px;
    --shadow: 4px 4px 0px oklch(0% 0 0);
    --shadow-sm: 2px 2px 0px oklch(0% 0 0);
    --shadow-lg: 6px 6px 0px oklch(0% 0 0);
  ```
- [ ] 2.3 Still in `@theme {}`, add border, radius, typography, and motion tokens:
  ```css
    --border-w: 2px;
    --radius: 5px;
    --radius-lg: 8px;
    --font-sans: "Archivo", ui-sans-serif, system-ui, sans-serif;
    --font-mono: "JetBrains Mono", "SF Mono", Menlo, monospace;
    --font-weight-base: 600;
    --font-weight-heading: 900;
    --duration-fast: 60ms;
    --duration-base: 120ms;
    --ease-base: ease;
  ```
- [ ] 2.4 After the `@theme {}` block, add dark mode token overrides using a media query:
  ```css
  @media (prefers-color-scheme: dark) {
    :root {
      --color-background: oklch(26.58% 0.0737 283.96);
      --color-secondary-background: oklch(20% 0 0);
      --color-foreground: oklch(96% 0 0);
      --color-muted: oklch(75% 0.02 282);
    }
  }
  ```
- [ ] 2.5 After the dark mode block, add the global reduced-motion rule:
  ```css
  @media (prefers-reduced-motion: reduce) {
    * {
      transition-duration: 0.01ms !important;
      animation-duration: 0.01ms !important;
    }
  }
  ```
- [ ] 2.6 Open `apps/web/src/routes/__root.tsx`. In the `head()` function's `links` array, add three new entries before the existing stylesheet link:
  ```ts
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,400;0,600;0,700;0,900;1,400&display=swap",
  },
  ```
- [ ] 2.7 Start the dev server (`bun run dev:web` from repo root or `bun run dev` from `apps/web/`). Open `http://localhost:3001` in a browser. Open DevTools → Elements → inspect `:root` and confirm `--color-main` is present. Open DevTools → Network → filter by "fonts" and confirm a request to `fonts.googleapis.com` appears.
- [ ] 2.8 Populate `DESIGN.md` at the repo root with the full token documentation. Include sections: Color Tokens (light + dark table), Typography (font families, weights, scale), Border & Shadow (all tokens with values), Motion (duration + easing tokens), and a Usage Notes section explaining the Tailwind v4 `@theme` approach.
- [ ] 2.9 Run `bun run lint` and `bun run typecheck` from `apps/web/`. Fix any errors before proceeding.
- [ ] 2.10 Commit: `feat(tokens): wire OKLCH design tokens into Tailwind v4 and populate DESIGN.md`

---

### [ ] 3.0 Base Components: Button, Avatar, Badge

#### 3.0 Proof Artifact(s)

- Screenshot: `/dev/design-system` showing Button in `primary`, `ghost`, `default`, `sm`, and `disabled` states demonstrates variant coverage
- Screenshot: `/dev/design-system` showing Button pressed — element translates and shadow collapses demonstrates `solid-motionone` press feedback
- Screenshot: `/dev/design-system` showing Avatar row with 4+ different names — each renders a distinct background color demonstrates hash-based palette derivation
- Screenshot: `/dev/design-system` showing all Badge variants (`main`, `feed`, `paper`, `ai`, `danger`, `inbox`, `muted`) and priority badges (`P1`, `P2`, `P3`) demonstrates variant and priority coverage
- CLI: `bun run lint` from `apps/web/` exits 0 — no Biome errors on new component files demonstrates code quality

#### 3.0 Tasks

- [ ] 3.1 Scaffold Button via Solid UI: run `bunx solidui-cli@latest add button` from `apps/web/`. This copies a `button.tsx` (or similar) into `src/components/ui/`. Rename the file to `button.tsx` (snake_case) if it isn't already.
- [ ] 3.2 Rewrite `apps/web/src/components/ui/button.tsx` to use Hay tokens. The component must:
  - Accept a `variant` prop: `"primary"` | `"ghost"` | `"default"` (default: `"default"`)
  - Accept a `size` prop: `"default"` | `"sm"` (default: `"default"`)
  - Accept `disabled` boolean prop
  - Forward all native `JSX.ButtonHTMLAttributes` via `splitProps`
  - Wrap the `<button>` in `<Motion>` from `solid-motionone` with `whileTap` that translates by `(var(--shadow-x), var(--shadow-y))` and collapses `box-shadow` to `none`
  - Apply hover: translate `(-1px, -1px)` and expand shadow
  - Variant styles: `primary` = `bg-main text-main-foreground`, `ghost` = transparent no shadow, `default` = `bg-secondary-background` with `var(--shadow)` box-shadow
  - Size styles: `default` = 36px height, `sm` = 28px height, 10px horizontal padding, 12px font
  - `disabled` = `opacity-50 cursor-not-allowed`
  - All borders use `border-[length:var(--border-w)] border-border`
  - Border radius: `rounded-[var(--radius)]`
- [ ] 3.3 Create `apps/web/src/components/ui/avatar.tsx` from scratch (Solid UI has no avatar component). The component must:
  - Accept `name: string`, `size?: "sm" | "default" | "lg"` props
  - Display the first two characters of `name` as uppercase initials
  - Derive background color by hashing `name`: sum all char codes, modulo 6, then map index to `["var(--color-main)", "var(--color-feed)", "var(--color-paper)", "var(--color-ai)", "var(--color-inbox)", "var(--color-danger)"]`
  - Size map: `sm` = 28×28px, `default` = 36×36px, `lg` = 48×48px
  - Apply `border-[length:var(--border-w)] border-border rounded-[var(--radius)]`
  - Apply `style="transform: rotate(-1deg)"` as a neobrutalist detail
  - Use `font-weight: var(--font-weight-base)` for initials text
- [ ] 3.4 Scaffold Badge via Solid UI: run `bunx solidui-cli@latest add badge` from `apps/web/`. Rename to `badge.tsx` if needed.
- [ ] 3.5 Rewrite `apps/web/src/components/ui/badge.tsx` to use Hay tokens. The component must:
  - Accept `variant?: "default" | "main" | "feed" | "paper" | "ai" | "danger" | "inbox" | "muted"` (default: `"default"`)
  - Accept `square?: boolean` — when true, use `rounded-[var(--radius)]` instead of `rounded-full`
  - Accept `priority?: "P1" | "P2" | "P3"` — when set, override variant: P1 → `danger`, P2 → `feed`, P3 → `default`; render the priority label as children
  - Accept `children` for label text
  - Apply `border-[length:var(--border-w)] border-border` and 22px min-height
  - Apply `style="transform: rotate(-1.2deg)"` with `hover:scale-105` transition
  - Variant background map: `main` → `bg-main`, `feed` → `bg-feed`, `paper` → `bg-paper`, `ai` → `bg-ai`, `danger` → `bg-danger`, `inbox` → `bg-inbox`, `muted` → `bg-muted`, `default` → `bg-secondary-background`
- [ ] 3.6 Run `bun run lint` and `bun run typecheck` from `apps/web/`. Fix any errors.
- [ ] 3.7 Commit: `feat(ui): add Button, Avatar, and Badge components`

---

### [ ] 4.0 Base Components: Toggle + Icon

#### 4.0 Proof Artifact(s)

- Screenshot: `/dev/design-system` showing Toggle in unchecked state demonstrates initial render
- Screenshot: `/dev/design-system` showing Toggle after click — thumb has moved to checked position demonstrates controlled state update and animation
- Screenshot: `/dev/design-system` showing Icon component rendering 4+ different `lucide-solid` icons at varying sizes demonstrates wrapper correctness
- CLI: `bun run typecheck` from `apps/web/` exits 0 demonstrates TypeScript types are correct for all new components

#### 4.0 Tasks

- [ ] 4.1 Scaffold Toggle via Solid UI: run `bunx solidui-cli@latest add toggle` from `apps/web/`. Rename to `toggle.tsx` if needed.
- [ ] 4.2 Rewrite `apps/web/src/components/ui/toggle.tsx` to use Hay tokens. The component must:
  - Accept `checked: boolean` and `onChange: (checked: boolean) => void` props (controlled)
  - Accept optional `label?: string` prop rendered as visible text beside the toggle
  - Render a visually hidden `<input type="checkbox">` for accessibility (use `sr-only` class)
  - Render a custom track (52×28px, `rounded-full`, `border-[length:var(--border-w)] border-border`) with background switching between `bg-secondary-background` (unchecked) and `bg-main` (checked)
  - Render a thumb (22×22px square, `bg-foreground`, `rounded-[var(--radius)]`) inside the track
  - Animate the thumb using `<Motion>` from `solid-motionone` with `animate={{ x: checked ? "24px" : "2px" }}` and `transition={{ duration: 0.12, easing: "ease" }}`
  - Read `window.matchMedia("(prefers-reduced-motion: reduce)").matches` on mount using `onMount`; if true, set animation `duration` to `0`
  - Wire `onClick` on the track to call `onChange(!checked)`
- [ ] 4.3 Create `apps/web/src/components/ui/icon.tsx` from scratch. The component must:
  - Import `type { Component } from "solid-js"` and `type { LucideProps } from "lucide-solid"`
  - Accept props: `icon: Component<LucideProps>`, `size?: number` (default `16`), `strokeWidth?: number` (default `2`), and spread remaining `LucideProps` via rest props
  - Render the icon component as `<props.icon size={props.size} strokeWidth={props.strokeWidth} {...rest} />`
  - Export as named export `Icon`
- [ ] 4.4 Create `apps/web/src/components/ui/index.ts` as a barrel export file:
  ```ts
  export { Button } from "./button";
  export { Avatar } from "./avatar";
  export { Badge } from "./badge";
  export { Toggle } from "./toggle";
  export { Icon } from "./icon";
  ```
- [ ] 4.5 Run `bun run lint` and `bun run typecheck` from `apps/web/`. Fix any errors.
- [ ] 4.6 Commit: `feat(ui): add Toggle and Icon components with barrel export`

---

### [ ] 5.0 Dev Route: `/dev/design-system` Showcase Page

#### 5.0 Proof Artifact(s)

- Screenshot: `http://localhost:3001/dev/design-system` fully rendered with no browser console errors demonstrates route registration and component rendering
- Screenshot: Color token swatches section showing all 11 color tokens with names and values demonstrates token documentation
- Screenshot: Typography specimen showing Archivo at weights 400, 600, 700, 900 demonstrates font loading and weight range
- Screenshot: Reduced-motion note visible in the UI demonstrates accessibility documentation
- CLI: `bun run build` from `apps/web/` exits 0 demonstrates no build-time errors introduced

#### 5.0 Tasks

- [ ] 5.1 Create `apps/web/src/routes/dev/design_system.tsx`. Register the route with `createFileRoute("/dev/design-system")`. The component function must be named `DesignSystemPage`.
- [ ] 5.2 Import all five components from `../../components/ui/index` (or individual files). Import relevant `lucide-solid` icons for the Icon demo (e.g., `Mail`, `Star`, `Bell`, `Search`).
- [ ] 5.3 Add a **Color Tokens** section: render a grid of swatches, one per token. Each swatch is a 48×48px div with `background-color: var(--color-<name>)`, a border, and a label below showing the token name and its OKLCH/hex value.
- [ ] 5.4 Add a **Typography** section: render the text "Archivo" at font-weights 400, 600, 700, and 900 using inline `style="font-weight: <N>"`. Include a mono specimen using `font-mono`.
- [ ] 5.5 Add a **Button** section: render all variants side by side — `default`, `primary`, `ghost`, `sm`, and `disabled`. Each button should have a descriptive label.
- [ ] 5.6 Add an **Avatar** section: render a row of 5+ Avatar components with different names (e.g., "Alice", "Bob", "Carol", "Dave", "Eve", "Frank") to demonstrate the hash-based color palette.
- [ ] 5.7 Add a **Badge** section: render all 8 variants in a row, then a second row with `P1`, `P2`, `P3` priority badges, then a third row with `square` prop examples.
- [ ] 5.8 Add a **Toggle** section: use `createSignal(false)` to manage local state. Render a `Toggle` wired to that signal so clicking it toggles between checked/unchecked. Add a label showing the current state.
- [ ] 5.9 Add an **Icon** section: render the `Icon` component with 4+ different lucide-solid icons at sizes 16, 20, 24, and 32.
- [ ] 5.10 Add a **Reduced Motion** note at the bottom of the page: a small info box stating "This page respects `prefers-reduced-motion`. Toggle it in your OS accessibility settings to disable animations."
- [ ] 5.11 Start the dev server and navigate to `http://localhost:3001/dev/design-system`. Verify all sections render, no console errors appear, and the Toggle is interactive.
- [ ] 5.12 Run `bun run build` from `apps/web/`. Confirm it exits 0.
- [ ] 5.13 Run `npx agent-browser` to validate the UI renders correctly and meets spec requirements. Capture screenshots as proof artifacts.
- [ ] 5.14 Commit: `feat(ui): add /dev/design-system showcase route`
- [ ] 5.15 Push the `feat/issue-2-design-system` branch and open a pull request using the GitHub CLI: `gh pr create --title "feat: design system — tokens, DESIGN.md, base components" --body "Closes #2" --base main`
