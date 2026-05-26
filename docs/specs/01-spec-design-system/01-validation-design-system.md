# 01-validation-design-system.md

**Spec**: `docs/specs/01-spec-design-system/01-spec-design-system.md`
**Branch**: `feat/issue-2-design-system`
**Validated**: 2026-05-26
**Validator**: Shuttle (Weave leaf worker)

---

## Executive Summary

**Overall: FAIL**

**Gates tripped**: Gate A, Gate C.

**Implementation Ready**: No — two spec-required proof artifacts cannot be produced in their exact form (interactive screenshots blocked by environment constraints), and the committed route path deviates from the spec literal. All implementation code is correct; the spec's acceptance criteria as written are not fully met.

| Gate | Result | Tripped by |
|---|---|---|
| A — No CRITICAL/HIGH blockers | **FAIL** | V-01 and V-02 are HIGH: non-functional proof artifacts are auto-blockers per validation rules, regardless of whether implementation code is correct |
| B — No Unknown FR entries | PASS | All 40 FRs have evidence-based `Verified` or `Failed` verdicts; zero `Unknown` |
| C — Proof artifacts accessible/functional | **FAIL** | 2 of 15 required artifacts are non-conforming substitutes (see V-01, V-02) |
| D — File integrity / no unmapped core changes | PASS | All 12 core files mapped to tasks; no stray changes |
| E — Repository standards compliance | PASS | lint exit 0, typecheck exit 0, build exit 0 |
| F — No secrets in proof artifacts | PASS | No credentials or keys found in any proof file |

**Key metrics**:
- Requirements Verified: 36 / 40 (90%) — 4 Failed (button press feedback, toggle animation, route path, interactive demos)
- Proof Artifacts Working: 13 / 15 (87%) — 2 Failed (button pressed state, toggle click-driven state)
- Files Changed vs Expected: 12 / 12 (100%) — all core files present and mapped

**Gate C failure detail**:
1. The spec requires a screenshot of Button in a *pressed* state (shadow collapsed, element translated). The submitted artifact `task-03-button-pressed.png` shows the resting state. `solid-motionone` gesture detection requires `event.isTrusted === true`; headless CDP events do not satisfy this, making automated capture impossible.
2. The spec requires a screenshot of Toggle *after a click* with the thumb in the checked position. The submitted artifact `task-04-toggle-checked.png` shows a statically-rendered `checked={true}` prop, not a click-driven transition. A pre-existing app-wide SSR hydration failure (`hydrate()` throws in `client.tsx`) prevents all click handlers from firing on every page in the app.

**Additional finding (not a gate)**: The spec specifies the route at `/dev/design-system` (hyphen). The committed route is `/dev/design_system` (underscore) — a framework constraint, not a code error. This affects Unit 3 FR coverage and all proof artifacts that reference the route URL.

**Task completion state** (from `01-tasks-design-system.md`):
- `[x]` 1.0 Bootstrap Tooling
- `[x]` 2.0 Design Tokens
- `[ ]` 3.0 Base Components: Button, Avatar, Badge — **blocked** (proof exactness)
- `[ ]` 4.0 Base Components: Toggle + Icon — **blocked** (proof exactness + hydration bug)
- `[x]` 5.0 Dev Route

---

## Coverage Matrix

### Functional Requirements

Status values: `Verified` = evidence confirms requirement met. `Failed` = requirement not met or not verifiable. `Unknown` = no evidence available.

#### Unit 1: Token System + Tailwind Wiring

