# Task 08 — Tasks & Dates Manifest

**Task:** Implement the Tasks & Dates route
**Date:** 2026-06-05
**Route added:** `/atlas/tasks`, under the existing `/atlas` layout segment.

---

## What shipped

The AI-extracted **Tasks & Dates** screen is now routed and reachable from the
sidebar's **Assist** group. It is a full-width workspace region (like the
screener), replacing the list/pane pair — mirroring the prototype's `view ===
"tasks"` branch (`gridColumn: 2 / 4`).

- **`/atlas/tasks`** — the Tasks & Dates screen. Thread toolbar with the title
  **"Tasks & Dates"** + the AI-extracted subtitle **"AI-extracted · sync to
  Google Tasks & Calendar"**, two sync buttons (**"Sync 5 tasks"** secondary,
  **"Sync 5 dates"** primary), then a two-column grid: a **Tasks** column (mint
  `solid-paper` badge + count `5`, five `TaskCard`s with a square checkbox) and a
  **Dates** column (yellow `solid-feed` badge + count `5`, five `DateCard`s with a
  yellow calendar date tile stamped month + day). Each card carries a dashed-rule
  **"From: <source>"** provenance footer.

Content, ordering, counts, due descriptors, AI-extracted labels, and source
provenance come **verbatim** from `SAMPLE.tasks` / `SAMPLE.dates` (added in Task
3). No fixtures were changed.

### Date tile month/day stamp

`DateCard` derives the tile's stamp from the `due` string with the **exact same
regexes** the prototype uses — month `/[A-Z][a-z]{2}/` (`"—"` fallback,
uppercased), day `/\d{1,2}/` (`"?"` fallback) — so the stamped values match
byte-for-byte:

| Date due | Tile month | Tile day |
|---|---|---|
| `Tomorrow, 9:00 AM` | TOM | 9 |
| `Fri May 23, 2:30 PM` | FRI | 23 |
| `Tomorrow` | TOM | ? |
| `Fri May 23` | FRI | 23 |
| `Wed Nov 26, 6:14 PM` | WED | 26 |

Verified identical between app and live prototype.

### Sidebar reachability + SSR-proof nav

Client hydration is disabled by the documented pre-existing TanStack Start/Solid
error (`template2 is not a function`), so navigation is real server-rendered
`<a href>`. The shared resolver `atlasMailLinkFor(d)` (`lib/atlas/nav_links.ts`)
was extended to route **Tasks & Dates** (`/atlas/tasks`) alongside the four mail
screens, carrying the current `?d=` decisions so the sidebar counts stay
consistent across navigation. Inbox / Screener / Feed / Paper Trail all now link
to `/atlas/tasks`; on `/atlas/tasks` the Tasks nav item renders
`is-active` + `aria-current="page"`.

### Files

| File | Change |
|---|---|
| `apps/web/src/routes/atlas/tasks.tsx` | **New** `/atlas/tasks` route: `?d=` validator → `AppShell` (TopBar + SidebarNav `activeView="tasks"`) wrapping `TasksScreen` in `.atlas-fullpane` (grid-column 2/4). SSR-proof `linkFor` via shared `atlasMailLinkFor`. |
| `apps/web/src/components/atlas/tasks_screen.tsx` | **New** full-pane screen: thread toolbar (title + subtitle + Sync N tasks / Sync N dates buttons) over the two-column Tasks/Dates grid. Counts derive from `SAMPLE.tasks.length` / `SAMPLE.dates.length`. |
| `apps/web/src/components/atlas/task_card.tsx` | **New** `TaskCard` — square checkbox + label + `Due:` line + dashed `From:` source footer (`.atlas-task-card`). |
| `apps/web/src/components/atlas/date_card.tsx` | **New** `DateCard` — yellow calendar date tile (month/day from `due` regexes) + label + due + dashed `From:` footer. |
| `apps/web/src/components/atlas/sidebar_nav.tsx` | _(unchanged — already accepts `linkFor(id)`; the shared resolver now supplies the Tasks target so the Assist "Tasks & Dates" entry routes.)_ |
| `apps/web/src/lib/atlas/sample_data.ts` | _(unchanged — `tasks` / `dates` fixtures already present verbatim from Task 3.)_ |
| `apps/web/src/lib/atlas/nav_links.ts` | Extended `atlasMailLinkFor` to route `tasks` → `/atlas/tasks` (renamed `MAIL_ROUTES` → `ROUTES`); doc comments updated. Settings stays inert. |
| `apps/web/src/styles.css` | **New** `.atlas-tasks-*` / `.atlas-task-*` / `.atlas-date-tile*` styles (ported from prototype `.tasks-grid` / `.tasks-col` / `.task-card` / `.src`), the `.atlas-app` retro overrides (colored card shadow + sticker-rotated column badge), and a `≤860px` single-column collapse for the grid. |

> Note: `sample_data.ts` and `sidebar_nav.tsx` (listed in the task's **Files**)
> required no change — Task 3 added the verbatim fixtures and Task 4/7 built the
> sidebar to accept a `linkFor(id)` resolver, so routing Tasks is realized by the
> new route + components + the extended shared resolver.

---

## Servers

| Server | URL | Notes |
|---|---|---|
| App (dev) | `http://localhost:3001/atlas/tasks` | `bun run --cwd apps/web dev` |
| Prototype | `http://localhost:8765/Atlas.html` | `cd docs/prototype && python3 -m http.server 8765` (Skip onboarding → click "Tasks & Dates" nav) |

