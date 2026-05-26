# 01-validation-design-system.md

**Spec**: `docs/specs/01-spec-design-system/01-spec-design-system.md`  
**Branch**: `feat/issue-2-design-system`  
**Validated**: 2026-05-26  
**Validator**: Shuttle (Weave leaf worker)

---

## Executive Summary

| | |
|---|---|
| **Overall Status** | ⚠️ CONDITIONAL PASS — implementation complete, two proof-exactness gaps remain |
| **Gate A (CRITICAL/HIGH blockers)** | PASS — no CRITICAL or HIGH issues found |
| **Gate B (Unknown FR coverage)** | PASS — all functional requirements have evidence-based verdicts |
| **Gate C (Proof artifacts accessible)** | PARTIAL PASS — 15 PNG screenshots + 5 proof markdown files exist; two proof gaps documented below |
| **Gate D (File integrity / unmapped core changes)** | PASS — all core files mapped to tasks; no unmapped core changes |
| **Gate E (Repository standards compliance)** | PASS — lint exits 0, typecheck exits 0, build exits 0 |
| **Gate F (No secrets in proof artifacts)** | PASS — no credentials, API keys, or secrets found in any proof file |

**Summary**: All five components are implemented and code-complete. All quality gates (lint, typecheck, build) pass. The implementation has two documented proof-exactness gaps that prevented parent tasks 3.0 and 4.0 from being marked complete by the implementer:

1. **Route path mismatch**: Spec requires `/dev/design-system` (hyphen); TanStack Router + Biome snake_case constraint produces `/dev/design_system` (underscore). The route exists and works — the path differs from the spec literal.
2. **Interactive proof gap**: Button pressed-state and Toggle click-driven state-change screenshots could not be captured due to (a) `solid-motionone` requiring trusted browser events for gesture detection, and (b) a pre-existing app-wide SSR hydration failure that prevents all click handlers from firing.

These are **MEDIUM** issues. The implementation is functionally correct per code review. A reviewer must decide whether the route path deviation and the interactive proof substitutions are acceptable to close the spec.

---

## Coverage Matrix

### Functional Requirements

#### Unit 1: Token System + Tailwind Wiring

| Requirement | Status | Evidence |
|---|---|---|
| All 11 color tokens as OKLCH CSS custom properties in `@theme` block | ✅ PASS | `styles.css` lines 3–15: all 11 tokens present (`--color-main`, `--color-ai`, `--color-background`, `--color-secondary-background`, `--color-border`, `--color-muted`, `--color-foreground`, `--color-feed`, `--color-paper`, `--color-danger`, `--color-inbox`) |
| Shadow tokens: `--shadow-x`, `--shadow-y`, `--shadow`, `--shadow-sm`, `--shadow-lg` | ✅ PASS | `styles.css` lines 17–21: all 5 shadow tokens present with correct values |
| Border tokens: `--border-w: 2px`, `--radius: 5px`, `--radius-lg: 8px` | ✅ PASS | `styles.css` lines 23–25 |
| Typography tokens: `--font-sans` (Archivo), `--font-mono` (JetBrains Mono), `--font-weight-base: 600`, `--font-weight-heading: 900` | ✅ PASS | `styles.css` lines 26–29 |
| Motion tokens: `--duration-fast: 60ms`, `--duration-base: 120ms`, `--ease-base: ease` | ✅ PASS | `styles.css` lines 30–32 |
| Dark mode token overrides via `@media (prefers-color-scheme: dark)` | ✅ PASS | `styles.css` lines 65–72: 4 tokens overridden (`--color-background`, `--color-secondary-background`, `--color-foreground`, `--color-muted`) |
| Archivo loaded via Google Fonts preconnect links in `__root.tsx` `head()` | ✅ PASS | `__root.tsx` lines 28–37: 3 link entries (preconnect googleapis, preconnect gstatic, stylesheet with Archivo weights 400/600/700/900/italic) |
| `DESIGN.md` fully populated with all token sections | ✅ PASS | `DESIGN.md` contains: Color Tokens (light + dark tables), Typography, Border & Shadow, Motion, Usage Notes, File Reference |
| Reduced-motion global rule in `styles.css` | ✅ PASS | `styles.css` lines 74–81: `@media (prefers-reduced-motion: reduce)` with `transition-duration: 0.01ms !important` and `animation-duration: 0.01ms !important` |

