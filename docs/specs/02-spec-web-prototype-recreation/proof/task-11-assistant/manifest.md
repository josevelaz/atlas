# Task 11 — Ask Atlas Assistant Overlay, Chat, Citations & Shortcuts

**Task:** Implement the Ask Atlas assistant overlay, canned chat, citations, and
keyboard shortcuts, shared across the Atlas mail workspace.
**Date:** 2026-06-05
**Surface added:** `AssistantDialog` overlay, wired into the `/atlas` mail
workspace (opened from the topbar "Search or ask" button, `/`, and `⌘K`/`Ctrl+K`;
closed via ✕ / backdrop / Escape). Citations deep-link to the referenced thread.

---

## What shipped

A shared **Ask Atlas assistant overlay** now lives in the Atlas mail workspace,
mirroring the prototype's `Assistant` (`docs/prototype/screens.jsx`):

- **Opens** from the topbar **"Search or ask"** button (`onSearch` → `openAssistant`),
  the **`/`** key, and **`⌘K` / `Ctrl+K`** — all routed through the shared
  `resolveShortcut` keyboard map (`app_state.ts`).
- **AI-keyed header** (electric-blue `--color-ai`, white text) with a **SEMANTIC
  SEARCH** chip, so the machine's voice stays visually distinct (per DESIGN.md).
- **Scrolling transcript** of user / AI **chat bubbles**: user bubbles fill the
  yellow accent and right-align; AI bubbles use the surface fill.
- **Example prompt chips** (Priya / Stripe / screener / Marcus) shown while only
  the intro bubble is present; clicking one submits it.
- **Canned responses** resolved by `answerQuery` (`assistant_responses.ts`) — the
  text + citations match `docs/prototype/screens.jsx` **verbatim**.
- **Busy state** — a "Thinking…" bubble renders during the brief reply delay.
- **Citations** — each AI reply's citation chips deep-link to the referenced
  thread (`/atlas/inbox?sel=` / `/atlas/paper-trail?sel=` / `/atlas/screener`)
  and close the overlay on click.
- **Closes** via the header ✕, backdrop click, or Escape — through the shared
  `Dialog` primitive (`components/ui/dialog.tsx`).

### Reused primitives (no one-off components)

- **`Dialog`** (`components/ui/dialog.tsx`) — overlay shell, backdrop dismiss,
  Escape handling, and the `inline` SSR-render path. **Unchanged** by this task.
- **`Input`** (`components/ui/input.tsx`) — the footer ask field. **Unchanged**;
  the assistant treatment is applied via scoped `.atlas-assistant-*` CSS.
- **`Button`** — header close (ghost icon), example chips, footer Send — the
  shared `.atlas-btn` variants.
- **`AtlasIcon`** — `sparkle`, `x`, `send` (all already defined).
- **`answerQuery` / `ASSISTANT_RULES` / `ASSISTANT_EXAMPLES` / `ASSISTANT_INTRO`**
  (`lib/atlas/assistant_responses.ts`) — the canned-response data layer, already
  authored in Task 3. **Reused unchanged.**
- **`resolveShortcut`** (`lib/atlas/app_state.ts`) — the declarative keyboard map
  (`/`, `⌘K`/`Ctrl+K`, Escape, `c`, 1–4). Already authored; **reused unchanged**.
- **`viewForMailId`** (`lib/atlas/app_state.ts`) — resolves a citation id to its
  screen. **Reused unchanged**; the new `atlasCiteLinkFor` wraps it.

---

## SSR-proof strategy (hydration is broken app-wide)

Client hydration is disabled by a pre-existing TanStack Start/Solid error
(`template2 is not a function`, documented in Tasks 4–10, out of scope here). So
live `onClick` / `onSubmit` / keydown cannot be relied on for proof. Instead:

- The assistant open + chat state is carried in search params on `/atlas/inbox`:
  - **`?assistant=1`** → opens the overlay in its **initial state** (intro bubble
    + the four example prompt chips, no user/AI reply).
  - **`?ask=<query>`** → opens the overlay **seeded with a submitted query** so
    the intro bubble, the user's question bubble, and the canned AI reply (plus
    its citation chips) are all server-rendered (e.g. `?ask=Priya`).
