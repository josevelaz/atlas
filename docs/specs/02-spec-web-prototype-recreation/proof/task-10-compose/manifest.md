# Task 10 — Compose Overlay & Reply Prefill Manifest

**Task:** Implement the Compose overlay and reply prefill, shared across Atlas routes
**Date:** 2026-06-05
**Surface added:** `ComposeDialog` overlay, wired into the `/atlas` mail workspace
(opened from the topbar Compose button and the thread Reply button).

---

## What shipped

A shared **Compose overlay** now lives in the Atlas mail workspace, mirroring the
prototype's `Compose` (`docs/prototype/screens.jsx`):

- **Topbar "Compose"** opens a blank **"New message"** overlay.
- **Thread "Reply"** opens a **"Reply"** overlay **prefilled** from the selected
  thread's sender (To), with a `Re:` subject and the prototype reply draft body.
- **Close** via the header ✕ button, **backdrop** click, **Discard** button, or
  **Escape** — all routed through the shared `Dialog` primitive
  (`components/ui/dialog.tsx`, which already handles backdrop + Escape).

Form fields use the prototype's **borderless compose-row** treatment: a
`60px | 1fr` grid (`From` / `To` / `Subject`), each row separated by a 2px ink
border, and a borderless body `<textarea>`. The footer splits Attach /
"Suggest reply (off)" on the left from Discard / Send on the right — verbatim
from the prototype.

### Reused primitives (no one-off components)

- **`Dialog`** (`components/ui/dialog.tsx`) — overlay shell, backdrop dismiss,
  Escape handling, and the `inline` SSR-render path. **Unchanged** by this task.
- **`Input` / `Textarea`** (`components/ui/input.tsx`) — the compose fields.
  **Unchanged** by this task; the borderless treatment is applied via scoped
  `.atlas-compose-field .atlas-input` / `.atlas-compose-body .atlas-textarea`
  CSS, not a primitive fork.
- **`Button`** — header close (ghost icon), footer Attach / Suggest / Discard /
  Send, all the shared `.atlas-btn` variants.
- **`AtlasIcon`** — `x`, `attach`, `sparkle`, `send` (all already defined).

---

## SSR-proof strategy (hydration is broken app-wide)

Client hydration is disabled by a pre-existing TanStack Start/Solid error
(`template2 is not a function`, documented in earlier tasks and out of scope
here). So live `onClick` opens cannot be relied on for proof. Instead:

- The compose open state is carried in the **`?compose=`** search param on
  `/atlas/inbox`:
  - `?compose=new` → blank **New message** overlay
  - `?compose=reply` → **Reply** prefilled from the selected row's sender
  - absent / other → closed
- When seeded from the route, `ComposeDialog` renders with **`inline`**, so the
  overlay is emitted in the **SSR HTML stream** (Portal content is not), making
  the open + prefilled states observable server-side and in a headless browser.
- Field defaults render as **`value`** (not `defaultValue`) so the prefilled
  Reply state is present in the server-rendered HTML.
- Live wiring is still in place for when hydration is fixed: the topbar Compose
  button calls `openNew()`, the thread Reply button calls `openReply(addr)`
  carrying the live thread's sender, and all close affordances call `onClose()`.

This mirrors the SSR-proof approach used by Tasks 4–9 (search-param-driven,
server-rendered states; CSS/structural assertions instead of live clicks).

---

## Files changed