#### Unit 2: Base Components

**Button (`apps/web/src/components/ui/button.tsx`)**

| Requirement | Status | Evidence |
|---|---|---|
| `primary`, `ghost`, `default` variants | ✅ PASS | `button.tsx` lines 6–10: `variant_classes` map; `primary` = `bg-main text-main-foreground shadow-[var(--shadow)]`, `ghost` = `bg-transparent shadow-none`, `default` = `bg-secondary-background shadow-[var(--shadow)]` |
| `sm` size modifier (28px height, 10px padding, 12px font) | ✅ PASS | `button.tsx` line 14: `sm: "h-[28px] px-[10px] text-[12px]"` |
| Pressable feedback via `solid-motionone` `<Motion>` with `press` prop | ✅ PASS (code) / ⚠️ PROOF GAP | `button.tsx` lines 39–55: `<Motion.button>` with `press={{ transform: "translate(var(--shadow-x), var(--shadow-y))", "box-shadow": "none" }}`. Visual screenshot shows resting state only — `solid-motionone` gesture detection requires `event.isTrusted === true`, blocking headless capture |
| Hover lift: translate `(-1px, -1px)` and expand shadow | ✅ PASS (code) | `button.tsx` lines 48–54: `hover={{ transform: "translate(-1px, -1px)", "box-shadow": "5px 5px 0px oklch(0% 0 0)" }}` |
| `disabled` prop: `opacity: 0.5`, `cursor: not-allowed` | ✅ PASS | `button.tsx` line 64: `local.disabled && "opacity-50 cursor-not-allowed pointer-events-none"` |
| `onClick` prop + native button attributes via `JSX.ButtonHTMLAttributes` | ✅ PASS | `button.tsx` lines 23, 30–36: `Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "disabled">` + `splitProps` + `{...others}` spread |

**Avatar (`apps/web/src/components/ui/avatar.tsx`)**

| Requirement | Status | Evidence |
|---|---|---|
| Square element with `--radius` border and `--border-w` border | ✅ PASS | `avatar.tsx` lines 43–45: `border-[length:var(--border-w)] border-border rounded-[var(--radius)]` |
| First two characters of `name` as uppercase initials | ✅ PASS | `avatar.tsx` line 37: `const initials = () => props.name.slice(0, 2).toUpperCase()` |
| Background color derived by hashing `name` to palette index | ✅ PASS | `avatar.tsx` lines 5–12, 20–26: `hash_name()` sums char codes mod 6; palette = `[main, feed, paper, ai, inbox, danger]` |
| `sm` (28×28px), `default` (36×36px), `lg` (48×48px) size variants | ✅ PASS | `avatar.tsx` lines 14–18: `size_map` with correct pixel values |
| `rotate(-1deg)` neobrutalist detail | ✅ PASS | `avatar.tsx` line 51: `style={{ ..., transform: "rotate(-1deg)" }}` |

**Toggle (`apps/web/src/components/ui/toggle.tsx`)**

| Requirement | Status | Evidence |
|---|---|---|
| Accessible toggle with visually hidden `<input type="checkbox">` | ✅ PASS | `toggle.tsx` lines 22–27: `<input type="checkbox" class="sr-only" ...>` |
| `checked: boolean` and `onChange: (checked: boolean) => void` props (controlled) | ✅ PASS | `toggle.tsx` lines 6–8: `ToggleProps` type; `onChange` wired at lines 26, 34 |
| Thumb animation via `solid-motionone` `<Motion>` driven by `checked` | ✅ PASS (code) / ⚠️ PROOF GAP | `toggle.tsx` lines 39–43: `<Motion.div animate={{ x: props.checked ? "24px" : "2px" }} transition={{ duration: duration(), easing: "ease" }}>`. Click-driven screenshot blocked by pre-existing app-wide SSR hydration failure; static `checked={true}` prop used as substitute |
| Optional `label` prop rendered beside toggle | ✅ PASS | `toggle.tsx` lines 45–49: `<Show when={props.label}>` renders label text |
| `prefers-reduced-motion` disables animation | ✅ PASS | `toggle.tsx` lines 12–18: `onMount` reads `window.matchMedia("(prefers-reduced-motion: reduce)").matches`; sets `duration(0)` if true |

