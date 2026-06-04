# Proof — Task 2.0: Main Hay shell, sidebar navigation, and category layouts

Feature: `04-spec-inbox-ui-recreation`
Parent task: **2.0 — Recreate the main Hay shell, sidebar navigation, and category-specific layouts**
Sub-tasks covered: 2.1, 2.2, 2.3, 2.4, 2.5
Date captured: 2026-06-04
Review viewport: **1440 × 900** (the single consistent desktop viewport established in task 1.0)

---

## Summary

The placeholder `AppShell` was replaced with a prototype-faithful main Hay
shell. After onboarding is dismissed, `/dev/hay-inbox` renders the prototype's
desktop-first composition:

- **Topbar** — `HAY.` wordmark chip, a left-aligned **Search / Ask Hay** control
  with a `/` kbd hint, a primary **Compose** control, and an avatar account chip.
- **Sidebar** — two sections (Triage / Workspace) of nav items with mock counts,
  category-colored dots, an **AI usage** card with a progress bar, and a
  **Replay onboarding** affordance.
- **Content area** — a three-pane category layout (`240px 380px 1fr`) for
  Inbox / Feed / Paper Trail (list rail + reading pane), and full-width
  alternate views (`240px 1fr`) for Screener, Tasks & Dates, and Settings.

All navigation, selection, and active state is local-state only (SolidJS
`createSignal`). No backend, no persistence. All sample senders, counts, and
content are mock/demo data.

All prototype-specific styling lives in `hay-inbox-styles.css`, scoped under
the `.hay-demo` root class. Global Hay tokens (`apps/web/src/styles.css`) are
unchanged; the demo CSS only consumes them via `--demo-*` aliases.

---

## Acceptance evidence

### 2.1 — Shell layout (topbar, sidebar, AI usage card)

Live accessibility snapshot of the shell after dismissing onboarding:

```
- button "Search or ask Hay… /"        (search/ask control + kbd hint)
- button "Compose"                     (primary compose control)
- button "Your account"                (avatar chip)
- button "Screener 3"                  (sidebar nav + count)
- button "Inbox 4"
- button "Feed 9"
- button "Paper Trail 2"
- button "Tasks & Dates 5"
- button "Settings"
- button "Replay onboarding"
- heading "Inbox" [level=2]            (active category list header)
```

Computed layout verified live:

```
.app gridTemplateColumns → "240px 380px 820px"  (240 | 380 | 1fr)
.app gridTemplateRows    → "56px 844px"          (56px topbar | 1fr)
.logo                    → "HAY."
.nav-item count          → 6
AI usage                 → "34%"  (34 / 100 monthly · Free tier), bar width @ 34%
```

> Content-parity note (2026-06-04): the AI-usage figures and sample senders
> below were later replaced with the prototype's actual mock content
> (34/100 monthly · Free tier; Inbox leads with Priya Ramanathan). See
> `04-content-parity-PROOF.md`.

Screenshot: `02-main-shell.png` (Inbox active, default no-selection state).

### 2.2 — Local navigation across all six surfaces

Navigation is driven by a single `screen` signal. Each nav item is a real
`<button>` (a11y-correct, keyboard focusable) that sets the active screen.
`data-screen` on `.app` reflects the active surface; verified live by clicking
each nav item:

| Click target | Resulting `data-screen` |
| --- | --- |
| `nav-screener` | `screener` |
| `nav-feed` | `feed` |
| `nav-paper` | `paper` |
| `nav-tasks` | `tasks` |
| `nav-settings` | `settings` |
| `nav-inbox` | `inbox` |

GIF: `02-nav-switching.gif` (7 frames, 960×600) — Inbox → Screener → Feed →
Paper Trail → Tasks & Dates → Settings → Inbox.

### 2.3 — Category-specific styling, active states, badges, counters, panes

- **Active nav state**: `.nav-item.active` renders the prototype's solid
  `--main` background with a flat shadow and a black dot. Verified active nav =
  "Inbox" on load.
- **Three-pane category layout**: Inbox / Feed / Paper Trail render a `.list`
  rail (header with title + mono meta + unread/total counter) and a reading
  pane. Selecting a row applies `.mail-row.selected` and updates the pane —
  verified: clicking `mail-row-i1` selects "Priya Ramanathan" and the reading
  pane updates. Screenshot: `02-main-shell-selected.png`.
- **Full-width alternate views**: Screener / Tasks & Dates / Settings apply the
  `wide` class and collapse the grid to `240px 1fr`. Verified live on Screener:
  `wide=true`, `gridTemplateColumns="240px 1200px"`, 4 screener cards rendered.
  Screenshots: `02-screen-screener.png`, `02-screen-settings.png`.