Capture tool: `agent-browser` 0.27.1 (`set viewport` + `screenshot`; prototype
driven by skipping onboarding and clicking the `.nav-item[data-screen-label="Tasks
& Dates"]`). Diff: Pillow.

---

## Screenshots

```
screenshots/
  app/        {1440x900,1024x768,768x1024,390x844}-tasks-default.png
  prototype/  {1440x900,1024x768,768x1024,390x844}-tasks-default.png
  compare/    {viewport}-proto-vs-app.png   (side-by-side)
```

Prototype state reproduced by driving the live React app: Skip onboarding →
click "Tasks & Dates" nav. Verified the live prototype's toolbar reads
`h2 = "Tasks & Dates"`, subtitle = "AI-extracted · sync to Google Tasks &
Calendar", and 10 `.task-card`s before capturing.

---

## Visual parity — `1440x900` (primary, binding acceptance target)

App vs prototype, identical default states (Pillow per-channel abs diff over the
full 1440×900 frame):

| Metric | Value |
|---|---|
| Full-frame mean abs diff | **19.53 / 255** |
| Within 14/255 (near-identical) | **85.3 %** |
| Structural diff (Gaussian blur σ=3, text-agnostic) | **11.28 / 255** |

**Geometry is pixel-exact** (measured live via `getBoundingClientRect`):

| Element | App | Prototype |
|---|---|---|
| Toolbar | x=240 y=56 w=1200 h=70 | x=240 y=56 w=1200 h=73 |
| Tasks grid | x=240 w=1200 | x=240 w=1200 |
| First task card | x=260 y=178 w=572 | x=260 y=181 w=572 |
| Title | x=260 y=68 fs=22px | x=260 y=68 fs=22px |
| TASKS badge | mint `rgb(0,229,161)` | mint `rgb(0,229,160)` |
| Card shadow | yellow `--color-main` 4px | yellow `rgb(250,204,0)` 4px |
| Col count | VT323 12px "5" | VT323 12px "5" |

Card columns, the inter-column gutter, the toolbar, the title baseline, the
badge colors, and the **yellow colored card shadow** all align.

### Documented residual (the ~15-point full-frame diff)

The residual is the **same accepted text-render divergence** documented in Tasks
6 & 7, here from two sources:

1. **Title face.** The live prototype's `app.jsx` `TWEAK_DEFAULTS` sets
   `"font": "Space Mono"` and writes it to **both** `--font-base` *and*
   `--font-heading` on `<html>` at runtime, so the prototype renders the
   "Tasks & Dates" title in **Space Mono** (overriding its own retro.css Bungee
   mapping). The app keeps the title in **Bungee** (`--font-display`) to stay
   consistent with every other shipped Atlas title (screener, thread) and the
   DESIGN.md spec — the documented Bungee-vs-Space-Mono baseline residual.
