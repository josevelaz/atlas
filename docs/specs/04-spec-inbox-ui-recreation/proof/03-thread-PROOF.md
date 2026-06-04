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

- `MAIL_ROWS` — 23 rows (Inbox 9 / Feed 7 / Paper Trail 7), each with a full
  `thread` (AI summary + extracted items + message stack). Content is ported
  from the prototype `SAMPLE` (see the content-parity correction below).
- `SCREENER_ITEMS` — 4 pending senders, each with a `suggested` category +
  AI hint and a `subject` used for the routed row.
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
Inbox  → Priya Ramanathan, Marcus Okafor, Sara Bouchard, Dad, Jordan Vega, GitHub, Anya Volkov, Calendly, Toni Reyes
Feed   → Stratechery, Vercel, Substack — Anne Helen Petersen, Figma, Morning Brew, The Browser, Linear
Paper  → Stripe, Delta, Amazon, Brex, PG&E, Notion, DoorDash
```

### 3.3 — Thread-view pane

Selecting `mail-row-i1` (Priya Ramanathan) renders:

```
thread-view-i1 present       : true
ai-summary present           : true   ("Priya is reviewing the Q3 hiring plan…")
extracted items              : 3      (2 tasks + 1 date — pod A staffing, design hire, 1:1)
messages                     : 3      (Priya → You → Priya, oldest last)
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
| select Inbox i1 | `thread-view-i1` | "Priya is reviewing the Q3 hiring plan…" | Priya Ramanathan |
| select Inbox i2 | `thread-view-i2` | "Marcus from Catalyst sent SAFE redlines…" | Marcus Okafor |
| Feed → select f1 | `thread-view-f1` | "Three years into the AI reset…" | Stratechery |

GIF: `03-thread-selection.gif` (5 frames) — Inbox default → select Priya →
select Marcus → Paper Trail (select Delta) → Feed (select Stratechery).

### 3.5 — Screener accept / reject / category routing

Starting from 4 pending (`s1` Maya Chen→Inbox, `s2` ResonateHQ→Feed,
`s3` Stripe→Paper Trail, `s4` Liam Park→Inbox):

```
Accept s1 (Maya Chen → Inbox)    : queue 4 → 3;  Inbox now leads with "Maya Chen"
                                    and the Inbox unread count rises 3 → 4
Reject s2 (ResonateHQ → Feed)    : queue → 2;    NOT routed to any list
Accept s3 (Stripe → Paper Trail) : queue → 1;    Paper Trail leads with "Stripe"
Empty queue                      : Screener shows "Screener clear" empty state
```

GIF: `03-screener-triage.gif` (5 frames) — pending → accept Maya → reject
ResonateHQ → accept Stripe → Inbox shows the routed "Maya Chen" row.

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

---

## Content-parity correction (2026-06-04)

A later content-fidelity pass replaced the originally-invented sample content
with the prototype's actual mock data, extracted from
`docs/prototype/hay-inbox-prototype.html` (bundled asset `cc85f047` —
`const SAMPLE`; screen components in `fa7745fc`; root app in `ea22146a`). No
visual/token changes were made — only the rendered content.

Senders/threads/counts now match the prototype:

- **Inbox (9):** Priya Ramanathan (P1, Q3 hiring plan — full 3-message thread),
  Marcus Okafor (P1, Term sheet), Sara Bouchard (P2), Dad (P3), Jordan Vega
  (P2), GitHub (P3), Anya Volkov (P2), Calendly (P3), Toni Reyes (P3).
- **Feed (7):** Stratechery, Vercel, Substack — Anne Helen Petersen, Figma,
  Morning Brew, The Browser, Linear.
- **Paper Trail (7):** Stripe, Delta, Amazon, Brex, PG&E, Notion, DoorDash.
- **Screener (4):** Maya Chen → Inbox, ResonateHQ → Feed, Stripe → Paper Trail,
  Liam Park → Inbox, each with the prototype's AI hint + "ACCEPT INTO <CAT>".
- **Nav counts** are now derived live (Screener 4, Inbox 3 unread, Feed 2
  unread, Paper Trail 7 total, Tasks & Dates 5), matching the prototype rail.

The sole rich `threadBody` in the prototype is the Priya thread (`i1`); other
rows synthesize a single-message thread from their preview (faithful to the
prototype, which shows no detailed body for those rows). See
`04-content-parity-PROOF.md` for the full screenshot evidence of this pass.