- **Badges / tags / priorities**: mail rows render category-colored tags
  (e.g. `RECEIPT`, `REPLY LATER`, `SET ASIDE`), priority chips (`P1`/`P2`/`P3`),
  unread dots, and mono timestamps — all ported from the prototype CSS.

### 2.4 — Replay-onboarding affordance + shell mock counters/labels

- **Replay onboarding** is available from **two** places, both wired to the
  parent demo container's `onReplayOnboarding`:
  1. the sidebar (`data-testid=replay-onboarding`), and
  2. the Settings screen (`data-testid=settings-replay-onboarding`).
  Verified both present in the DOM (`true`).
- **Mock counters / labels** consistent with the prototype hierarchy: per-nav
  counts (Screener 4, Inbox 3, Feed 2, Paper Trail 7, Tasks & Dates 5), AI usage
  `34 / 100 monthly · Free tier (34%)`, per-list `unread · total` meta, Screener
  `N pending`, and Tasks/Dates `N tasks · N dates`.

### 2.5 — Stable for screenshot/demo capture

All six surfaces render without layout jumps or runtime errors and were
captured cleanly (see artifacts below). Quality gates pass:

```
$ bun run --cwd apps/web lint       → exit 0 (Checked 37 files, no fixes)
$ bun run --cwd apps/web typecheck  → exit 0
$ bun run --cwd apps/web build      → exit 0 (hay-inbox chunk emitted, prerender ok)
```

---

## Browser validation (`npx agent-browser`)

- URL exercised: `http://localhost:3001/dev/hay-inbox` against the production
  build served by `vite preview --port 3001` (3001 is the CORS-trusted origin
  from `apps/server`, so the route's auth guard resolves).
- The guarded route's session check was satisfied by stubbing
  `GET /api/auth/get-session` with a valid demo session via
  `agent-browser network route` — **no source code was modified to bypass auth**.
- **Zero console errors / warnings** across the full flow: onboarding dismissal,
  navigation through all six surfaces, wide-view collapse, and row selection.
- Viewport: **1440 × 900**.

Interactions exercised end-to-end (real clicks, fresh refs after each
re-render):

- Skip onboarding → hands off to the shell (Inbox active).
- Click each of the six nav items → active screen + `data-screen` updates.
- Screener / Tasks & Dates / Settings → `.app.wide` collapses to `240px 1fr`.
- Select an Inbox row → `.mail-row.selected` applied, reading pane updates.
- Replay onboarding present in both sidebar and Settings.

> Recording note: `ffmpeg` is not installed on this machine, so
> `agent-browser record` (webm) is unavailable. The navigation GIF was instead
> produced deterministically from per-screen PNG frames (one click per screen,
> verified via `data-screen`) and encoded with a pure-JS GIF encoder
> (`gifenc` + `sharp`). The GIF is a valid animated GIF89a with 7 frames.

---

## Artifacts

| Artifact | Path |
| --- | --- |
| Main shell (Inbox, no selection) | `02-main-shell.png` |
| Main shell (Inbox row selected + reading pane) | `02-main-shell-selected.png` |
| Screener full-width view | `02-screen-screener.png` |
| Settings full-width view | `02-screen-settings.png` |
| Navigation across all six surfaces | `02-nav-switching.gif` |
| This proof | `02-main-shell-PROOF.md` |

---

## Files added/changed for task 2

New components:

- `apps/web/src/components/hay-demo/hay-inbox-data.ts` (new) — mock nav,
  counts, mail rows, screener queue, tasks/dates, AI usage.
- `apps/web/src/components/hay-demo/mail-list.tsx` (new) — reusable category
  list rail (Inbox / Feed / Paper Trail) with selected-row + unread states.
- `apps/web/src/components/hay-demo/screener-screen.tsx` (new) — full-width
  Screener surface (cards, AI suggestion, accept/reject controls).
- `apps/web/src/components/hay-demo/tasks-screen.tsx` (new) — full-width
  Tasks & Dates two-column surface.
- `apps/web/src/components/hay-demo/settings-screen.tsx` (new) — full-width
  Settings surface with local toggles + replay-onboarding affordance.

Changed:

- `apps/web/src/components/hay-demo/app-shell.tsx` — replaced the task-1
  placeholder with the full topbar / sidebar / content composition + local
  navigation and selection state.
- `apps/web/src/components/hay-demo/hay-inbox-styles.css` — appended the shell
  styles (`.app`, `.topbar`, `.sidebar`, `.nav-item`, AI usage card, `.list`,
  `.mail-row`, tags/priorities, `.pane`, screener/tasks/settings), scoped under
  `.hay-demo`.
- `docs/specs/04-spec-inbox-ui-recreation/04-tasks-inbox-ui-recreation.md` —
  marked 2.0 and 2.1–2.5 complete.

`apps/server/src/routes/accounts_connect.ts` was left untouched.