| Requirement | Status | Evidence |
|---|---|---|
| 11 color tokens as OKLCH CSS custom properties in `@theme` block | Verified | `styles.css` L3–15: all 11 tokens present with correct values |
| Shadow tokens: `--shadow-x`, `--shadow-y`, `--shadow`, `--shadow-sm`, `--shadow-lg` | Verified | `styles.css` L17–21: all 5 tokens with correct values |
| Border tokens: `--border-w: 2px`, `--radius: 5px`, `--radius-lg: 8px` | Verified | `styles.css` L23–25 |
| Typography tokens: `--font-sans` (Archivo), `--font-mono` (JetBrains Mono), `--font-weight-base: 600`, `--font-weight-heading: 900` | Verified | `styles.css` L26–29 |
| Motion tokens: `--duration-fast: 60ms`, `--duration-base: 120ms`, `--ease-base: ease` | Verified | `styles.css` L30–32 |
| Dark mode overrides via `@media (prefers-color-scheme: dark)` for 5 tokens | Verified | `styles.css` L65–72: 4 tokens overridden (spec lists 5; `--color-border` unchanged in dark mode per spec table — acceptable) |
| Archivo loaded via Google Fonts preconnect links in `__root.tsx` `head()` | Verified | `__root.tsx` L28–37: 3 link entries; proof `screenshot-02-fonts-network.png` shows HTTP 200 GET to `fonts.googleapis.com` |
| `DESIGN.md` fully populated with all token sections | Verified | `DESIGN.md` contains all 15 sections per `01-task-02-proofs.md` table |
| Global reduced-motion rule in `styles.css` | Verified | `styles.css` L74–81: `@media (prefers-reduced-motion: reduce)` with `!important` overrides; Biome `biome-ignore` comments present |

#### Unit 2: Base Components

**Button**

| Requirement | Status | Evidence |
|---|---|---|
| `primary`, `ghost`, `default` variants | Verified | `button.tsx` L6–10: `variant_classes` map; proof `task-03-button-variants.png` shows all 3 |
| `sm` size modifier (28px height, 10px padding, 12px font) | Verified | `button.tsx` L14: `"h-[28px] px-[10px] text-[12px]"`; visible in `task-03-button-variants.png` |
| Pressable feedback via `solid-motionone` `<Motion>` with `whileTap`/`press` | Failed | `button.tsx` L39–55: `<Motion.button press={{ transform: "translate(var(--shadow-x), var(--shadow-y))", "box-shadow": "none" }}>` — code correct. Proof artifact `task-03-button-pressed.png` shows resting state only; pressed state not capturable in headless (trusted event required by `solid-motionone`). Spec requires visual pressed-state screenshot. |
| Hover lift: translate `(-1px, -1px)` and expand shadow | Verified | `button.tsx` L48–54: `hover={{ transform: "translate(-1px, -1px)", "box-shadow": "5px 5px 0px oklch(0% 0 0)" }}` — code verified |
| `disabled` prop: `opacity: 0.5`, `cursor: not-allowed` | Verified | `button.tsx` L64: `"opacity-50 cursor-not-allowed pointer-events-none"`; visible in `task-03-button-variants.png` |
| `onClick` + native `JSX.ButtonHTMLAttributes` forwarding | Verified | `button.tsx` L23, L30–36: `Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "disabled">` + `splitProps` + `{...others}` |

**Avatar**

| Requirement | Status | Evidence |
|---|---|---|
| Square element with `--radius` border and `--border-w` border | Verified | `avatar.tsx` L43–45: `border-[length:var(--border-w)] border-border rounded-[var(--radius)]` |
| First two characters of `name` as uppercase initials | Verified | `avatar.tsx` L37: `props.name.slice(0, 2).toUpperCase()` |
| Background color derived by hashing `name` to palette index | Verified | `avatar.tsx` L5–26: `hash_name()` sums char codes mod 6; proof `task-03-avatar-palette.png` shows 8 names with distinct colors |
| `sm` (28×28px), `default` (36×36px), `lg` (48×48px) size variants | Verified | `avatar.tsx` L14–18: `size_map` with correct pixel values |
| `rotate(-1deg)` neobrutalist detail | Verified | `avatar.tsx` L51: `transform: "rotate(-1deg)"` |

**Toggle**

