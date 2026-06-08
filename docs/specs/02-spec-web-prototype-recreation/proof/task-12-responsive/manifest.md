# Task 12 — Full Responsive Parity Across All Atlas Routes

**Task:** Cross-route responsive hardening pass after all major screens and
overlays exist. Finalize desktop three-column behavior, tablet collapse, mobile
navigation access, list/detail stacking, overlay sizing, scroll containment,
focus visibility, reduced-motion behavior, and resize safety — without changing
the desktop prototype geometry.
**Date:** 2026-06-08
**Surface touched:** shared layout / style hardening only (`apps/web/src/styles.css`).

---

## Summary

The Atlas app shell already shipped a substantial responsive layer (Tasks 4–11):
a fixed `240px 380px 1fr` desktop grid that narrows to `200px 320px 1fr` at
`≤1100px` and collapses to a single stacked column at `≤860px`, plus
overlay/onboarding/screener/settings small-screen adaptations. This task audited
that layer across the **full** route + breakpoint matrix and **fixed one genuine
tablet-landscape regression** found during the audit:

> **Thread toolbar clipped at tablet landscape (1024×768).** In the narrowed
> `1fr` pane, the thread toolbar packs two button groups (Archive / Trash /
> Set aside / Reply later · Prev / Next) onto a single `space-between` row that
> measured **544px wide inside a 504px pane**. Because `.atlas-pane` clips
> overflow, the **Prev / Next group was cut off-screen** (`Next` button right
> edge at x=**1064**, pane ends at x=**1024**) and became **unreachable**.

**Fix:** let `.atlas-thread-toolbar` wrap inside the `@media (max-width: 1100px)`
block (`flex-wrap: wrap; row-gap: 8px`). Tablet/narrow panes now wrap the second
button group onto a new in-bounds row; the desktop grid (≥1101px) is unchanged
and the toolbar stays a single row there. This is the only divergence found and
fixed — every other surface already passed.

---

## Files changed

| File | Change |
|---|---|
| `apps/web/src/styles.css` | **+10 lines.** Added `.atlas-thread-toolbar { flex-wrap: wrap; row-gap: 8px }` inside the existing `@media (max-width: 1100px)` block so the inbox/feed/paper thread toolbar wraps (keeping Prev/Next reachable) in the narrowed tablet pane, while the desktop ≥1101px single-row layout is preserved. |

### Files reviewed and confirmed sufficient (no change required)

`app_shell.tsx`, `top_bar.tsx`, `sidebar_nav.tsx`, `mail_workspace.tsx`,
`thread_view.tsx`, `screener_screen.tsx`, `tasks_screen.tsx`,
`settings_screen.tsx`, `compose_dialog.tsx`, `assistant_dialog.tsx` — all were
listed in the task; each already composes shared `.atlas-*` layout classes whose
responsive behavior is centralized in `styles.css`. No per-component responsive
markup was needed; the existing CSS layer plus the one toolbar-wrap fix achieves
full parity, so these components were reused unchanged (single source of truth).

> The existing responsive CSS layer that this task validates:
> - `@media (max-width: 1100px)` — narrows the 3 columns to `200px 320px 1fr`
>   (+ the new toolbar wrap).
> - `@media (max-width: 860px)` — collapses to a single `minmax(0,1fr)` stacked
>   column (sidebar → list → pane), each region scrolls in a tall page; sidebar
>   nav reflows to a wrapping row so all folders + the AI usage card stay
>   reachable; Tasks & Dates grid stacks to one column; `overflow-x: hidden`
>   guards against sub-pixel overflow.
> - `@media (max-width: 560px)` — onboarding card shrinks padding/min-height and
>   stacks its connect grid; screener column constrains to the viewport and
>   stacks the Accept / Reject action bar; settings rows drop the trailing
>   control to its own full-width row so every toggle/button stays visible.
> - `@media (prefers-reduced-motion: reduce)` — collapses all transition/
>   animation durations to ~0.

---

## Responsive matrix — measured (agent-browser / Chromium via CDP)