**Icon (`apps/web/src/components/ui/icon.tsx`)**

| Requirement | Status | Evidence |
|---|---|---|
| `icon` prop typed as `Component<LucideProps>` | ✅ PASS | `icon.tsx` line 6: `icon: Component<LucideProps>` |
| `size` (default 16) and `strokeWidth` (default 2) props | ✅ PASS | `icon.tsx` line 12: `mergeProps({ size: 16, strokeWidth: 2 }, raw_props)` |
| Forward `class` and other SVG attributes | ✅ PASS | `icon.tsx` lines 13, 16: `splitProps` + `{...rest}` spread |
| Render icon at specified size with consistent stroke width | ✅ PASS | `icon.tsx` line 16: `<local.icon size={local.size} strokeWidth={local.strokeWidth} {...rest} />` |

**Badge (`apps/web/src/components/ui/badge.tsx`)**

| Requirement | Status | Evidence |
|---|---|---|
| Inline pill with `--border-w` border | ✅ PASS | `badge.tsx` line 57: `border-[length:var(--border-w)] border-border min-h-[22px]` |
| `variant` prop: `default`, `main`, `feed`, `paper`, `ai`, `danger`, `inbox`, `muted` | ✅ PASS | `badge.tsx` lines 5–14: `variant_bg` map with all 8 variants |
| `square` prop: switches to `--radius` instead of pill | ✅ PASS | `badge.tsx` line 60: `local.square ? "rounded-[var(--radius)]" : "rounded-full"` |
| `priority` prop: P1→danger, P2→feed, P3→default | ✅ PASS | `badge.tsx` lines 16–19, 48–51: `priority_to_variant` map + `resolved_variant()` |
| `rotate(-1.2deg)` with `hover:scale-105` | ✅ PASS | `badge.tsx` lines 59, 64: `hover:scale-105` class + `style={{ transform: "rotate(-1.2deg)" }}` |

#### Unit 3: Design System Dev Route