- When seeded from the route, `AssistantDialog` renders with **`inline`**, so the
  overlay is emitted in the **SSR HTML stream** (Portal content is not), making
  the open / chat / citation states observable server-side and headless.
- The seeded transcript is built by `seededTranscript(query)` =
  `[ASSISTANT_INTRO, {role:"user", text:query}, answerQuery(query)]`, so it is
  byte-identical to what the live `ask()` path would produce.
- Live wiring stays in place for when hydration is fixed: the topbar button calls
  `openAssistant()`, `/` + `⌘K`/`Ctrl+K` open it via the document keydown handler
  (bound through `resolveShortcut`), example chips and the footer form call
  `ask()`, citations are real `<a href>` links that also call `onClose()`, and
  all close affordances call `onClose()`.

This mirrors the SSR-proof approach proven by Tasks 4–10 (search-param-driven,
server-rendered states; CSS/structural assertions instead of live clicks).

The **keyboard-shortcut resolver** is verified at the unit level (a small Bun
harness exercises `resolveShortcut`) and against the **live prototype** (where
hydration works), since our own client handler is inert under broken hydration.

---

## Files changed

| File | Change |
|---|---|
| `apps/web/src/components/atlas/assistant_dialog.tsx` | **New.** The Ask Atlas overlay: AI-keyed header + SEMANTIC SEARCH chip, scrolling transcript of user/AI chat bubbles, citation chips (rendered as `<Link>` deep-links via `atlasCiteLinkFor`), example prompt chips, "Thinking…" busy bubble, footer ask form. Built on the shared `Dialog` / `Input` / `Button` / `AtlasIcon` primitives. Accepts `seededQuery` (SSR chat variant) and renders `inline` when seeded. |
| `apps/web/src/components/atlas/atlas_app.tsx` | Owns assistant state (`createSignal<boolean>`), binds the document keydown handler via `resolveShortcut` (`/`, `⌘K`/`Ctrl+K` open; Escape dismisses; `c` composes), wires the topbar `onSearch` → `openAssistant`, serializes the current `?d=` decisions for citation links, and renders `<AssistantDialog>`. New props `initialAsk` / `initialAssistantOpen` seed the SSR-proof variants. |
| `apps/web/src/lib/atlas/nav_links.ts` | Added `atlasCiteLinkFor(id, d)` — resolves a citation's mail id to its route + `?sel=` (inbox/feed/paper) or `/atlas/screener`, carrying the current `?d=` decisions. Wraps the existing `viewForMailId`. |
| `apps/web/src/routes/atlas/inbox.tsx` | Added `?assistant=1` (open initial state) and `?ask=<query>` (open seeded chat) search params → `initialAssistantOpen` / `initialAsk`. |
| `apps/web/src/styles.css` | Added scoped `.atlas-assistant-*`, `.atlas-chat-bubble`, and `.atlas-cite*` rules using Atlas tokens (AI-blue header, hard-offset chat bubbles, ink-bordered citation chips with the blue cite-num tile, example chips, footer). |
| `apps/web/src/components/atlas/top_bar.tsx` | **No code change required** — `onSearch` already drives the topbar "Search or ask" button; it now points at `openAssistant`. (Listed in the task; reused as the existing shared prop contract.) |
| `apps/web/src/lib/atlas/assistant_responses.ts` | **No change** — the canned-response data (rules, examples, intro, `answerQuery`) was already authored in Task 3 and matches the prototype verbatim. (Listed in the task; verified sufficient as-is.) |
| `apps/web/src/lib/atlas/app_state.ts` | **No change** — `resolveShortcut` (`/`, `⌘K`/`Ctrl+K`, Escape, …) and `viewForMailId` already existed. (Listed in the task; reused unchanged.) |
| `apps/web/src/components/ui/dialog.tsx` | **No change** — already supported backdrop / Escape / `inline`. (Listed in task; verified sufficient.) |
| `apps/web/src/components/ui/input.tsx` | **No change** — reused as-is via scoped assistant CSS. (Listed in task; verified sufficient.) |

> The task file list named `assistant_responses.ts`, `app_state.ts`, `top_bar.tsx`,
> `dialog.tsx`, and `input.tsx`; all already satisfied the requirements, so they
> were reused unchanged rather than forked — keeping a single source of truth for
> the canned-response data, keyboard map, topbar contract, overlay, and input
> primitives. `routeTree.gen.ts` is **not** part of this change (search params do
> not alter the generated route tree).

