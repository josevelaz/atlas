# Proof — Task 3.0: Mock mail data flows, thread reading, and local Screener triage

Feature: `04-spec-inbox-ui-recreation`
Parent task: **3.0 — Recreate mock mail data flows, thread reading, and local Screener triage behavior**
Sub-tasks covered: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
Date captured: 2026-06-04
Review viewport: **1440 × 900** (still images) / **960 × 600** (GIF frames, downscaled from a 1280 × 800 capture)

---

## Summary

Task 3.0 turns the prototype-faithful shell from task 2.0 into a working,
local-only inbox demo:

- **Richer mock data** (`hay-inbox-data.ts`): every `MailRow` now carries a
  `thread` detail — an AI summary, extracted tasks/dates (`ExtractItem`), and a
  message stack (`ThreadMessage`) with sender name, address, and a mono date.
  `ScreenerItem` gained a `subject`, and a `screenerItemToMailRow()` helper
  synthesizes a destination row when a sender is accepted.
- **Thread view** (`thread-view.tsx`, new): the reading-pane placeholder is
  replaced with the prototype's `.thread` composition — a `.thread-toolbar`
  (subject + tags on the left; Reply / Forward / Archive / Delete / More on the
  right), an `.ai-summary` block (`★ AI SUMMARY` head, summary body, and the
  `.extracted` task/date list with `.extract-item` rows), and the `.message`
  stack.
- **Reactive selection** (`app-shell.tsx`): mail rows and the Screener queue now
  live in local signals. An `activeCategory` memo and a keyed `<Show>` make the
  list rail + reading pane update correctly when switching between Inbox / Feed /
  Paper Trail (this fixed a real reactivity bug where the previous category's
  rows were sticky across a category switch).
- **Screener triage** (`screener-screen.tsx` + `app-shell.tsx`): Accept routes
  the sender into their AI-suggested category list (prepended, marked unread)
  and drops them from the pending queue; Reject drops them with no routing.

All state is local SolidJS signals — no backend, no persistence, no real mail.

---

## Acceptance evidence

### 3.1 — Structured mock data

`hay-inbox-data.ts` models, all demo-only:

- `MAIL_ROWS` — 8 rows across `inbox` / `feed` / `paper`, each with a full
  `thread` (AI summary + extracted items + message stack).
- `SCREENER_ITEMS` — 3 pending senders, each with a `suggested` category +
  pill label and a `subject` used for the routed row.
- `TASK_CARDS` / `DATE_CARDS` — Tasks & Dates content.
- `screenerItemToMailRow(item)` — synthesizes a `MailRow` (category =
  `item.suggested`, unread, category-colored tag, single-message thread) for an
  accepted sender.

### 3.2 — Reusable mail-list rendering (Inbox / Feed / Paper Trail)

`MailList` renders the `.list` rail with a header (title + mono `unread · total`
meta) and `.mail-row` rows (avatar, sender, subject, 2-line preview, mono
timestamp, optional tags, unread dot, selected state). Verified live per
category:

```
Inbox  → Dana Whitfield, Marcus Lee, Priya Nair, Acme Support
Feed   → Stratechery, Lenny's Newsletter, GitHub
Paper  → Stripe, Delta
```

### 3.3 — Thread-view pane

Selecting `mail-row-i1` (Dana Whitfield) renders:

```
thread-view-i1 present       : true
ai-summary present           : true   ("Dana moved the Q3 roadmap deck review…")
extracted items              : 2      (task "Send pricing-slide edits" + date "Q3 roadmap review")
messages                     : 2      (Dana, then You)
reply control present        : true
archive control present      : true
```

Screenshot: `03-thread-view.png` (1440 × 900) — populated thread with sender
metadata, tags, `★ AI SUMMARY`, extracted task + date, and reply/forward/
archive/delete/more controls.

### 3.4 — Local selection state updates the reading pane

Selection is owned by the shell via a per-category `selected` record and an
`activeCategory` memo. Verified live by switching rows + categories:

| Action | reading pane (`data-testid`) | AI summary starts with | selected row |
| --- | --- | --- | --- |
| select Inbox i1 | `thread-view-i1` | "Dana moved the Q3 roadmap…" | Dana Whitfield |
| select Inbox i2 | `thread-view-i2` | "Marcus sent the signed SOW…" | Marcus Lee |
| Feed → select f1 | `thread-view-f1` | "This week's Stratechery argues…" | Stratechery |