| File | Change |
|---|---|
| `apps/web/src/components/atlas/compose_dialog.tsx` | **New.** The Compose overlay (New message + Reply). Renders the borderless compose-rows + body + footer through the shared `Dialog` / `Input` / `Textarea` / `Button` primitives. Exports `FROM_ADDRESS`, `REPLY_DRAFT`, `REPLY_SUBJECT`. |
| `apps/web/src/components/atlas/atlas_app.tsx` | Owns compose state (`createSignal<ComposeMode>`), wires `openNew` to the topbar and `openReply(addr)` to the thread reply, resolves the SSR-seeded reply address from `currentThread`, and renders `<ComposeDialog>`. Accepts `initialCompose` (proof variant). |
| `apps/web/src/components/atlas/top_bar.tsx` | No code change required — `onCompose` already drives the topbar Compose button; it now points at `openNew`. (Listed in the task; left as the existing shared prop contract.) |
| `apps/web/src/components/atlas/thread_view.tsx` | `onReplyClick` now carries the open thread's sender address (`onReplyClick(thread().addr)`) so the reply overlay prefills the correct recipient. |
| `apps/web/src/lib/atlas/app_state.ts` | Added `decodeComposeMode()` (parses `?compose=` → `ComposeMode`); imported the new `ComposeMode` type. |
| `apps/web/src/lib/atlas/types.ts` | Added the `ComposeMode` type (`"closed" | "new" | "reply"`). |
| `apps/web/src/routes/atlas/inbox.tsx` | Added the `?compose=` search param → `initialCompose` (SSR-proof open variant). |
| `apps/web/src/styles.css` | Added scoped `.atlas-compose-*` rules (card, head/title, borderless field rows, body textarea, footer) using Atlas tokens; the borderless treatment overrides the bordered `Input`/`Textarea` only inside the compose card. |
| `apps/web/src/components/ui/dialog.tsx` | No change — already supported backdrop/Escape/`inline`. (Listed in task; verified sufficient as-is.) |
| `apps/web/src/components/ui/input.tsx` | No change — reused as-is via scoped compose CSS. (Listed in task; verified sufficient as-is.) |

> The task file list named `dialog.tsx` and `input.tsx`; both already satisfied
> the requirements, so they were reused unchanged rather than forked — keeping a
> single source of truth for the overlay and input primitives.

---

## Proof — SSR HTML (curl against the dev server)

| State | Assertion | Result |
|---|---|---|
| `/atlas/inbox` (no `?compose`) | `.atlas-compose-card` count | **0** (overlay closed) |
| `?compose=new` | title text | **"New message"** |
| `?compose=new` | `#compose-to` value | **`""`** (blank, as expected) |
| `?compose=reply` | title text | **"Reply"** |
| `?compose=reply` | `#compose-to` value | **`priya@atlas.co`** (i1 sender) |
| `?compose=reply` | `#compose-subject` value | **`Re: Q3 hiring plan — final review`** |
| `?compose=reply` | reply draft body present | **yes** (`"Pod A: the seventh req…"`) |
| `?compose=reply` | `#compose-from` | **`rob@atlas.co` `disabled`** |
| both | footer controls | **Attach · Suggest reply (off) · Discard · Send** |
| both | close affordances | backdrop `.atlas-overlay`, `[aria-label='Close compose']`, Discard button, Escape handler — all present |

## Proof — headless browser (agent-browser, Chromium via CDP)

| State | Width | Assertion | Result |
|---|---|---|---|
| New message | 1440×900 | `.atlas-compose-card` count / title | **1 / "NEW MESSAGE"** (Bungee uppercase) |
| Reply | 1440×900 | live `#compose-to` / `#compose-subject` value | **`priya@atlas.co`** / **`Re: Q3 hiring plan — final review`** |
| New message | 390×844 | renders, no overflow | captured |
| Reply | 390×844 | `body.scrollWidth, innerWidth` | **`390, 390`** (no horizontal overflow) |
| Console | — | runtime errors | only the pre-existing `template2 is not a function` hydration warning; **no new compose-related errors** |

### Close behavior verified against the live prototype

The prototype was served and driven headless: skip onboarding → press **C**
(opens compose, prefilled because i1 is selected) → press **Escape** →
`.compose-card` count drops to **0**. This confirms the Escape/close semantics
the shared `Dialog` replicates (backdrop + Escape + button `onClose`).

### Prototype-vs-recreation parity (Reply)

The prototype's reply prefill — To `priya@atlas.co`, Subject
`Re: Q3 hiring plan — final review`, From `rob@atlas.co` (disabled), body
starting `"Priya — "` — matches the recreation **exactly**.