Breakpoints: **1440×900** (desktop), **1024×768** (tablet landscape),
**768×1024** (tablet portrait), **390×844** (mobile).
Surfaces: `/atlas/onboarding`, `/atlas/inbox`, `/atlas/screener`, `/atlas/feed`,
`/atlas/paper-trail`, `/atlas/tasks`, `/atlas/settings`, compose
(`/atlas/inbox?compose=new`), assistant (`/atlas/inbox?assistant=1`).

### No horizontal body overflow (`documentElement.scrollWidth > innerWidth`)

| Surface | 1440×900 | 1024×768 | 768×1024 | 390×844 |
|---|---|---|---|---|
| onboarding | no | no | no | no |
| inbox | no | no | no | no |
| screener | no | no | no | no |
| feed | no | no | no | no |
| paper-trail | no | no | no | no |
| tasks | no | no | no | no |
| settings | no | no | no | no |
| compose | no | no | no | no |
| assistant | no | no | no | no |

**36/36 cells: no horizontal overflow.**

### Thread toolbar reachability (the fixed regression)

| Width | Before fix | After fix |
|---|---|---|
| 1440×900 | single row, in-bounds, not wrapped | **single row, not wrapped** (desktop geometry preserved) |
| 1024×768 | overflow 544>504; **Next right=1064 > pane right=1024 (clipped, unreachable)** | **wrapped; no overflow; Next in-pane** ✅ |
| 768×1024 | (stacked layout) single row fits | single row fits, in-bounds |

Verified for inbox **and** feed (`?sel=f1`) — both share the `ThreadView` toolbar.

### Overlay sizing / control reachability at mobile (390×844)

| Overlay | Card height | Fits viewport (h=844) | Primary control in viewport |
|---|---|---|---|
| Compose | 542px (top 151 → bottom 693) | yes | **Send** in viewport (bottom 679) |
| Assistant | 692px (top 76 → bottom 768) | yes | ask **input** in viewport |

Overlay bodies are independently scrollable (`overflow-y: auto`) so long
content (compose body, assistant transcript) never pushes footer controls
off-screen.

### Mobile navigation access (390×844, ≤860px stacked layout)

- Sidebar reflows to a wrapping row (`flex-direction: row; flex-wrap: wrap`),
  so all Mail folders (Screener / Inbox / Feed / Paper Trail), Assist tools
  (Tasks & Dates / Settings), the AI usage card, and Replay onboarding remain
  on-canvas and reachable.
- List → pane stack vertically; each region scrolls within the tall page.

### Screener action bar reachability

| Width | Layout | Accept/Reject text clipped |
|---|---|---|
| 768×1024 | 2-col (334px each) | no |
| 390×844 | stacked full-width (≤560px rule) | no |

### Reduced-motion behavior

| `prefers-reduced-motion` | `.atlas-btn` `transition-duration` |
|---|---|
| reduce (emulated) | `0.00001s` (collapsed) — matches confirms `reduce` matched |
| default | `0.06s` |

### Focus visibility

`.atlas-btn:focus-visible` resolves a **3px ink outline** (`outline-width: 3px`
under the design ring token); all interactive primitives (buttons, nav items,
inputs, mail rows, screener actions) carry `:focus-visible` outlines in
`styles.css`.

### Resize safety

Rapid viewport cycling across all four breakpoints over inbox, screener, tasks,
settings, compose, and assistant produced **no new runtime errors** — only the
documented, pre-existing app-wide hydration warning
`template2 is not a function` (out of scope; Tasks 4–11).

---

## Screenshots

Full 9-surface × 4-breakpoint matrix (36 PNGs), named `<surface>-<WxH>.png`:

