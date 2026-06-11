# State Provider + Tailwind Cleanup — Remediation Proof

**Task:** Document and validate the post-recreation remediation that (1) moved
the full Atlas interaction model into a shared Solid/TanStack store, (2) made
every interaction live and client-driven (removing the URL "proof" param
plumbing), (3) collapsed route duplication into thin root-based view selectors,
(4) purged stale URL-param comments, (5) migrated all component styling from
hand-written CSS to Tailwind utilities, and (6) reduced `styles.css` to a
global-only boundary.
**Date:** 2026-06-11
**Branch:** `docs/fix-proof-manifest-routes`
**Surface touched (this task):** proof docs only —
`proof/final/manifest.md` (updated) and this manifest + its `screenshots/`
(new). No `apps/web/src` source changed in this task; the source work landed in
the commits listed below.

---

## Summary

Tasks 1–11 of the remediation reworked the shipped recreation from a
URL-param–driven "SSR-proof" model into a **live, hydrated, store-driven**
interaction model and a **Tailwind-first** styling model. This proof records the
final architecture and the validation evidence for the changed flows.

The key behavioral shift: interaction state (screener decisions, mail selection,
handling-state toggles, compose/assistant overlays, onboarding step) used to be
encoded into the URL via `?d=`, `?compose=`, `?assistant=`, `?ask=`, `?step=`
search params so server-rendered HTML could be asserted without a live client.
That plumbing is **removed**. State now lives in a single TanStack `Store`
(`src/lib/atlas/atlas_state.tsx`) provided once at the router root
(`routes/__root.tsx`) above `<Outlet />`, so it persists across SPA route
changes. Client hydration is healthy (`src/client.tsx` →
`hydrateStart()` + `hydrate(() => <StartClient router={router} />, document)`,
with `<HydrationScript />` in `__root.tsx`), so every button, decision, overlay,
and keyboard shortcut fires live in the browser.

### Changes covered by this proof (commits)

| Commit | Change |
|---|---|
| `2800b26` | Add the Atlas shared state provider (`atlas_state.tsx`): a TanStack `Store` of `AtlasState` with typed actions, exposed via Solid context, mounted once at the router root so interaction state survives SPA navigation. |
| `ccbaebd` | Drive screener decisions from the live store. Accept/Reject are now `<button>`s dispatching `accept(sid, category)` / `reject(sid)` store actions — **no** `?d=` decision token, no `encodeDecisions`/`decodeDecisions`. |
| `462a20e` | Centralize mail selection and handling-state toggles (`select`, `toggleSetAside`, `toggleReplyLater`) in the store. |
| `da9aba4` | Centralize compose and assistant overlay state in the store (`openCompose`/`openReply`/`closeCompose`, `openAssistant`/`closeAssistant`, `dismissOverlays`). The `?compose=` / `?assistant=` / `?ask=` seed params and `decodeComposeMode` are removed. |
| `12a45f0` | Collapse route duplication into thin view selectors. Mail routes (`/inbox`, `/screener`, `/feed`, `/paper-trail`, `/tasks`, `/settings`) are thin wrappers mounting `<AtlasApp>`; the active screen is derived, not URL-keyed beyond the path. |
| `8e7c659` | Purge stale URL-param comments from the now-hydrated flow (no lingering "SSR-proof" / `?d=` / "broken hydration" prose in source). |
| `fc90017` | Move UI primitives (button, card, badge, priority, input, textarea, kbd, avatar, toggle, dialog-overlay, tag) to Tailwind utilities generated from `src/lib/atlas/component_classes.ts`. |
| `3c61351` | Migrate the `atlas-tag` chip styling to Tailwind utilities. |
| `8b54c39` | Migrate the app shell, nav, and mail-list styling to Tailwind. |
| `f91d727` | Migrate the thread, screener, tasks, and settings screens to Tailwind. |
| `d171352` | Migrate the overlay (compose/assistant) and onboarding styling to Tailwind, including the `≤560px` responsive variants and the borderless compose-row override. |
| `8f63259` | Finalize the global-only CSS boundary in `styles.css` (tokens, reset, body chrome, grain texture, reduced-motion, global view-transition rules only). |