> **Prototype quirk noted:** the prototype renders a single `Compose` instance
> with `replyTo={currentMail ? currentMail.addr : ""}`, so its topbar Compose
> button *also* prefills when a mail is selected (it has no true "blank new
> message" path while i1 is selected). The task specifies the topbar opens a
> **new-message** overlay, so the recreation intentionally distinguishes
> `new` (blank) from `reply` (prefilled). The captured prototype reference is
> therefore the **Reply** state (`proto-compose-reply-*.png`); the recreation's
> blank New-message state (`compose-new-*.png`) is the task-correct improvement.

---

## Screenshots

| File | Width | State | Source |
|---|---|---|---|
| `compose-new-desktop.png` | 1440×900 | New message | recreation |
| `compose-reply-desktop.png` | 1440×900 | Reply (prefilled) | recreation |
| `compose-new-mobile.png` | 390×844 | New message | recreation |
| `compose-reply-mobile.png` | 390×844 | Reply (prefilled) | recreation |
| `proto-compose-reply-desktop.png` | 1440×900 | Reply (prefilled) | live prototype |
| `proto-compose-reply-mobile.png` | 390×844 | Reply (prefilled) | live prototype |

---

## Validation

| Check | Result |
|---|---|
| `bun run --cwd apps/web typecheck` | ✅ pass (`tsc --noEmit`, exit 0) |
| `bun run --cwd apps/web lint` | ✅ clean (`biome lint`, 64 files, no fixes) |
| `bun run --cwd apps/web build` | ✅ pass (client + server chunks, prerender OK) |
| `/` preserved | ✅ 200, no `atlas-compose-card` leak |
| `/atlas/inbox` `/screener` `/feed` `/settings` `/tasks` | ✅ all 200 (regression) |
| No horizontal overflow at 390 | ✅ `scrollWidth == innerWidth == 390` |
| No new runtime errors | ✅ only the documented pre-existing hydration warning |
| No runtime imports from `docs/prototype/**` | ✅ grep clean (doc-comment references only) |
| No React imports/patterns in new files | ✅ Solid `Component` / signals only |

---

## Acceptance criteria

- [x] **Compose opens from the topbar** — the topbar Compose button calls
      `openNew()` → blank **New message** overlay; proven SSR via
      `?compose=new` (title "New message", empty To) and in the browser
      (card count 1, title "NEW MESSAGE").
- [x] **Reply opens from a thread, prefilled** — the thread Reply button calls
      `openReply(thread().addr)` → **Reply** overlay prefilled with the selected
      sender (`priya@atlas.co`), `Re:` subject, and the prototype draft body;
      verified in SSR HTML and live in the browser, matching the prototype
      exactly.
- [x] **Verify prefilled values** — From `rob@atlas.co` (disabled), To
      `priya@atlas.co`, Subject `Re: Q3 hiring plan — final review`, body draft
      present; all asserted via `get value` and SSR HTML.
- [x] **Closes via close button / backdrop / Discard / Escape** — all four
      affordances present and wired through the shared `Dialog` `onClose`;
      Escape/close semantics verified live against the prototype.
- [x] **No runtime errors** — only the pre-existing app-wide
      `template2 is not a function` hydration warning (out of scope); no new
      compose-related console errors.
- [x] **Screenshots for new-message and reply at desktop and mobile** —
      captured for the recreation (`compose-{new,reply}-{desktop,mobile}.png`)
      plus live-prototype reply references; the reply state matches the prototype
      verbatim (the prototype has no true blank new-message state — documented).
- [x] **Borderless compose-row fields + footer controls match the prototype** —
      `60px | 1fr` grid rows, borderless inputs/textarea, 2px ink row dividers,
      and the Attach / Suggest-reply / Discard / Send footer, all verbatim.
- [x] **`/`, other `/atlas` routes unchanged; no React imports; no runtime
      imports from `docs/prototype/**`.**
- [x] **`bun run --cwd apps/web typecheck` passes** (exit 0); `lint` clean;
      `build` passes.