| Requirement | Status | Evidence |
|---|---|---|
| Accessible toggle with visually hidden `<input type="checkbox">` | Verified | `toggle.tsx` L22–27: `<input type="checkbox" class="sr-only">` |
| `checked: boolean` and `onChange: (checked: boolean) => void` (controlled) | Verified | `toggle.tsx` L6–8: `ToggleProps` type; `onChange` wired at L26, L34 |
| Thumb animation via `solid-motionone` `<Motion>` driven by `checked` | Failed | `toggle.tsx` L39–43: `<Motion.div animate={{ x: props.checked ? "24px" : "2px" }}>` — code correct. Proof artifact `task-04-toggle-checked.png` shows static `checked={true}` prop, not a click-driven transition. Pre-existing app-wide SSR hydration failure prevents all click handlers from firing (23 `data-hk` markers remain; zero `$$click` handlers attached; same failure on pre-existing `/dev/tanstack_libraries` page). Spec requires click-driven screenshot. |
| Optional `label` prop rendered beside toggle | Verified | `toggle.tsx` L45–49: `<Show when={props.label}>` |
| `prefers-reduced-motion` disables animation | Verified | `toggle.tsx` L12–18: `onMount` reads `window.matchMedia("(prefers-reduced-motion: reduce)").matches`; sets `duration(0)` |

**Icon**

| Requirement | Status | Evidence |
|---|---|---|
| `icon` prop typed as `Component<LucideProps>` | Verified | `icon.tsx` L6: `icon: Component<LucideProps>` |
| `size` (default 16) and `strokeWidth` (default 2) props | Verified | `icon.tsx` L12: `mergeProps({ size: 16, strokeWidth: 2 }, raw_props)` |
| Forward `class` and other SVG attributes | Verified | `icon.tsx` L13, L16: `splitProps` + `{...rest}` spread |
| Render icon at specified size with consistent stroke width | Verified | `icon.tsx` L16: `<local.icon size={local.size} strokeWidth={local.strokeWidth} {...rest} />`; proof `task-04-icons.png` shows Mail/Star/Bell/Search at 16/20/24/32px |

**Badge**

| Requirement | Status | Evidence |
|---|---|---|
| Inline pill with `--border-w` border | Verified | `badge.tsx` L57: `border-[length:var(--border-w)] border-border min-h-[22px]` |
| `variant` prop: all 8 values | Verified | `badge.tsx` L5–14: `variant_bg` map; proof `task-03-badge-variants.png` shows all 8 |
| `square` prop: switches to `--radius` | Verified | `badge.tsx` L60: `local.square ? "rounded-[var(--radius)]" : "rounded-full"` |
| `priority` prop: P1→danger, P2→feed, P3→default | Verified | `badge.tsx` L16–19, L48–51: `priority_to_variant` map; proof shows P1/P2/P3 rows |
| `rotate(-1.2deg)` with `hover:scale-105` | Verified | `badge.tsx` L59, L64: `hover:scale-105` + `style={{ transform: "rotate(-1.2deg)" }}` |

#### Unit 3: Design System Dev Route

| Requirement | Status | Evidence |
|---|---|---|
| Route registered at `/dev/design-system` | Failed | Committed route is `/dev/design_system` (underscore). TanStack Router derives path from filename; Biome snake_case rule requires `design_system.tsx`; no override mechanism exists. `routeTree.gen.ts` L26–30 confirms `path: '/dev/design_system'`. Spec URL `/dev/design-system` would 404. |
| Route renders all five components in all documented variants | Verified | `design_system.tsx` L136–215: all 5 components, all variants. Proof `task-05-full-page.png` + agent-browser eval: 7 `<h2>` headings confirmed |
| Interactive demos: Toggle clickable, Button press feedback | Failed | Toggle wired to `createSignal` (code correct). Button has `<Motion.button>` press/hover props (code correct). Neither is demonstrable via click due to pre-existing SSR hydration failure. |
| Color token swatches for all color tokens | Verified | `design_system.tsx` L14–47, L86–109: 12 swatches. Proof `task-05-color-tokens.png` |
| Typography specimen: Archivo at weights 400, 600, 700, 900 | Verified | `design_system.tsx` L115–130: 4 weight lines + mono. Proof `task-05-typography.png` |
| `prefers-reduced-motion` note visible in UI | Verified | `design_system.tsx` L259–276: info box. Proof `task-05-reduced-motion.png` |

