# Proof — Content-Parity Correction Pass

Feature: `04-spec-inbox-ui-recreation`
Pass: **Data/content fidelity correction** (port prototype mock content into the
Solid demo, replacing the originally-invented sample content)
Date captured: 2026-06-04
Review viewport: **1280 × 800**

---

## Summary

This pass replaces the demo's invented senders / threads / counts / Screener
items / Tasks & Dates / Settings content with the **prototype's actual mock
content**, ported as closely as feasible. The color tokens, styling language,
and component structure are unchanged — only the rendered content changed.

Authoritative source: `docs/prototype/hay-inbox-prototype.html`. The prototype
is a bundled (gzip+base64) single file; the content was extracted from its
embedded assets:

| Asset (uuid prefix) | Role | Content ported |
| --- | --- | --- |
| `cc85f047` | `const SAMPLE` | Inbox / Feed / Paper Trail rows, Screener queue, Priya threadBody |
| `fa7745fc` | screen components | Screener copy, Tasks & Dates cards, Settings rows, Ask Hay replies |
| `ea22146a` | root app | Nav labels + derived counts, AI usage (34/100 · Free tier), `rob@hay.co`, `RB` avatar |

---

## What changed (content only)

### Mail rows (`hay-inbox-data.ts` → `MAIL_ROWS`)

Now **23 rows** matching the prototype exactly:

- **Inbox (9):** Priya Ramanathan (P1, "Re: Q3 hiring plan — final review",
  full 3-message thread), Marcus Okafor (P1, "Term sheet — redlines attached"),
  Sara Bouchard (P2), Dad (P3, "set aside"), Jordan Vega (P2, "PR #482"),
  GitHub (P3), Anya Volkov (P2, "reply later"), Calendly (P3), Toni Reyes (P3).
- **Feed (7):** Stratechery, Vercel, Substack — Anne Helen Petersen, Figma,
  Morning Brew, The Browser, Linear.
- **Paper Trail (7):** Stripe ($96 Linear), Delta (DL 482 → PDX), Amazon,
  Brex, PG&E, Notion, DoorDash — each with the prototype receipt/confirmation
  tags.

The prototype only carries a rich `threadBody` for `i1` (Priya). Other rows
synthesize a single-message thread from their preview — faithful to the
prototype, which renders no detailed body for them.

### Screener (`screener-screen.tsx` + data)

**4 first-time senders**, verbatim copy:

| id | Sender | AI hint | ACCEPT label |
| --- | --- | --- | --- |
| s1 | Maya Chen (`maya.chen@northstarcap.com`) | "Looks like a warm investor intro. Recommend Inbox." | ACCEPT INTO INBOX |
| s2 | ResonateHQ | "Marketing newsletter. Recommend Feed." | ACCEPT INTO FEED |
| s3 | Stripe | "Transactional receipt. Recommend Paper Trail." | ACCEPT INTO PAPER |
| s4 | Liam Park | "Personal cold email. Recommend Inbox." | ACCEPT INTO INBOX |

Header now reads "The Screener" / "First-time senders. Decide once — Hay routes
the rest." Each card shows the sender time, the subject (bold), the AI hint, and
a category pill — matching the prototype's `.screener-card`.

### Tasks & Dates (`tasks-screen.tsx` + data)

Subline now "AI-extracted · sync to Google Tasks & Calendar"; **5 tasks** and
**5 dates**, verbatim (Priya pod A / design hire, Marcus SAFE redlines, PR #482,
Anya commission; 1:1 with Priya, Maya intro call, Marcus walkthrough, Amazon
delivery, Flight DL 482). Per-task priority chips removed (the prototype's task
cards carry no priority).

### Settings (`settings-screen.tsx`)

- Accounts: `rob@hay.co` (Google Workspace · synced 24s ago · 142 threads),
  `rob.barrett@outlook.com` (Microsoft 365 personal · paid tier required).