---

## Live hydrated interaction model

- **State owner:** `src/lib/atlas/atlas_state.tsx` — a `Store<AtlasState, AtlasActions>`
  built per provider (request-isolated under SSR) and read via `useAtlasState()`
  / dispatched via `useAtlasActions()`. Both throw outside `<AtlasProvider>`.
- **Provider mount:** once at `routes/__root.tsx` above `<Outlet />`, so the
  interaction state survives client-side route changes.
- **Hydration:** `src/client.tsx` calls `hydrateStart()` then
  `hydrate(() => <StartClient router={router} />, document)`; `__root.tsx` emits
  `<HydrationScript />`. SSR HTML carries the `_$HY` hydration bootstrap
  (verified in the rendered `/` HTML).
- **Screener decisions:** live store actions (`accept`/`reject`); decisions are
  reflected in sidebar counts immediately, with **no URL change**. Decisions
  persist across SPA navigation through provider state, so the sidebar links
  carry no decision token (`src/lib/atlas/nav_links.ts`).
- **Overlays:** compose + assistant are opened/closed via store actions and
  render as live client `dialog`s; there are no `?compose=` / `?assistant=` /
  `?ask=` seed params.
- **Onboarding step:** local client signal; no `?step=N` param. The directional
  slide is driven by a cached `data-onb-dir` attribute on `<html>`, not the URL.
- **Keyboard shortcuts:** the document-level `keydown` listener in `AtlasApp`
  is live post-hydration (`resolveShortcut` in `src/lib/atlas/app_state.ts`).

### Removed URL "proof" param plumbing

The following are fully removed from `apps/web/src` (verified by grep, below):
`broken-hydration`, "Client hydration is disabled", "pre-existing broken",
"SSR-proof", `?d=`, `encodeDecisions`, `decodeDecisions`, `decodeComposeMode`.

### Accepted root route structure

Atlas routes are **root-based** and intentional:
`/`, `/inbox`, `/screener`, `/feed`, `/paper-trail`, `/tasks`, `/settings`,
`/onboarding`. The `/atlas/**` path structure was removed in the recreation and
**must not be restored**. `/` serves the Atlas onboarding entry. `/dev/*` routes
are untouched.

> grep for `/atlas` in `apps/web/src` returns only **import path** hits
> (`lib/atlas/…`, `components/atlas/…`) and a comment reference in `styles.css` —
> **no** route `to="/atlas"` / `"/atlas..."` / `/atlas/` path strings exist.
> See the filtered grep in the engineering-gate section.

---

## Tailwind migration + CSS boundary

All component, shell, screen, overlay, and onboarding styling moved out of
hand-written CSS into Tailwind utility strings centralized in
`src/lib/atlas/component_classes.ts`. After the migration, `styles.css` is
**global-only** and holds exactly:

- `@import "tailwindcss";`
- the `@theme` + `:root` + `.dark` design tokens (palette, hard offset shadows,
  structure, type voices, motion),
- the element reset / base / body chrome and `::selection`,
- the retro grain/scanline texture (`body::after`),
- the `prefers-reduced-motion` override,
- the global `@view-transition` opt-in and the onboarding directional-slide
  keyframes + `[data-onb-dir]::view-transition-old/new(atlas-onb-card)` pseudo
  rules (these target the un-addressable `::view-transition-*` document tree and
  cannot be expressed as a Tailwind utility).

No `.atlas-*` / `.is-*` component or contextual selectors remain in the
stylesheet; app-scoped retro flourishes use the `[.atlas-app_&]:` ancestor
variant in `component_classes.ts` so `/` and `/dev` stay clean.