---

### Repository Standards

| Standard | Status | Evidence |
|---|---|---|
| SolidJS primitives — no React imports | Verified | All component files import from `solid-js`; no React imports |
| Tailwind v4 CSS-first — `@theme {}`, no `tailwind.config.js` | Verified | `styles.css` L1: `@import "tailwindcss"` + `@theme {}`. No `tailwind.config.js` |
| `solid-motionone` only | Verified | `button.tsx` L3, `toggle.tsx` L3: `import { Motion } from "solid-motionone"` |
| `lucide-solid` icons | Verified | `icon.tsx` L3, `design_system.tsx` L4 |
| snake_case filenames enforced by Biome | Verified | `biome.json` L28–34: `"useFilenamingConvention": { "level": "error", "options": { "filenameCases": ["snake_case"] } }`. All new files comply. |
| Biome lint — `bun run lint` exit 0 | Verified | Live run: `Checked 22 files in 23ms. No fixes applied.` Exit 0. |
| TypeScript — `tsc --noEmit` exit 0 | Verified | Live run: `tsc --noEmit` exit 0, no output. |
| Build — `bun run build` exit 0 | Verified | Prior run (commit `745d447`): `✓ 2233 modules transformed`, exit 0. Not re-run to avoid dirtying `routeTree.gen.ts`. |
| Conventional Commits | Verified | All commits: `feat(tooling):`, `feat(tokens):`, `feat(ui):`, `docs(spec):`, `fix(routes):` |
| Bun package manager | Verified | All installs use `bun add` |
| Component barrel export | Verified | `index.ts`: re-exports all 5 components |

---

### Proof Artifacts

| Artifact (spec-required) | File | Status | Notes |
|---|---|---|---|
| Token wiring — `--color-main` on `:root` | `screenshot-01-color-main-root.png` | Verified | Injected panel shows resolved values |
| Font loading — `fonts.googleapis.com` request | `screenshot-02-fonts-network.png` | Verified | HTTP 200 GET for Archivo |
| Dark mode — token override active | `screenshot-03-dark-mode-override.png` | Verified | `prefersDark=true`, 4 tokens show dark values |
| Button variants (primary, ghost, default, sm, disabled) | `task-03-button-variants.png` | Verified | All 5 states visible |
| **Button pressed state** | `task-03-button-pressed.png` | **Failed** | Shows resting state. Pressed state not capturable: `solid-motionone` requires `event.isTrusted === true`; headless CDP events do not qualify. |
| Avatar palette — hash-based colors | `task-03-avatar-palette.png` | Verified | 8 names, distinct colors, hash table in proof doc |
| Badge variants + priority + square | `task-03-badge-variants.png` | Verified | All 8 variants, P1/P2/P3, square prop |
| Toggle unchecked state | `task-04-toggle-unchecked.png` | Verified | Track `bg-secondary-background`, thumb at `x: 2px` |
| **Toggle checked state (click-driven)** | `task-04-toggle-checked.png` | **Failed** | Shows static `checked={true}` prop. Click-driven transition not capturable: pre-existing app-wide SSR hydration failure prevents all click handlers from firing. Evidence: 23 `data-hk` markers remain; zero `$$click` handlers attached; same failure on pre-existing `/dev/tanstack_libraries` page. |
| Hydration bug evidence (supporting) | `task-04-hydration-bug-evidence.png` | Verified | Pre-existing page confirms app-wide scope |
| Icon — 4+ icons at varying sizes | `task-04-icons.png` | Verified | Mail/Star/Bell/Search at 16/20/24/32px |
| `/dev/design_system` full page render | `task-05-full-page.png` | Verified | All 7 sections; agent-browser confirms 7 `<h2>` headings |
| Color token swatches | `task-05-color-tokens.png` | Verified | 12 swatches with names and values |
| Typography specimen | `task-05-typography.png` | Verified | Archivo 400/600/700/900 + JetBrains Mono |
| Reduced motion note | `task-05-reduced-motion.png` | Verified | Info box with `prefers-reduced-motion` code element |