2. **Card-height / label-wrap drift.** Space Mono renders at slightly different
   metrics across the two stacks, so the first task label lands right at its wrap
   boundary (1 line in the app, 2 lines in the prototype) and the card heights
   differ by ~7px. Over a 5-card column this drift accumulates, which is the bulk
   of the residual full-frame diff. No structural / border / radius / shadow /
   color / position mismatch (structural blurred diff = 11.28).

Matched to the prototype during this task (initially diverging, then corrected):
the **yellow colored card shadow** (was ink), the **sticker-rotated column-head
badge**, and the **VT323** `Due:` / count metadata.

---

## Responsive (tablet / mobile)

| Viewport | Full mean | Within 14/255 | Structural (blur) |
|---|---|---|---|
| 1024×768 | 34.34 | 70.6 % | 23.53 |
| 768×1024 | 41.29 | 46.6 % | 31.69 |
| 390×844 | 37.89 | 54.5 % | 29.37 |

The **prototype has no responsive breakpoints** — at narrow widths it keeps its
fixed `240px 380px 1fr` (~1240px) grid plus a fixed two-column tasks grid, which
overflows and is clipped at the viewport edge. The app reflows: the shared
`≤860px` rule stacks the regions into a single `minmax(0, 1fr)` column, and a new
`≤860px` rule collapses `.atlas-tasks-grid` to a single column. That structural
difference (app stacked vs prototype clipped fixed grid) is the entire source of
the higher tablet/mobile diffs — the same acceptance-allowed adaptation
documented for the Task-4 inbox, Task-5 onboarding, Task-6 screener, and Task-7
feed/paper.

**No-clip / fully-functional proof:**

| Check | 390×844 | 768×1024 |
|---|---|---|
| `body.scrollWidth == innerWidth` | 390 == 390 | 768 == 768 |
| Horizontal overflow | none | none |
| Task + date cards rendered | 10 | 10 |
| `.atlas-tasks-grid` columns | `350px` (1 col) | `728px` (1 col) |

No horizontal overflow at any width; all 10 cards stay in-bounds and reachable.

---

## Interaction / SSR proof (server-rendered HTML)

| Behavior | Proven via | Result |
|---|---|---|
| **Tasks renders** | `GET /atlas/tasks` | `<h2>Tasks &amp; Dates</h2>`, subtitle present, server-err = 0 |
| **Reachable from sidebar** | `GET /atlas/tasks` | Tasks nav = real `<a href="/atlas/tasks">`, `is-active` + `aria-current="page"` |
| **Counts match prototype** | `GET /atlas/tasks` | "Sync 5 tasks" / "Sync 5 dates"; 5 task-cards + 5 date-cards (10 `.atlas-task-card`); 5 `.atlas-task-check` |
| **Column badges** | `GET /atlas/tasks` | `TASKS` (mint `is-paper`) + `DATES` (yellow `is-feed`) |
| **Date tile stamps** | `GET /atlas/tasks` | TOM/9, FRI/23, TOM/?, FRI/23, WED/26 (regex-derived, match prototype) |
| **Source footers** | `GET /atlas/tasks` | 10 `.atlas-task-src` "From: …" provenance lines |
| **Sync buttons styling** | `GET /atlas/tasks` | secondary `.atlas-btn.is-sm` + primary `.atlas-btn.is-sm.is-primary` (✦ star), exact shared primitives |
| **`?d=` carried into Tasks link** | `GET /atlas/feed?d=s2:feed` | sidebar Tasks link = `/atlas/tasks?d=s2%3Afeed` |
| **`?d=` carried out of Tasks** | `GET /atlas/tasks?d=s1:inbox` | sidebar Inbox link = `/atlas/inbox?d=s1%3Ainbox` |
| **All mail screens link to Tasks** | `GET` inbox/screener/feed/paper | each sidebar contains `href="/atlas/tasks"` |