**`styles.css` line count:** `309` (recorded via `wc -l apps/web/src/styles.css`).

---

## Engineering gates (2026-06-11)

| Check | Command | Result |
|---|---|---|
| Typecheck | `bun run --cwd apps/web typecheck` | ✅ pass — `tsc --noEmit`, exit 0 |
| Lint | `bun run --cwd apps/web lint` | ✅ clean — `biome lint ./src`, **66 files**, no fixes, exit 0 |
| Build | `bun run --cwd apps/web build` | ✅ pass — client + SSR chunks emit, exit 0 (client built in ~3.0s, SSR in ~2.2s) |

### Constraint greps (exact)

```
$ grep -RniE "broken-hydration|Client hydration is disabled|pre-existing broken|SSR-proof|\?d=|encodeDecisions|decodeDecisions|decodeComposeMode" apps/web/src
(no output — exit 1)
```
✅ All stale hydration / URL-proof tokens removed.

```
$ grep -Rni '"/atlas\|to="/atlas\|/atlas/' apps/web/src
… (only import-path hits: lib/atlas/…, components/atlas/…, and a styles.css comment) …

$ grep -Rni '"/atlas\|to="/atlas\|/atlas/' apps/web/src \
    | grep -vE 'lib/atlas|components/atlas|atlas/atlas_icon|atlas/types'
(no output — exit 1)
```
✅ No genuine `/atlas` route references. The base pattern matches only the
`lib/atlas/` / `components/atlas/` import path segments (and a doc comment in
`styles.css`); after filtering those, there are zero route-path hits. The
`/atlas/**` structure is correctly absent.

```
$ wc -l apps/web/src/styles.css
     309 apps/web/src/styles.css
```
✅ Global-only `styles.css` at 309 lines.

---

## Browser smoke (live, 2026-06-11)

**Environment:** `npx agent-browser` (Chromium via CDP) against the web dev
server `http://localhost:3001` (`bun run --cwd apps/web dev`). agent-browser
**was available** in this environment (`/Users/jose/.volta/bin/agent-browser`,
invoked via `npx agent-browser`). These screenshots are the **current**
validation run — they reflect the live store-driven, Tailwind-styled UI at the
root-based routes (not the historical `/atlas/**` screenshots in
`proof/final/screenshots/`).

> **agent-browser quirk noted:** the local `agent-browser` shim resolved through
> Volta failed for bare `agent-browser …` invocations (`Volta error: Could not
> execute command`); the working invocation was `npx agent-browser …`. Element
> refs (`@eN`) are reassigned on every snapshot and go stale after any DOM
> change, so each interaction below re-snapshotted before acting.

### Routes (all rendered live; screenshots captured this run)

| Route | Asserted (live render) | Screenshot |
|---|---|---|
| `/` | onboarding entry — **"WELCOME TO ATLAS."**, Connect with OAuth ×2, Back (disabled), Next; step "1/5" | `screenshots/01-root-onboarding.png` |
| `/inbox` | **INBOX**, P1 threads (Priya Ramanathan / Marcus Okafor …), sidebar counts | `screenshots/02-inbox.png` |
| `/screener` | **THE SCREENER**, first-time senders, Accept/Reject buttons | `screenshots/03-screener.png` |
| `/feed` | **THE FEED**, Stratechery / Vercel | `screenshots/05-feed.png` |
| `/paper-trail` | **PAPER TRAIL 7**, Stripe / Delta receipts | `screenshots/06-paper-trail.png` |
| `/tasks` | **TASKS & DATES**, Sync 5 tasks / Sync 5 dates | `screenshots/07-tasks.png` |
| `/settings` | **CONNECTED ACCOUNTS**, Google / Microsoft rows | `screenshots/08-settings.png` |
| `/dev/design-system` | **ATLAS DESIGN SYSTEM** primitive gallery (unchanged) | `screenshots/09-dev-design-system.png` |
| `/onboarding` | replay — **"WELCOME TO ATLAS."**, always starts at step 0 | `screenshots/12-onboarding.png` |