---

## Validation Issues

### Issue V-01 — Button Pressed-State Proof Not Capturable (Gate C)

**Severity**: HIGH — non-functional proof artifact (auto-blocker per validation rules; triggers Gate A)
**Spec reference**: Unit 2 Button FR "pressable feedback"; Unit 3 proof "Button pressed — shadow collapses and element translates"

The spec requires a screenshot showing the button in a visually pressed state (translated by `(shadow-x, shadow-y)`, `box-shadow: none`). The implementation is correct — `button.tsx` uses `<Motion.button press={{ transform: "translate(var(--shadow-x), var(--shadow-y))", "box-shadow": "none" }}>`. However, `solid-motionone`'s gesture detection requires `event.isTrusted === true`. Headless Chrome CDP pointer events and JavaScript-dispatched events do not set `isTrusted`, so the press animation never fires in automated capture.

**What exists**: `task-03-button-pressed.png` shows the button in its resting state. The proof document (`01-task-03-proofs.md`) explains the limitation and provides code-level verification.

**To resolve**: Manual browser interaction required, or a test harness that bypasses `solid-motionone` gesture detection (e.g., directly setting CSS transform via JS for screenshot purposes).

---

### Issue V-02 — Toggle Click-Driven Proof Not Capturable (Gate C)

**Severity**: HIGH — non-functional proof artifact (auto-blocker per validation rules; triggers Gate A)
**Spec reference**: Unit 2 Toggle FR "animate the thumb sliding from left to right"; Unit 3 proof "Toggle clicked — thumb animates to checked position"

The spec requires a screenshot of the Toggle after a click showing the thumb moved to the checked position. The implementation is correct — `toggle.tsx` wires `onClick={() => props.onChange(!props.checked)}` and `<Motion.div animate={{ x: props.checked ? "24px" : "2px" }}>`. However, a pre-existing app-wide SSR hydration failure prevents all click handlers from firing.

**Concrete evidence of hydration failure** (from `01-task-04-proofs.md`):
- `document.querySelectorAll('[data-hk]').length` → 23 (SolidJS hydration markers not removed)
- Zero elements have `$$click` delegated handler attached
- Same failure confirmed on pre-existing `/dev/tanstack_libraries` page (committed before Task 4)
- Root cause: `hydrate()` from `solid-js/web` throws `TypeError: Cannot read properties of undefined (reading 'done')` in `client.tsx`'s `hydrateStart().then(...)` chain with no `.catch()` handler

**What exists**: `task-04-toggle-checked.png` shows a statically-rendered `checked={true}` Toggle instance. The proof document explains the limitation.

**To resolve**: Fix the SSR hydration bug in `apps/web/src/client.tsx` (add error handling to `hydrateStart().then(...)` or resolve the SSR/client mismatch), then re-capture the click-driven screenshot.

---

### Issue V-03 — Route Path Deviates from Spec (FR Failed)

**Severity**: MEDIUM (FR failure, not a Gate C trigger)
**Spec reference**: Unit 3 FR "register a route at `/dev/design-system`"; all Unit 2/3 proof artifacts referencing the route URL

The spec specifies `/dev/design-system` (hyphen). The committed route is `/dev/design_system` (underscore). This is a framework constraint: TanStack Router derives the URL path from the filename, and Biome's `useFilenamingConvention` rule (added per spec Task 1.0) requires `design_system.tsx`. There is no `createFileRoute` path-override mechanism for file-based routes — the argument must match the generated path exactly or the build fails with a type error.

**What exists**: The route is functional at `/dev/design_system`. All proof screenshots use the correct URL. The spec URL `/dev/design-system` would 404.

**To resolve** (reviewer choice):
1. Accept `/dev/design_system` as canonical and update the spec to reflect the framework constraint.
2. Add a redirect route `design-system.tsx` → `design_system` (requires Biome override for the hyphenated filename).
3. Exempt `design_system.tsx` from snake_case and rename to `design-system.tsx` (weakens the standard).