- AI & Privacy / Notifications row copy aligned to the prototype verbatim
  (e.g. "Sort Inbox by P1/P2/P3 with explanations.", "Sync confirmed items to
  Google Tasks & Calendar.", "PWA notification when a P1 thread arrives.").

### Shell (`app-shell.tsx`)

- Avatar `RB` (Rob Barrett); nav counts derived live from local state.
- AI usage card: `34/100 monthly · Free tier` (bar @ 34%).
- Inbox defaults to the Priya thread (`i1`) selected, matching the prototype.
- Assistant cite for a Screener sender (Maya Chen, `s1`) routes to the Screener
  surface.

### Compose (`compose-overlay.tsx`)

Reply prefill aligned to the Priya thread: From `rob@hay.co`, Subject
"Re: Q3 hiring plan — final review", and the prototype's inline-reply body.

### Ask Hay (`assistant-overlay.tsx` + data)

Greeting, the four example prompts, and the four canned replies (Priya / Stripe
/ screener / Marcus) with citations now match the prototype verbatim.

---

## Browser validation (`npx agent-browser`, 1280 × 800)

Exercised at `http://localhost:3001/dev/hay-inbox` (dev server). Every surface
rendered with **no Vite/runtime error overlay** and the ported content.

```
Shell topbar       → avatar "RB"; nav: Screener 4, Inbox 3, Feed 2, Paper Trail 7, Tasks 5
AI usage           → "34%", "34/100 monthly · Free tier"
Inbox list         → "3 unread · 9 total"; leads Priya Ramanathan (Q3 hiring, REPLY LATER, 10:42)
Reading pane (i1)  → AI summary "Priya is reviewing the Q3 hiring plan…"; 2 tasks + 1 date
Screener           → "The Screener", 4 pending, Maya Chen + correct AI hints
                     accept labels: ACCEPT INTO INBOX | FEED | PAPER | INBOX
Feed list          → "The Feed", 2 unread · 7 total; leads Stratechery
Paper Trail list   → 0 unread · 7 total; Stripe ($96 Linear) + Delta (DL 482)
Tasks & Dates      → "AI-extracted · sync to Google Tasks & Calendar"; 5 tasks / 5 dates (verbatim)
Settings           → rob@hay.co (142 threads), rob.barrett@outlook.com
Ask Hay            → examples verbatim; "Priya" reply cites Priya Ramanathan (i1)
```

Local-state behavior preserved (verified live):

```
Cite "Priya" → click cite-i1   → data-screen="inbox", thread-view-i1 visible
Accept Screener s1 (Maya)      → Screener count 4 → 3; Inbox count 3 → 4;
                                  Inbox now leads with "Maya Chen"
```

### Validation note (pre-existing blocker)

The `/dev/hay-inbox` route is behind a global auth guard
(`__root.tsx` + the route's `beforeLoad`) that redirects unauthenticated
sessions to `/auth/sign-in`. In this environment the auth route chain fails to
resolve `@tauri-apps/api/event` / `@tauri-apps/plugin-opener` (desktop-only deps
not linked into `apps/web/node_modules`), which blocks the SPA from mounting
when no session is present. This is **pre-existing and outside this content
pass** (no hay-demo source touches those modules). For validation only, the
route's session check was temporarily bypassed locally; the bypass was reverted
before committing. No source change ships from the validation step.

---

## Quality gates

```
$ bun run --cwd apps/web typecheck   → exit 0  (tsc --noEmit)
$ bun run --cwd apps/web lint         → exit 0  (biome, 40 files, no fixes)
```

---

## Artifacts

| Artifact | Path |
| --- | --- |
| Inbox + Priya reading pane | `04-content-parity-inbox.png` |
| Screener (4 ported senders) | `04-content-parity-screener.png` |
| Tasks & Dates (5/5 ported) | `04-content-parity-tasks.png` |
| Settings (rob@hay.co accounts) | `04-content-parity-settings.png` |
| Ask Hay (Priya reply + citation) | `04-content-parity-assistant.png` |
| This proof | `04-content-parity-PROOF.md` |

---

## Files changed (this pass)

- `apps/web/src/components/hay-demo/hay-inbox-data.ts` — ported all mock content
  (mail rows, screener, tasks/dates, AI usage, assistant replies); added
  `Priority` + `priority` to `MailRow`, `time` to `ScreenerItem`, and helpers
  (`initialsOf`, `tag`, `singleMessageThread`).
- `apps/web/src/components/hay-demo/app-shell.tsx` — live-derived nav counts,
  `RB` avatar, AI-usage label, default Inbox selection (`i1`), Screener-cite
  routing.
- `apps/web/src/components/hay-demo/screener-screen.tsx` — "The Screener" copy,
  card time/subject, AI category pill, "Accept into <CATEGORY>" labels.
- `apps/web/src/components/hay-demo/tasks-screen.tsx` — subline copy; removed
  per-task priority chip.
- `apps/web/src/components/hay-demo/settings-screen.tsx` — prototype account +
  AI/Notification row copy.
- `apps/web/src/components/hay-demo/compose-overlay.tsx` — Priya-thread reply
  prefill, `rob@hay.co` From.
- `apps/web/src/components/hay-demo/hay-inbox-styles.css` — `.screener-subject`
  + `.screener-time` support rules.
- `docs/specs/04-spec-inbox-ui-recreation/proof/*` — updated stale content
  references in `02`/`03`/`04` proofs and added this proof + screenshots.

`apps/server/**` and all unrelated files were left untouched.