GIF: `03-thread-selection.gif` (5 frames) — Inbox default → select Dana →
select Marcus → Paper Trail (select Delta) → Feed (select Stratechery).

### 3.5 — Screener accept / reject / category routing

Starting from 3 pending (`s1`→Feed, `s2`→Paper Trail, `s3`→Inbox):

```
Accept s3 (Sam Ortega → Inbox)   : queue → [s1, s2];  Inbox now leads with
                                    "Sam Ortega — Following up from the conference"
Reject s2 (Northwind → Paper)    : queue → [s1];       NOT routed to any list
Accept s1 (Launch Weekly → Feed) : queue → [];         Feed now leads with "Launch Weekly"
Empty queue                      : Screener shows "Screener clear" empty state
```

GIF: `03-screener-triage.gif` (5 frames) — 3 pending → accept s3 → reject s2 →
accept s1 (0 pending / clear) → Inbox shows the routed "Sam Ortega" row.

### 3.6 — Demonstrable and error-free in-browser

Full flow exercised via `npx agent-browser` with **zero console
errors/warnings**: onboarding skip → category switching → row selection across
all three categories → Screener accept/reject/route → empty-queue state.

---

## Quality gates

```
$ bun run --cwd apps/web typecheck   → exit 0  (tsc --noEmit)
$ bun run --cwd apps/web lint         → exit 0  (biome, 38 files, no fixes)
$ bun run --cwd apps/web build        → exit 0  (hay-inbox chunk emitted, prerender ok)
```

---

## Browser validation (`npx agent-browser`)

- URL exercised: `http://localhost:3001/dev/hay-inbox` against the production
  build served by `vite preview --port 3001` (3001 is the CORS-trusted origin
  from `apps/server`, so the route's auth guard resolves).
- The guarded route's session check was satisfied by stubbing
  `GET /api/auth/get-session` with a valid demo session via
  `agent-browser network route` — **no source code was modified to bypass auth**.
- Viewport: **1440 × 900** (stills); GIF frames captured at 1280 × 800 and
  downscaled to 960 × 600.

> Recording note: `ffmpeg` is not installed on this machine, so
> `agent-browser record` (webm) cannot be transcoded to GIF. Following the same
> reviewer-honest fallback used in task 2.0, both GIFs were produced
> deterministically from real per-step PNG frames (one verified interaction per
> frame) and encoded as valid GIF89a animations via `gifenc` + `sharp`.

---

## Artifacts

| Artifact | Path |
| --- | --- |
| Populated thread view (AI summary + extracted tasks/dates + messages + controls) | `03-thread-view.png` |
| Thread-selection flow (rows across Inbox / Paper / Feed) | `03-thread-selection.gif` |
| Screener triage flow (accept / reject / route + clear) | `03-screener-triage.gif` |
| This proof | `03-thread-PROOF.md` |

---

## Files added/changed for task 3

New:

- `apps/web/src/components/hay-demo/thread-view.tsx` — prototype-faithful
  reading pane (toolbar + AI summary + extracted items + message stack).

Changed:

- `apps/web/src/components/hay-demo/hay-inbox-data.ts` — added `ExtractItem`,
  `ThreadMessage`, `ThreadDetail` types; gave every `MailRow` a `thread` +
  `address`; added `subject` to `ScreenerItem`; added `screenerItemToMailRow()`.
- `apps/web/src/components/hay-demo/app-shell.tsx` — lifted mail rows + Screener
  queue into signals; added `activeCategory` / `selectedRow` memos; wired
  `ThreadView`; implemented `acceptScreener` / `rejectScreener` routing; fixed a
  category-switch reactivity bug in the list/pane render.
- `apps/web/src/components/hay-demo/hay-inbox-styles.css` — appended thread-view
  styles (`.thread`, `.thread-toolbar`, `.thread-subject`, `.thread-actions`,
  `.thread-act`, `.ai-summary` + `.head`/`.body`/`.extracted`, `.extract-item`,
  `.message` + head/body), scoped under `.hay-demo`.
- `docs/specs/04-spec-inbox-ui-recreation/04-tasks-inbox-ui-recreation.md` —
  marked 3.0 and 3.1–3.6 complete.

`apps/server/src/routes/accounts_connect.ts` was left untouched.