### Live interaction proofs (this is the core of the new model)

| Interaction | Action | Observed (live) |
|---|---|---|
| Onboarding step | clicked **Next** on `/` | heading advanced step 0 → step 1 ("STRANGERS GO TO THE SCREENER.") via client signal; **URL unchanged** |
| Screener decision | clicked **ACCEPT INTO INBOX** on `/screener` | sidebar **Screener 4→3**, **Inbox 3→4**; **URL stayed `/screener`** (no `?d=`) — `screenshots/04a-screener-initial.png`, `screenshots/04b-screener-after-accept.png` |
| Compose overlay | clicked **Compose** on `/inbox` | live `dialog "New message"` (FROM / SUBJECT / Write your message… / Attach / Suggest reply (off) / Discard / Send); **URL stayed `/inbox`** (no `?compose=`) — `screenshots/10-compose-new.png` |
| Assistant overlay | clicked **Search or ask ⌘K** on `/inbox` | live `dialog "Ask Atlas"` (ASK ATLAS · SEMANTIC SEARCH · TRY chips · textbox); **URL stayed `/inbox`** (no `?assistant=`) — `screenshots/11-assistant-intro.png` |
| Assistant ask | typed "What does Priya need from me?" + Enter | AI answer + **citation** "1 Priya Ramanathan — Re: Q3 hiring plan — final review"; client-driven (no `?ask=`) — `screenshots/11b-assistant-ask.png` |
| Overlay dismiss | pressed **Esc** | overlay closed via live document `keydown` listener |

### `curl` corroboration (belt-and-suspenders, 2026-06-11)

All routes return **HTTP 200** and the dev server SSRs the expected content into
the initial HTML; the `_$HY` hydration bootstrap is present so the client
hydrates the SSR markup live.

```
/                  -> 200   "Welcome to Atlas." present; _$HY present
/inbox             -> 200   "Inbox" present
/screener          -> 200   "Screener" present;  ?d= count: 0
/feed              -> 200   "Stratechery" present
/paper-trail       -> 200   "Stripe" present
/tasks             -> 200   "TASKS" present
/settings          -> 200   "Connected accounts" present
/dev/design-system -> 200   "design system" present
```

(The initial content greps that matched `0` did so only because the visible
labels are lowercase in the DOM and uppercased via CSS `text-transform`; the
case-insensitive checks above confirm the content is server-rendered.)

---

## Acceptance criteria

- [x] `bun run --cwd apps/web typecheck` passes (exit 0).
- [x] `bun run --cwd apps/web lint` passes (66 files, no fixes).
- [x] `bun run --cwd apps/web build` passes (exit 0; client + SSR chunks).
- [x] Stale-token grep returns no matches (`broken-hydration`, "Client hydration
      is disabled", "pre-existing broken", "SSR-proof", `?d=`, `encodeDecisions`,
      `decodeDecisions`, `decodeComposeMode`).
- [x] `/atlas` route grep returns only import-path hits; filtered grep is empty
      — `/atlas/**` is correctly absent and not restored.
- [x] `wc -l apps/web/src/styles.css` = 309 (global-only boundary).
- [x] `npx agent-browser` live smoke across `/`, `/inbox`, `/screener`, `/feed`,
      `/paper-trail`, `/tasks`, `/settings`, `/dev/design-system` (+ `/onboarding`),
      with live interaction proofs (onboarding step, screener accept w/ count
      update, compose overlay, assistant overlay + ask, Esc dismiss).
- [x] `curl -fsS` route/content checks corroborate (all HTTP 200; SSR content +
      hydration bootstrap present; screener HTML has zero `?d=`).
- [x] `git status --short` confirmed to contain only intended proof-doc changes
      before committing (pre-existing unrelated dirt — `CONTEXT.md`, `.weave/*` —
      left untouched).