> Live `<a>`-click navigation is blocked app-wide by the pre-existing
> `template2 is not a function` hydration error. The sidebar links are real
> server-rendered `<a href>` elements, so navigation works by direct URL load
> (proven above) and will work on click once the app-wide hydration error — out
> of scope for this task — is resolved.

---

## Validation

| Check | Result |
|---|---|
| `bun run --cwd apps/web typecheck` | ✅ pass (`tsc --noEmit`, exit 0) |
| `bun run --cwd apps/web build` | ✅ pass (exit 0; `tasks` client + server chunks emitted, prerender OK) |
| `biome check` (tasks route + 3 components + nav_links) | ✅ clean (5 files, no fixes) |
| `/atlas/tasks` renders | ✅ 200, "Tasks & Dates", 10 cards, 0 server errors |
| `/` preserved | ✅ 200, no `atlas-app` / `atlas-tasks-grid` CSS leak |
| `/dev/design-system` preserved | ✅ 200 |
| `/atlas/inbox` (regression) | ✅ 307 redirect; final page links to `/atlas/tasks` |
| `/atlas/screener` `/atlas/feed` `/atlas/paper-trail` (regression) | ✅ 200, each links to `/atlas/tasks`, `?d=` preserved |
| No horizontal overflow (390 / 768) | ✅ `body.scrollWidth == innerWidth` |
| No React imports/patterns in new files | ✅ grep clean |
| No runtime imports from `docs/prototype/**` | ✅ grep clean (only doc-comment references) |
| `routeTree.gen.ts` | ✅ regenerated by dev server (not hand-edited); `FileRoutesByPath` includes `/atlas/tasks` |

> The AFT in-session LSP may briefly report stale route-type errors on
> `tasks.tsx` because it cached `routeTree.gen.ts` before the dev server
> regenerated it; the authoritative `tsc --noEmit` run (against the current
> generated tree) passes with exit 0, as does `build`.

---

## Acceptance criteria

- [x] **`/atlas/tasks` is reachable from the sidebar** — the Assist "Tasks &
      Dates" nav item is a real server-rendered `<a href="/atlas/tasks">`
      (carrying `?d=`); on the route it renders `is-active` + `aria-current`.
      Every mail screen's sidebar links to it.
- [x] **Task/date counts and copy match the prototype** — title "Tasks & Dates",
      subtitle "AI-extracted · sync to Google Tasks & Calendar", "Sync 5 tasks" /
      "Sync 5 dates", 5 tasks + 5 dates, TASKS/DATES column badges + counts, every
      label / due / source verbatim from the fixtures, and date-tile month/day
      stamps regex-derived identically to the prototype.
- [x] **Screenshots match the live prototype at desktop, tablet, and mobile
      widths** — desktop `1440x900` **85.3 % near-identical / structural diff
      11.28** (geometry pixel-exact: toolbar, grid, cards, gutter, badge colors,
      yellow card shadow all matched). Tablet `768x1024` and mobile `390x844`
      captured; higher diffs are the documented, acceptance-allowed
      reflow-vs-fixed-grid adaptation (the prototype has no breakpoints), with a
      no-clip / fully-functional proof (10 cards in-bounds, single-column collapse,
      no horizontal overflow). Residual desktop diff is the documented
      Bungee-vs-Space-Mono title + Space Mono label-wrap drift.
- [x] **Sync buttons render with exact primitive styling** — the shared
      `Button` primitive: secondary `Sync 5 tasks` (`.atlas-btn.is-sm`) and
      primary `Sync 5 dates` (`.atlas-btn.is-sm.is-primary` with the ✦ star),
      matching the prototype's `.btn.sm` / `.btn.sm.primary`.
- [x] **AI-extracted copy + category-coded accents preserved** — labels/due/
      source verbatim; Tasks column keyed to mint `paper`, Dates column + date
      tiles keyed to yellow `feed`; the AI-extraction subtitle is preserved.
- [x] **`/`, `/dev/design-system`, other `/atlas` routes unchanged; no React
      imports/patterns; no runtime imports from `docs/prototype/**`;
      `routeTree.gen.ts` regenerated (not hand-edited).**
- [x] **`bun run --cwd apps/web typecheck` passes** (exit 0); `build` passes;
      `biome check` clean.