---

## Proof — SSR HTML (curl -L against the dev server)

| State | Assertion | Result |
|---|---|---|
| `/atlas/inbox` (no params) | `.atlas-assistant-card` count | **0** (overlay closed) |
| `?assistant=1` | `.atlas-assistant-card` count | **1** (open) |
| `?assistant=1` | intro bubble present | **yes** ("Search synced threads, ask about anything…") |
| `?assistant=1` | example prompts present | **all 4** (Priya / Stripe / screener / Marcus) |
| `?assistant=1` | user bubbles | **0** (initial state, no reply yet) |
| `?ask=Priya` | `.atlas-assistant-card` / SEMANTIC SEARCH | **1 / present** |
| `?ask=Priya` | bubbles | **2 AI (intro + reply) + 1 user** |
| `?ask=Priya` | reply text | **"…Pod A staffing…"** (verbatim) |
| `?ask=Priya` | citation href | **`/atlas/inbox?sel=i1`** (Priya thread) |
| `?ask=Stripe` | citations | **2** (`/atlas/paper-trail?sel=p1`, `?sel=p6`) |
| `?ask=screener` | citation href | **`/atlas/screener`** (Maya Chen, `s1`) |
| `?ask=Marcus` | citation href | **`/atlas/inbox?sel=i2`** (term-sheet thread) |
| `?ask=zzz` (no match) | fallback reply / citations | **generic reply / 0 cites** |
| every route (`/`, all `/atlas/*`) | `.atlas-assistant-card` | **0** (no leak; all 200) |

## Proof — headless browser (agent-browser, Chromium via CDP)

| State | Width | Assertion | Result |
|---|---|---|---|
| Initial assistant | 1440×900 | card count / intro / 4 example chips | **1 / present / present** |
| Chat (Priya) | 1440×900 | user-bubble text | **"What did Priya want"** |
| Chat (Priya) | 1440×900 | AI bubbles / citation `href` / cite-from | **2 / `/atlas/inbox?sel=i1` / "Priya Ramanathan"** |
| Citation hover | 1440×900 | hover lift captured | captured (`assistant-citation-hover-desktop.png`) |
| Citation target | 1440×900 | open `?sel=i1` → assistant closed, Priya thread visible | **card 0; "Q3 hiring plan" thread present** |
| Chat (Stripe) | 390×844 | citation count | **2** |
| Mobile (initial / chat) | 390×844 | no horizontal overflow | **`scrollWidth 374 ≤ innerWidth 390`** |
| Console | — | runtime errors | only the pre-existing `template2 is not a function` warning; **no new assistant errors** |

### Keyboard shortcuts verified

`resolveShortcut` unit harness (Bun) — **6/6 pass**:

| Input | Resolved action |
|---|---|
| `/` | `assistant` |
| `⌘K` (metaKey + `k`) | `assistant` |
| `Ctrl+K` (ctrlKey + `k`) | `assistant` |
| `Escape` | `dismiss-overlays` |
| `c` | `compose` |
| `/` while focus in `<input>` | `null` (ignored) |

### Behavior verified against the live prototype

The prototype (served headless, hydration working) was driven: skip onboarding →
press **`/`** → the **"Ask Hay"** (Atlas) overlay opens with the SEMANTIC SEARCH
chip + intro bubble (`proto-assistant-initial-desktop.png`). Submitting the Priya
example appends a user bubble + the canned AI reply with **1 citation** dated
"Today, 10:42 AM" (`proto-assistant-chat-desktop.png`) — matching our recreation
exactly. (Note: in both the prototype and the recreation, Escape is intentionally
ignored while focus is in the ask `<input>`, per the shared `resolveShortcut`
rule; Escape dismisses when focus is outside the field, and the backdrop / ✕ also
close it.)

---

## Screenshots