| Surface | 1440×900 | 1024×768 | 768×1024 | 390×844 |
|---|---|---|---|---|
| onboarding | `onboarding-1440x900.png` | `onboarding-1024x768.png` | `onboarding-768x1024.png` | `onboarding-390x844.png` |
| inbox | `inbox-1440x900.png` | `inbox-1024x768.png` | `inbox-768x1024.png` | `inbox-390x844.png` |
| screener | `screener-1440x900.png` | `screener-1024x768.png` | `screener-768x1024.png` | `screener-390x844.png` |
| feed | `feed-1440x900.png` | `feed-1024x768.png` | `feed-768x1024.png` | `feed-390x844.png` |
| paper-trail | `paper-trail-1440x900.png` | `paper-trail-1024x768.png` | `paper-trail-768x1024.png` | `paper-trail-390x844.png` |
| tasks | `tasks-1440x900.png` | `tasks-1024x768.png` | `tasks-768x1024.png` | `tasks-390x844.png` |
| settings | `settings-1440x900.png` | `settings-1024x768.png` | `settings-768x1024.png` | `settings-390x844.png` |
| compose | `compose-1440x900.png` | `compose-1024x768.png` | `compose-768x1024.png` | `compose-390x844.png` |
| assistant | `assistant-1440x900.png` | `assistant-1024x768.png` | `assistant-768x1024.png` | `assistant-390x844.png` |

**Proof URLs used for the seeded overlay states** (SSR-renderable; hydration is
broken app-wide so live clicks are not relied on for proof):

- Compose: `http://localhost:3001/atlas/inbox?compose=new` (blank "New message").
- Assistant: `http://localhost:3001/atlas/inbox?assistant=1` (initial state —
  intro bubble + the four example prompt chips).

(`?compose=reply`, `?ask=<query>`, and `?d=` decision tokens remain available
and are unaffected by this CSS-only change; the shared `?d=` / `?compose=` /
`?assistant=` / `?ask=` plumbing was verified intact by the no-regression route
checks below.)

---

## Validation

| Check | Result |
|---|---|
| `bun run --cwd apps/web typecheck` | ✅ pass (`tsc --noEmit`, exit 0) |
| `bun run --cwd apps/web lint` | ✅ clean (`biome lint`, 65 files, no fixes) |
| `bun run --cwd apps/web build` | ✅ pass (client + server chunks, prerender OK, built in ~3.2s) |
| No horizontal overflow (36/36 cells) | ✅ all `false` |
| Thread-toolbar Prev/Next reachable at 1024×768 | ✅ fixed (was clipped) |
| Desktop geometry unchanged at 1440 | ✅ toolbar single-row, 3-col grid intact |
| Overlay controls reachable at 390×844 | ✅ Send / ask-input in viewport |
| Reduced-motion collapses transitions | ✅ `0.00001s` under emulated `reduce` |
| Resize safety (rapid breakpoint cycling) | ✅ no new runtime errors |
| `/` unchanged | ✅ 200, no `.atlas-*` leak |
| `/dev/*` unaffected | ✅ CSS change scoped to `.atlas-thread-toolbar` (dev routes use no `.atlas-*` classes) |
| `?d=` / `?compose=` / `?assistant=` / `?ask=` plumbing | ✅ intact (all `/atlas/*` proof URLs 200) |
| `routeTree.gen.ts` untouched | ✅ CSS-only change |

---

## Acceptance criteria

- [x] **Screenshot matrix covers all 9 surfaces at 1440×900, 1024×768, 768×1024,
      390×844** — 36 PNGs captured (table above).
- [x] **Every required control remains reachable** — verified the previously
      clipped thread-toolbar Prev/Next is now in-bounds at tablet landscape;
      compose Send and assistant ask-input are in viewport at mobile; sidebar
      nav reflows so all folders/tools stay reachable; screener Accept/Reject
      stack at mobile; settings controls drop to their own row.
- [x] **No horizontal body overflow on mobile** — 390×844 shows
      `scrollWidth == innerWidth` for every surface (and at all four
      breakpoints: 36/36 no-overflow).
- [x] **Resizing between breakpoints produces no runtime errors** — rapid
      cycling across all breakpoints over 6 surfaces logged only the
      pre-existing hydration warning.
- [x] **Any desktop divergence introduced by responsive changes is fixed before
      commit** — the toolbar-wrap rule is gated behind `@media (max-width:1100px)`
      so the ≥1101px desktop layout is byte-for-byte unchanged (verified single-row,
      3-col, no overflow at 1440×900).
- [x] **`/` and `/dev/*` unchanged; CSS change fully scoped to `.atlas-*`.**
- [x] **typecheck / lint / build all pass.**