| Requirement | Status | Evidence |
|---|---|---|
| Route registered at `/dev/design-system` via `design-system.tsx` | ⚠️ DEVIATION | Route exists at `/dev/design_system` (underscore). File is `design_system.tsx` (snake_case, required by Biome). TanStack Router derives path from filename — no override mechanism exists for file-based routes. `routeTree.gen.ts` line 14 confirms `/dev/design_system`. Spec says `/dev/design-system`. |
| Route renders all five components in all documented variants | ✅ PASS | `design_system.tsx` lines 136–215: Button (5 variants), Avatar (6 names), Badge (8 variants + priority + square), Toggle (signal-wired), Icon (5 icons at 4 sizes). Proof: `task-05-full-page.png` + agent-browser eval confirms 7 `<h2>` headings |
| Interactive demos: Toggle clickable, Button press feedback | ⚠️ PARTIAL | Toggle wired to `createSignal` (`design_system.tsx` lines 69, 221–228). Button has `<Motion.button>` press/hover props. Click-driven interaction blocked by pre-existing SSR hydration failure (see Issue #2 below) |
| Color token swatches for all color tokens | ✅ PASS | `design_system.tsx` lines 14–47, 86–109: 12 swatches with names and OKLCH/hex values. Proof: `task-05-color-tokens.png` |
| Typography specimen: Archivo at weights 400, 600, 700, 900 | ✅ PASS | `design_system.tsx` lines 115–130: 4 weight lines + mono specimen. Proof: `task-05-typography.png` |
| `prefers-reduced-motion` note visible in UI | ✅ PASS | `design_system.tsx` lines 259–276: info box with `prefers-reduced-motion` code element. Proof: `task-05-reduced-motion.png` |

---

### Repository Standards

| Standard | Status | Evidence |
|---|---|---|
| SolidJS primitives (`Component<Props>`, `JSX.Element`, `class`, `<For>`, `<Show>`, `createSignal`) | ✅ PASS | All component files use SolidJS imports; no React imports found |
| Tailwind v4 CSS-first — tokens in `@theme {}`, no `tailwind.config.js` | ✅ PASS | `styles.css` uses `@import "tailwindcss"` + `@theme {}`. No `tailwind.config.js` exists |
| `solid-motionone` only — `import { Motion } from "solid-motionone"` | ✅ PASS | `button.tsx` line 3, `toggle.tsx` line 3: both import from `"solid-motionone"` |
| `lucide-solid` icons | ✅ PASS | `icon.tsx` line 3: `import type { LucideProps } from "lucide-solid"`. `design_system.tsx` line 4: `import { Bell, Mail, Search, Star, Zap } from "lucide-solid"` |
| snake_case filenames enforced by Biome `useFilenamingConvention` | ✅ PASS | `biome.json` lines 28–34: rule configured at `"error"` level with `filenameCases: ["snake_case"]`. All new files: `button.tsx`, `avatar.tsx`, `badge.tsx`, `toggle.tsx`, `icon.tsx`, `index.ts`, `design_system.tsx` — all snake_case |
| Biome formatter — all files pass `biome check` | ✅ PASS | `bun run lint` from repo root: `Checked 22 files in 23ms. No fixes applied.` Exit 0 |
| Conventional Commits | ✅ PASS | Commits: `feat(tooling):`, `feat(tokens):`, `feat(ui):`, `docs(spec):`, `fix(routes):`, `fix(tooling):` — all follow Conventional Commits format |
| Bun package manager | ✅ PASS | All installs use `bun add`; no npm/yarn usage |
| Solid UI scaffold workflow | ✅ PASS | `ui.config.json` exists with `aliases.components: "src/components/ui"`. `src/lib/utils.ts` with `cn` helper exists |
| TypeScript — `tsc --noEmit` exits 0 | ✅ PASS | `bun run typecheck` from `apps/web/`: exits 0, no output |
| Build — `bun run build` exits 0 | ✅ PASS | `vite build` client + SSR: `✓ 2233 modules transformed`, `✓ built in 2.37s`. Exit 0 |
| Component barrel export | ✅ PASS | `index.ts` re-exports all 5 components: `Button`, `Avatar`, `Badge`, `Toggle`, `Icon` |

---

### Proof Artifacts

| Artifact | File | Status | Notes |
|---|---|---|---|
| `--color-main` on `:root` (token wiring) | `screenshot-01-color-main-root.png` | ✅ EXISTS | 8,068 bytes; shows injected panel with resolved token values |
| `fonts.googleapis.com` network request | `screenshot-02-fonts-network.png` | ✅ EXISTS | HTTP 200 GET for Archivo confirmed |
| Dark mode token override | `screenshot-03-dark-mode-override.png` | ✅ EXISTS | `prefersDark=true`, 4 tokens show dark values |
| Button variants (primary, ghost, default, sm, disabled) | `task-03-button-variants.png` | ✅ EXISTS | All 5 states visible |
| Button pressed state | `task-03-button-pressed.png` | ⚠️ SUBSTITUTE | Shows resting state; press animation not capturable in headless (trusted event required). Code-level verification provided |
| Avatar palette (hash-based colors) | `task-03-avatar-palette.png` | ✅ EXISTS | 8 names, distinct colors, hash table in proof doc |
| Badge variants + priority + square | `task-03-badge-variants.png` | ✅ EXISTS | All 8 variants, P1/P2/P3, square prop |
| Toggle unchecked state | `task-04-toggle-unchecked.png` | ✅ EXISTS | Track `bg-secondary-background`, thumb at `x: 2px` |
| Toggle checked state (click-driven) | `task-04-toggle-checked.png` | ⚠️ SUBSTITUTE | Shows static `checked={true}` prop, not click-driven transition. Pre-existing SSR hydration failure blocks all click events app-wide |
| Hydration bug evidence | `task-04-hydration-bug-evidence.png` | ✅ EXISTS | Shows pre-existing `/dev/tanstack_libraries` page with same failure |
| Icon component (4+ icons at varying sizes) | `task-04-icons.png` | ✅ EXISTS | Mail/Star/Bell/Search at 16/20/24/32px |
| `/dev/design_system` full page render | `task-05-full-page.png` | ✅ EXISTS | All 7 sections visible; agent-browser confirms 7 `<h2>` headings |
| Color token swatches | `task-05-color-tokens.png` | ✅ EXISTS | 12 swatches with names and values |
| Typography specimen | `task-05-typography.png` | ✅ EXISTS | Archivo 400/600/700/900 + JetBrains Mono |
| Reduced motion note | `task-05-reduced-motion.png` | ✅ EXISTS | Info box with `prefers-reduced-motion` code element |
| `DESIGN.md` file review | (file review) | ✅ PASS | All 15 sections present per task-02-proofs.md table |
| `bun run lint` exit 0 | (CLI) | ✅ PASS | Verified live: `Checked 22 files in 23ms. No fixes applied.` |
| `bun run typecheck` exit 0 | (CLI) | ✅ PASS | Verified live: `tsc --noEmit` exits 0 |
| `bun run build` exit 0 | (CLI) | ✅ PASS | Verified live: `✓ 2233 modules transformed`, exit 0 |

---

## Validation Issues

### Issue #1 — Route Path Deviation (MEDIUM)

**Gate affected**: Gate B (FR coverage), Gate C (proof artifacts)  
**Severity**: MEDIUM  
**Status**: Documented, not blocking implementation

**Description**: The spec (Unit 3 FR, proof artifacts for Units 2 and 3) consistently references `/dev/design-system` (hyphen). The committed route is `/dev/design_system` (underscore).

**Root cause**: TanStack Router's file-based routing derives the URL path directly from the filename. The Biome `useFilenamingConvention` rule (added in Task 1.0 per spec) enforces snake_case filenames. The file must be `design_system.tsx` → path becomes `/dev/design_system`. There is no `createFileRoute` override mechanism for file-based routes — the argument to `createFileRoute` must match the generated path exactly or the build produces a type error.

**Evidence**:
- `routeTree.gen.ts` line 14: `import { Route as DevDesign_systemRouteImport } from './routes/dev/design_system'`
- `routeTree.gen.ts` line 26–30: route registered at `id: '/dev/design_system'`, `path: '/dev/design_system'`
- `design_system.tsx` line 6: `createFileRoute("/dev/design_system")` — underscore required to match generated path
- Learnings file documents this as a framework constraint

**Impact**: The route is accessible and functional at `/dev/design_system`. All proof screenshots use the correct URL. The spec's `/dev/design-system` URL does not exist and would 404. This is a spec-vs-implementation path discrepancy, not a functional defect.

**Resolution options for reviewer**:
1. Accept `/dev/design_system` as the canonical path (update spec to reflect framework constraint)
2. Add a redirect from `/dev/design-system` to `/dev/design_system` (requires additional route file)
3. Exempt the design system route from snake_case enforcement via Biome override (weakens the standard)

---

### Issue #2 — Interactive Proof Substitutions (MEDIUM)

**Gate affected**: Gate C (proof artifacts)  
**Severity**: MEDIUM  
**Status**: Documented, not blocking implementation

**Description**: Two spec proof artifacts require visual evidence of interactive state changes that could not be captured:

1. **Button pressed state** (Unit 2, Unit 3 proof): Spec requires a screenshot showing the button translated and shadow collapsed. `solid-motionone`'s gesture detection (`press`, `hover` props) requires `event.isTrusted === true`. Headless Chrome CDP events and JavaScript-dispatched events do not satisfy this check. The screenshot shows the resting state; the animation props are verified by code review.

2. **Toggle click-driven state change** (Unit 2, Unit 3 proof): Spec requires a screenshot of the Toggle after a click showing the thumb in the checked position. A pre-existing app-wide SSR hydration failure prevents all click handlers from firing on any page. Evidence:
   - `document.querySelectorAll('[data-hk]').length` → 23 (hydration markers not removed)
   - Zero elements have `$$click` delegated handler attached
   - Same failure confirmed on pre-existing `/dev/tanstack_libraries` page (committed before Task 4)
   - Root cause: `hydrate()` from `solid-js/web` throws `TypeError: Cannot read properties of undefined (reading 'done')` in `client.tsx`'s `hydrateStart().then(...)` chain with no `.catch()` handler

**Substitutes provided**:
- Button: code-level inspection of `<Motion.button press={...} hover={...}>` props in `button.tsx`
- Toggle: static `checked={true}` prop on a second Toggle instance showing the checked visual state

**Impact**: The component implementations are correct per code review. The interactive behavior will work once the SSR hydration bug is fixed. The hydration bug is pre-existing (predates this spec's work) and is out of scope for Spec 01.

**Resolution options for reviewer**:
1. Accept code-level verification as sufficient for press/animation proofs (close spec as-is)
2. Fix the SSR hydration bug first, then re-capture interactive proofs (blocks spec closure)
3. Add a separate tracking issue for the hydration bug; accept current proofs for Spec 01

---

### Issue #3 — Parent Tasks 3.0 and 4.0 Not Marked Complete (LOW)

**Gate affected**: Gate A (blocker check)  
**Severity**: LOW (informational)  
**Status**: Documented

**Description**: The task file (`01-tasks-design-system.md`) shows parent tasks 3.0 and 4.0 as `[ ]` (incomplete) while all their sub-tasks are marked `[x]`. The implementer left these open because the proof exactness criteria were not fully met (Issues #1 and #2 above). Task 5.0 is marked `[x]` complete.

**Evidence**: `grep "^### \[" 01-tasks-design-system.md` output:
```
### [x] 1.0 Bootstrap Tooling
### [x] 2.0 Design Tokens
### [ ] 3.0 Base Components: Button, Avatar, Badge
### [ ] 4.0 Base Components: Toggle + Icon
### [x] 5.0 Dev Route
```

**Impact**: The component code for tasks 3.0 and 4.0 is fully committed and functional. The `[ ]` status reflects proof-exactness discipline, not missing implementation. This is consistent with the task context provided.

---

## Evidence Appendix

### A. Commands Run During Validation

```
# Lint (from worktree root)
cd /Users/jose/projects/hay.worktrees/feat/issue-2-design-system
bun run lint
→ @hay/web:lint: Checked 22 files in 23ms. No fixes applied.
→ Tasks: 3 successful, 3 total. Exit 0.

# Typecheck (from apps/web)
cd apps/web && bun run typecheck
→ $ tsc --noEmit
→ (exit 0, no output)

# Build (from apps/web)
cd apps/web && bun run build
→ vite v7.3.3 building client environment for production...
→ ✓ 2233 modules transformed.
→ dist/client/assets/design_system-DP5ffM62.js  43.49 kB │ gzip: 14.03 kB
→ ✓ built in 2.37s
→ vite v7.3.3 building ssr environment for production...
→ ✓ 2202 modules transformed. ✓ built in 1.75s
→ Exit 0.

# Git log
git log --oneline -10
→ d1a7ca5 docs(spec): mark task 5.0 complete
→ 745d447 feat(ui): add /dev/design-system showcase route
→ 21c1cf9 feat(ui): add Toggle and Icon components with barrel export
→ 870c2c9 feat(ui): add Button, Avatar, and Badge components
→ 4534383 docs(spec): mark task 2.0 complete
→ 2d247de fix(routes): correct tanstack_libraries route path and clean worktree
→ 7e9b28f docs(proofs): add screenshot evidence and mark task 2.10 complete
→ 64dd6ab feat(tokens): wire OKLCH design tokens into Tailwind v4 and populate DESIGN.md
→ d135cb8 docs(spec): mark task 1.0 complete
→ c498fec fix(tooling): verify solidui-cli add flow and resolve componentDir gap

# Proof file count
ls docs/specs/01-spec-design-system/01-proofs/*.png | wc -l
→ 15

# Secret scan (proof files)
grep -rn "password|secret|api_key|token|credential|private_key|AWS_|GITHUB_TOKEN" 01-proofs/
→ No matches (only design token values like "oklch(66.34%...)" — not secrets)
```

### B. Changed Files — Core vs Supporting

**Core implementation files** (directly implement spec requirements):

| File | Commit | Classification | Status |
|---|---|---|---|
| `biome.json` | `3f1e157` | Core — snake_case rule | ✅ Correct |
| `apps/web/src/styles.css` | `64dd6ab` | Core — all design tokens | ✅ Correct |
| `apps/web/src/routes/__root.tsx` | `64dd6ab` | Core — Google Fonts links | ✅ Correct |
| `DESIGN.md` | `64dd6ab` | Core — token documentation | ✅ Correct |
| `apps/web/src/components/ui/button.tsx` | `870c2c9` | Core — Button component | ✅ Correct |
| `apps/web/src/components/ui/avatar.tsx` | `870c2c9` | Core — Avatar component | ✅ Correct |
| `apps/web/src/components/ui/badge.tsx` | `870c2c9` | Core — Badge component | ✅ Correct |
| `apps/web/src/components/ui/toggle.tsx` | `21c1cf9` | Core — Toggle component | ✅ Correct |
| `apps/web/src/components/ui/icon.tsx` | `21c1cf9` | Core — Icon component | ✅ Correct |
| `apps/web/src/components/ui/index.ts` | `21c1cf9` | Core — barrel export | ✅ Correct |
| `apps/web/src/routes/dev/design_system.tsx` | `745d447` | Core — showcase route | ✅ Correct (path deviation documented) |
| `apps/web/src/routeTree.gen.ts` | `745d447` | Core (auto-generated) — route tree | ✅ Correct |

**Supporting files** (tooling, proofs, docs):

| File | Commit | Classification |
|---|---|---|
| `apps/web/ui.config.json` | `3f1e157` | Supporting — Solid UI config |
| `apps/web/src/lib/utils.ts` | `3f1e157` | Supporting — `cn` helper |
| `docs/specs/01-spec-design-system/01-proofs/01-task-0[1-5]-proofs.md` | various | Supporting — proof documentation |
| `docs/specs/01-spec-design-system/01-proofs/*.png` (15 files) | various | Supporting — screenshot evidence |
| `.weave/learnings/01-tasks-design-system.md` | `21c1cf9`, `745d447`, `d1a7ca5` | Supporting — learnings |
| `docs/specs/01-spec-design-system/01-tasks-design-system.md` | various | Supporting — task tracking |

**No unmapped core changes detected.** All modified files are accounted for by spec tasks.

### C. Gate Evaluation Detail

| Gate | Verdict | Rationale |
|---|---|---|
| **Gate A** — No CRITICAL/HIGH issues | ✅ PASS | Issues #1 and #2 are MEDIUM. No functional defects, no security issues, no data loss risk. All components render correctly. |
| **Gate B** — No Unknown FR entries | ✅ PASS | Every functional requirement has an evidence-based PASS, PARTIAL, or DEVIATION verdict. No "Unknown" entries. |
| **Gate C** — Proof artifacts accessible | ✅ PARTIAL PASS | 15 PNG files exist and are non-zero bytes. 5 proof markdown files exist with detailed evidence. Two artifacts are substitutes (button pressed, toggle click-driven) — documented with rationale. Proof files contain no broken image references for existing screenshots. |
| **Gate D** — File integrity / unmapped core changes | ✅ PASS | All 12 core files map to spec tasks. No core files modified without a corresponding task. `routeTree.gen.ts` is auto-generated and excluded from lint per `biome.json`. |
| **Gate E** — Repository standards compliance | ✅ PASS | `bun run lint` exit 0 (22 files, 0 errors). `bun run typecheck` exit 0. `bun run build` exit 0. All new files snake_case. Conventional Commits used throughout. |
| **Gate F** — No secrets in proof artifacts | ✅ PASS | Grep scan of all proof markdown files found no passwords, API keys, tokens, credentials, or private keys. Token values like `oklch(66.34%...)` are design tokens, not secrets. |

### D. PR Reference

PR: `https://github.com/josevelaz/atlas/pull/20`  
Remote: `git@github.com:josevelaz/hay.git` (GitHub redirects to renamed repo `josevelaz/atlas`)  
Base: `main` | Head: `feat/issue-2-design-system`

---

*Validation performed by Shuttle (Weave leaf worker) on 2026-05-26. Evidence is based on direct file inspection, live command execution, and proof artifact review on branch `feat/issue-2-design-system` at commit `d1a7ca5`.*