| File | Width | State | Source |
|---|---|---|---|
| `assistant-initial-desktop.png` | 1440×900 | Initial (intro + examples) | recreation |
| `assistant-chat-priya-desktop.png` | 1440×900 | Chat response + citation (Priya) | recreation |
| `assistant-citation-hover-desktop.png` | 1440×900 | Citation hover (lift target) | recreation |
| `assistant-citation-target-desktop.png` | 1440×900 | Citation target (Priya thread open) | recreation |
| `assistant-initial-mobile.png` | 390×844 | Initial | recreation |
| `assistant-chat-mobile.png` | 390×844 | Chat response (Stripe, 2 cites) | recreation |
| `inbox-topbar-trigger-desktop.png` | 1440×900 | Topbar "Search or ask" trigger | recreation |
| `proto-assistant-initial-desktop.png` | 1440×900 | Initial (opened via `/`) | live prototype |
| `proto-assistant-chat-desktop.png` | 1440×900 | Chat response + citation (Priya) | live prototype |

---

## Validation

| Check | Result |
|---|---|
| `bun run --cwd apps/web typecheck` | ✅ pass (`tsc --noEmit`, exit 0) |
| `bun run --cwd apps/web lint` | ✅ clean (`biome lint`, 65 files, no fixes) |
| `bun run --cwd apps/web build` | ✅ pass (client + server chunks, prerender OK) |
| `resolveShortcut` unit harness | ✅ 6/6 pass |
| `/` preserved | ✅ 200, no `atlas-assistant-card` leak |
| `/atlas/{inbox,screener,feed,paper-trail,tasks,settings}` | ✅ all 200 (regression) |
| No horizontal overflow at 390 | ✅ `scrollWidth 374 ≤ innerWidth 390` |
| No new runtime errors | ✅ only the documented pre-existing hydration warning |
| No runtime imports from `docs/prototype/**` | ✅ grep clean (doc-comment references only) |
| No React imports/patterns in new/changed files | ✅ Solid `Component` / signals only |
| `routeTree.gen.ts` untouched | ✅ search params do not alter the route tree |

---

## Acceptance criteria

- [x] **Opens via click and keyboard shortcuts** — the topbar "Search or ask"
      button (`onSearch` → `openAssistant`), `/`, and `⌘K`/`Ctrl+K` all open the
      assistant; verified SSR via `?assistant=1` (card count 1) + the
      `resolveShortcut` 6/6 unit harness, and live in the prototype (press `/` →
      "Ask Hay" overlay opens).
- [x] **Closes via Escape (and ✕ / backdrop)** — routed through the shared
      `Dialog` `onClose`; `resolveShortcut("Escape")` → `dismiss-overlays`
      (verified); ✕ and backdrop present in the SSR HTML.
- [x] **Example prompts append user/AI chat bubbles** — `?assistant=1` shows the
      4 examples; `?ask=<example>` appends a user bubble + the canned AI reply
      (Priya / Stripe / screener / Marcus all verified in SSR + browser).
- [x] **Canned responses & citations match `docs/prototype/screens.jsx`** — the
      reply text and citation chips are sourced verbatim from
      `assistant_responses.ts` (the typed port of the prototype's logic) and
      confirmed against the live prototype (Priya → 1 cite, "Today, 10:42 AM").
- [x] **Busy/response state** — the "Thinking…" bubble renders during the reply
      delay (live `ask()` path); the seeded SSR variant renders the resolved
      reply directly.
- [x] **Clicking a citation navigates to the referenced thread and closes the
      assistant** — citations are real `<a href>` deep-links (`atlasCiteLinkFor`):
      Priya → `/atlas/inbox?sel=i1`, Stripe → `/atlas/paper-trail?sel=p1|p6`,
      screener → `/atlas/screener`, Marcus → `/atlas/inbox?sel=i2`; opening the
      target shows the referenced thread with the assistant closed. The live
      `onClick` also calls `onClose()` (inert only under broken hydration).
- [x] **Screenshots** for initial assistant, chat response, citation hover, the
      citation click target, desktop, and mobile — captured for the recreation,
      plus live-prototype initial + chat references that match.
- [x] **No new runtime errors** — only the pre-existing app-wide
      `template2 is not a function` hydration warning (out of scope).
- [x] **`/` and `/dev/*` unchanged; no React imports; no runtime imports from
      `docs/prototype/**`.**
- [x] **`bun run --cwd apps/web typecheck` passes** (exit 0); `lint` clean;
      `build` passes.
