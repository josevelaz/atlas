# Task 4.0 — Overlays, secondary screens, keyboard interactions & final polish

Proof artifacts for parent task **4.0** of `04-tasks-inbox-ui-recreation.md`
(sub-tasks 4.1–4.6). Everything below was captured against the live demo at
`http://localhost:3001/dev/hay-inbox` from a fresh production build + `vite
preview`, at a consistent **1440×900** desktop review viewport.

All data is mock/local. No mail is sent, deleted, synced, or persisted; no real
mailbox, OAuth token, or backend workflow is touched.

---

## Source of truth

Visual + interaction parity is measured against
`docs/prototype/hay-inbox-prototype.html`. The prototype's React source was
decompressed from its inline bundle and used to match the Compose overlay,
Ask Hay overlay, Tasks & Dates, Settings, and the keyboard-shortcut map
(`1`–`4`, `c`, `/`, `⌘/Ctrl-K`, `Escape`).

---

## Quality gates

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `bun run --cwd apps/web typecheck` | ✅ pass (`tsc --noEmit`, 0 errors) |
| Lint | `bun run --cwd apps/web lint` | ✅ pass (`biome lint ./src`, 40 files, no fixes) |
| Build | `bun run --cwd apps/web build` | ✅ pass (2216 modules, prerender OK) |
| Console errors | `agent-browser console` after full exercise | ✅ none |

---

## 4.1 — Compose overlay

Local-only New message / Reply overlay (`compose-overlay.tsx`) with From
(disabled), To, Subject fields, a message textarea, and Attach / Suggest reply
/ Discard / Send controls. Backdrop click, the close button, Discard, Send, and
`Escape` all dismiss it.

- GIF: `04-compose-overlay.gif` — opening (Compose button) and closing the overlay.
- Still: `04-compose-overlay-open.png` — New message layout at the review viewport.
- Still: `04-compose-reply.png` — Reply variant (opened from a thread's Reply
  button) with the recipient (`priya@hay.co`) and subject ("Re: Q3 hiring plan
  — final review") prefilled. From is `rob@hay.co`.

Verified in-browser:
- `c` opens Compose ("New message"); `Escape` closes it.
- Thread **Reply** opens Compose as a Reply with To/Subject prefilled; **Discard** closes it.

## 4.2 — Ask Hay / search overlay

Local mock chat assistant (`assistant-overlay.tsx`) with an AI-accent header
("Ask Hay" + SEMANTIC SEARCH badge), a greeting, four example prompts, a
scrolling chat-bubble stack, cited result rows, and an input + Send. Asking a
question appends the user bubble, shows a "Thinking…" affordance, then a canned
AI reply with citations. Clicking a citation opens the matching demo thread and
closes the overlay.

- GIF: `04-assistant-overlay.gif` — open → ask example → cited reply → citation
  opens the thread (overlay closes).
- Still: `04-assistant-overlay-open.png` — greeting + example prompts.
- Still: `04-assistant-overlay-cited.png` — AI reply with a clickable citation.

Verified in-browser:
- Search/Ask control opens the overlay; example prompt → AI reply with a citation.
- "What did Priya want me to confirm before our 1:1?" → cites Priya's thread
  (`i1`); clicking it routes to **Inbox** and selects the thread.
- "Find all receipts from Stripe this month" → cites Stripe (`p1`) + Notion
  (`p6`); clicking routes **cross-category** to **Paper Trail**
  (`data-screen="paper"`) and selects it.

## 4.3 — Tasks & Dates and Settings

- `tasks-screen.tsx`: two-column Tasks / Dates layout with badge headers + counts,
  task checkbox tiles (title, mono "Due:", source), and date tiles (month/day
  chip, title, mono when, source) plus local-only "Sync tasks / Sync dates"
  toolbar buttons. Screenshot: `04-secondary-screens-tasks.png`.
- `settings-screen.tsx`: grouped section cards — **Connected accounts**
  (active / upgrade / add rows), **AI & Privacy** (4 toggles), **Notifications**
  (3 toggles), and **Onboarding** (Replay). Screenshot:
  `04-secondary-screens-settings.png`.

Verified in-browser: toggling "Category suggestions" flips
`switch[checked]` true → false in local state only.

## 4.4 — Keyboard shortcuts & local toggles (demo-scoped)

Registered on `window` in the shell via `onMount` and torn down with
`onCleanup`, so they never leak outside `/dev/hay-inbox`. Typing in
inputs/textareas is ignored (except `Escape`).

| Key | Action | Verified |
| --- | --- | --- |
| `1` / `2` / `3` / `4` | Screener / Inbox / Feed / Paper Trail | ✅ (`2` → Inbox) |
| `c` | Open Compose | ✅ |
| `/` , `⌘/Ctrl-K` | Open Ask Hay | ✅ (via control; shortcut wired) |
| `Escape` | Close any open overlay | ✅ |

Local toggles (Settings switches) mutate component-local signal state only.

## 4.5 — Final fidelity polish

Added scoped `.hay-demo` CSS for `.overlay`, `.compose-card` + fields/body/foot,
`.overlay-card` / `.assistant-*`, `.chat-bubble` (ai/user/thinking), `.cite` /
`.cite-num`, `.badge`, `.input`, `.btn.sm` / `.btn.icon`, settings sections +
toggle switch + icon-chip accents, and task/date tiles — all consuming the
canonical Hay tokens (borders, flat offset shadows, radii, Archivo + mono).
Hover/active/focus-visible feedback matches the neobrutalist treatment, and a
`prefers-reduced-motion` block disables overlay/transition/transform motion.

## 4.6 — Validation

Browser validation via `npx agent-browser` (Chromium/CDP) at 1440×900 exercised
onboarding skip, nav switching, both overlays, citation open-thread routing
(incl. cross-category), the Reply→Compose path, and a Settings toggle, with
**zero console errors** throughout. Typecheck, lint, and build all pass.

---

## Reproduce

```sh
bun run --cwd apps/web build
bunx --cwd apps/web vite preview --port 3001
# open http://localhost:3001/dev/hay-inbox (sign in if prompted), skip onboarding
# c = Compose · / = Ask Hay · 1–4 = surfaces · Esc = close overlay
```