---

## Evidence Appendix

### Commands Run During This Validation

```
# Restore dirty routeTree.gen.ts (prior validation side-effect)
cd /Users/jose/projects/hay.worktrees/feat/issue-2-design-system
git checkout apps/web/src/routeTree.gen.ts
# → Updated 1 path from the index

# Confirm worktree clean
git status --short
# → (empty — clean)

# Lint
bun run lint
# → @hay/web:lint: Checked 22 files in 23ms. No fixes applied.
# → Tasks: 3 successful, 3 total. Exit 0.

# Typecheck
cd apps/web && bun run typecheck
# → $ tsc --noEmit
# → exit:0

# Confirm worktree still clean after commands
cd /Users/jose/projects/hay.worktrees/feat/issue-2-design-system
git status --short
# → (empty — clean)
```

**Note**: `bun run build` was not re-run during this validation pass. The prior validation confirmed exit 0 (`✓ 2233 modules transformed`). Re-running build would regenerate `routeTree.gen.ts` and dirty the worktree. The cached build result from commit `745d447` is used.

### Changed Files — Core vs Supporting

**Core implementation files** (all mapped to spec tasks):

| File | Commit | Task |
|---|---|---|
| `biome.json` | `3f1e157` | 1.1 |
| `apps/web/src/styles.css` | `64dd6ab` | 2.1–2.5 |
| `apps/web/src/routes/__root.tsx` | `64dd6ab` | 2.6 |
| `DESIGN.md` | `64dd6ab` | 2.8 |
| `apps/web/src/components/ui/button.tsx` | `870c2c9` | 3.2 |
| `apps/web/src/components/ui/avatar.tsx` | `870c2c9` | 3.3 |
| `apps/web/src/components/ui/badge.tsx` | `870c2c9` | 3.5 |
| `apps/web/src/components/ui/toggle.tsx` | `21c1cf9` | 4.2 |
| `apps/web/src/components/ui/icon.tsx` | `21c1cf9` | 4.3 |
| `apps/web/src/components/ui/index.ts` | `21c1cf9` | 4.4 |
| `apps/web/src/routes/dev/design_system.tsx` | `745d447` | 5.1–5.10 |
| `apps/web/src/routeTree.gen.ts` | `745d447` | 5.1 (auto-generated) |

No unmapped core changes. All modified files are accounted for by spec tasks.

### Gate Summary

| Gate | Verdict | Basis |
|---|---|---|
| A — No CRITICAL/HIGH blockers | **FAIL** | V-01 (button pressed-state proof non-functional) and V-02 (toggle click-driven proof non-functional) are HIGH. Non-functional proof artifacts are auto-blockers per validation rules. |
| B — No Unknown FR entries | PASS | Every FR has a `Verified` or `Failed` verdict. No `Unknown` entries. |
| C — Proof artifacts accessible/functional | **FAIL** | Two required interactive screenshots are substitutes: `task-03-button-pressed.png` (resting state, not pressed) and `task-04-toggle-checked.png` (static prop, not click-driven). Both are documented with root-cause evidence. |
| D — File integrity / no unmapped core changes | PASS | 12 core files, all mapped. `routeTree.gen.ts` auto-generated and excluded from lint. |
| E — Repository standards | PASS | `bun run lint` exit 0 (22 files, 0 errors). `tsc --noEmit` exit 0. Build exit 0 (prior run). All files snake_case. Conventional Commits throughout. |
| F — No secrets in proof artifacts | PASS | Grep scan of all proof markdown files: no passwords, API keys, tokens, credentials, or private keys. CSS token values (`oklch(...)`) are design tokens, not secrets. |

---

*Validation performed by Shuttle (Weave leaf worker) on 2026-05-26. Branch `feat/issue-2-design-system` (implementation HEAD `d1a7ca5`; validation commits follow). No build commands were run during this validation pass to preserve worktree cleanliness.*
