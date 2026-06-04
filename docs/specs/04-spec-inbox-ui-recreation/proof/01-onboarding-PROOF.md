# Proof — Task 1.0: Protected demo route, styling foundation, and onboarding recreation

Feature: `04-spec-inbox-ui-recreation`
Parent task: **1.0 — Create the protected demo route, prototype styling foundation, and onboarding recreation**
Sub-tasks covered: 1.1, 1.2, 1.3, 1.4, 1.5
Date captured: 2026-06-04 (onboarding-parity pass re-capture)
Review viewport: **1440 × 900** (single consistent desktop viewport, resolving the spec's Open Question #1)

---

## Summary

A protected internal demo route `/dev/hay-inbox` was added to `apps/web` using
TanStack Start file routing. It renders a route-local, isolated Hay demo
component tree whose first surface is a recreated **5-step onboarding
walkthrough** matching the prototype's neobrutalist visual treatment. Dismissing
onboarding (Skip or finish) hands off to a main Hay shell surface (`AppShell`),
which exposes a "Replay onboarding" affordance.

> **Onboarding-parity pass (latest):** the onboarding flow was reworked to match
> the prototype much more closely. The prototype's exact copy/titles/order, header
> (HAY. logo chip + `Get started — N/M` mono label on the left, **Skip on the
> right**), footer (**Back — step-dots — Next/Open Hay**, with chevron icons), and
> per-step **visuals** (paired OAuth connect cards, the Maya Chen Screener card
> with Accept/Reject split, three category rows, the AI-summary card with
> extracted task/date rows, and the empty-inbox state) were all ported from
> `docs/prototype/hay-inbox-prototype.html` (the bundled prototype's
> `ONB_STEPS` / `Onboarding`). All visuals consume the existing `.hay-demo` token
> aliases — no new colors were introduced.

All prototype-specific fidelity styling lives in
`apps/web/src/components/hay-demo/hay-inbox-styles.css`, scoped under a
`.hay-demo` root class so it cannot leak into the rest of the app. Global Hay
design tokens (`apps/web/src/styles.css`) are unchanged.

---

## Acceptance evidence

### 1.1 — Protected demo route at `/dev/hay-inbox`

- Route file: `apps/web/src/routes/dev/hay-inbox.tsx`.
- TanStack Start file routing auto-registered it in `src/routeTree.gen.ts`
  (verified: `/dev/hay-inbox` entries present in the generated route tree).
- Protection: inherits the global `beforeLoad` auth guard in
  `src/routes/__root.tsx` (any non-`/auth` path requires a session) **and**
  declares its own explicit `beforeLoad` guard mirroring `/onboarding`,
  redirecting to `/auth/sign-in?redirect=%2Fdev%2Fhay-inbox` when unauthenticated.
- It does **not** replace any existing production route — it is a brand-new
  path under `/dev/`.

### 1.2 — Isolated route-local component structure + styles

New directory `apps/web/src/components/hay-demo/`:

| File | Role |
| --- | --- |
| `hay-inbox-demo.tsx` | Top-level container; coordinates onboarding ↔ shell. |
| `onboarding.tsx` | 5-step onboarding walkthrough. |
| `app-shell.tsx` | Main Hay shell handoff surface (placeholder for task 2.0). |
| `hay-inbox-styles.css` | Route-local fidelity styles, scoped under `.hay-demo`. |

Verified computed styles on the live route confirm the route-local CSS applies
and matches the prototype's neobrutalist treatment:

```
.onboarding-card  → border-width: 3px; box-shadow: 4px 4px 0 0 <main>; border-radius: 8px (--radius-lg)
.btn.primary      → background: <main>; box-shadow: offset flat shadow in <main>
.step-dot         → 5 dots rendered, 1 active on step 1
```

Global tokens untouched: `apps/web/src/styles.css` has no task-1 changes.

### 1.3 — Multi-step onboarding with forward/back/skip/finish

Five steps, ported verbatim from the prototype's `ONB_STEPS` (titles, sub-copy,
and order — Unit 1 themes):

1. **Welcome to Hay.** — mailbox connection (paired Google / Microsoft OAuth cards)
2. **Strangers go to the Screener.** — Screener explanation (Maya Chen card + Accept/Reject)
3. **Three categories. No folders to manage.** — Inbox / Feed / Paper Trail rows
4. **AI helps you triage. You stay in charge.** — AI-summary card + extracted task/date rows
5. **Hay organizes new mail. Not old mail.** — empty-inbox / new-mail-only disclosure

Branded treatment present and matching the prototype: **HAY.** logo chip +
`Get started — N/M` mono label in the **left** of the card header, **Skip** on the
**right**; in the footer, **Back** (left, chevron-left, disabled on step 1) —
**step-dots** (center, only the current step active) — **Next / Open Hay** (right,
chevron-right). Navigation logic is local-state only (`createSignal`), clamps to
`[0, 4]`, and calls `onFinish` on Skip / final-step.

Screenshot set (one per step, captured at 1440×900):

| Step | File | Title shown |
| --- | --- | --- |
| 1 | `01-onboarding-step1-connect.png` | Welcome to Hay. |
| 2 | `01-onboarding-step2-screener.png` | Strangers go to the Screener. |
| 3 | `01-onboarding-step3-categories.png` | Three categories. No folders to manage. |
| 4 | `01-onboarding-step4-assistant.png` | AI helps you triage. You stay in charge. |
| 5 | `01-onboarding-step5-new-mail-only.png` | Hay organizes new mail. Not old mail. |

These steps were also captured by **clicking the Next control in-browser**
(not via `?step=N`), proving the click-driven transitions work end-to-end. The
click-driven captures live alongside the deterministic deep-link set:

| Step | Click-driven capture | Title reached via click |
| --- | --- | --- |
| 1 | `01-onboarding-interactive-step1.png` | Welcome to Hay. |
| 2 | `01-onboarding-interactive-step2.png` | Strangers go to the Screener. |
| 3 | `01-onboarding-interactive-step3.png` | Three categories. No folders to manage. |
| 4 | `01-onboarding-interactive-step4.png` | AI helps you triage. You stay in charge. |
| 5 | `01-onboarding-interactive-step5.png` | Hay organizes new mail. Not old mail. |
| shell | `01-onboarding-interactive-shell.png` | Hay shell (after **Open Hay**) |

The original `?step=N` deep-link set (`01-onboarding-step{1..5}-*.png`) is also
retained; the route still exposes the `?step=N` deep-link via `validateSearch`.

### 1.4 — Onboarding is the default first-run surface, hands off to shell

- `HayInboxDemo` initialises `showOnboarding = true`, so onboarding is the
  default surface on load.
- `<Show when={showOnboarding()} fallback={<AppShell …/>}>` renders the shell
  once onboarding is dismissed (`onFinish` sets `showOnboarding = false`).
- `AppShell` exposes a **Replay onboarding** button wired to set
  `showOnboarding = true`, returning to the walkthrough.

### 1.5 — Compiles cleanly, ready for proof capture

```
$ bun run --cwd apps/web typecheck   → exit 0
$ bun run --cwd apps/web lint         → exit 0 (Checked 40 files, no fixes)
$ bun run --cwd apps/web build        → exit 0 (hay-inbox + onboarding chunks emitted)
```

---

## Browser validation (`npx agent-browser`)

- URL exercised: `http://localhost:3001/dev/hay-inbox` against a production
  build served by `vite preview --port 3001` (port 3001 is the CORS-trusted
  origin in `apps/server` config, so the auth guard resolves correctly).
- Authentication for the guarded route was satisfied by stubbing
  `GET /api/auth/get-session` with a valid demo session via
  `agent-browser network route` (no source code was modified to bypass auth).
- The demo route **renders and hydrates cleanly**: `globalThis._$HY` and
  `$_TSR` hydration completes, with **zero console errors/warnings** and **zero
  page errors** across the full interactive flow.

### Interactive navigation — verified end-to-end (click-driven)

The following were exercised by **real clicks** in-browser (not `?step=N`) during
the onboarding-parity re-capture:

- **Next** advances Step 1 → 2 → 3 → 4 → 5 (title + `Get started — N/5` counter
  update reactively on each click).
- **Back** returns Step 5 → 4 (counter read confirmed `GET STARTED — 4/5`) and is
  **disabled** on Step 1.
- **Skip** dismisses onboarding and hands off to the `AppShell`
  (`[data-testid=hay-shell]` count = 1).
- **Open Hay** (final-step Next label) dismisses onboarding → `AppShell` (full nav,
  mail rows, AI usage card all render).
- **Replay onboarding** (shell affordance) returns to Step 1 (`GET STARTED — 1/5`).

All transitions confirmed via the live `data-testid=ob-step-counter` /
`.ob-step h1` (title) / `data-testid=hay-shell` DOM reads after each click.
Console was cleared and re-checked after a hard reload: **zero errors / zero
warnings** on the demo page across the full interactive flow.

### Computed-style token check (no invented colors)

Live `getComputedStyle` reads on Step 1 confirm the reworked visuals consume the
existing `.hay-demo` token aliases (which map onto the global Hay tokens), not
hard-coded colors:

```
.onboarding-card        → border-width 3px; border-radius 8px; box-shadow 4px 4px 0 0 <main>
.logo                   → background <main>; box-shadow 2px 2px 0 0 <border>
.ob-title               → font-size 32px
.ob-connect-icon.is-google → background <main>   (prototype used var(--main) for the Google chip)
.btn.sm.primary         → background <main>
.step-dot.active        → background <main>
```

> **Known remaining mismatch (out of scope for this pass):** the global
> `--color-main` token in `apps/web/src/styles.css` resolves to a blue/purple
> (`oklch(66.34% 0.1806 277.2)`), whereas the prototype's `--main` is the yellow
> `#FACC00`. This affects the HAY. logo chip and all primary buttons **app-wide**
> (the main shell already renders them blue), so it is a global-token concern, not
> an onboarding-specific one. The onboarding now matches the prototype's
> *structure and token usage* exactly; aligning the `--color-main` value is a
> separate, broader change deliberately left untouched here per the task's
> "do not modify other major mismatch areas yet" constraint.

### Root-cause fix that unblocked in-browser interaction

The previous attempt could not exercise click-driven transitions because client
hydration silently failed **app-wide** (handlers never attached). Three issues
were diagnosed and fixed:

1. **`apps/web/src/lib/auth.ts`** — the Better Auth client was constructed at
   import time with a **relative** `baseURL` (`/api/auth`) when
   `VITE_API_BASE_URL` is unset. Better Auth throws `Invalid base URL` for a
   relative URL, which crashed the entire client bundle before hydration could
   start. Fixed by always resolving an **absolute** URL (anchored to
   `window.location.origin` on the client).
2. **`apps/web/src/routes/__root.tsx`** — the root document did not render
   Solid's **`<HydrationScript />`**, so `globalThis._$HY` was never emitted and
   the client `hydrate()` threw
   `TypeError: Cannot read properties of undefined (reading 'done')`. Added
   `<HydrationScript />` to the document `<head>` (matches the official
   TanStack Start Solid root entry).
3. **`apps/web/src/client.tsx`** — the client entry used `render()` instead of
   the canonical Solid `hydrate()` for SSR'd markup. Switched to `hydrate()` per
   the official `@tanstack/solid-start` Solid client entry.
4. **`apps/web/vite.config.ts`** — restored the documented SPA config
   `tanstackStart({ spa: { enabled: true, prerender: { outputPath: "/index" } } })`
   per `AGENTS.md`.

After these fixes, the home route and `/auth/sign-in` route also hydrate and
render correctly (no regression to the existing auth/home interaction model).

> Note: an `AbortError: Transition was skipped` (a benign, non-console router
> view-transition rejection) was observed only when the route additionally
> declared `ssr: false`; that experiment was reverted, and the final build has
> **zero** page/console errors.

---

## Files added/changed for task 1

Initial implementation (commit `99e95e7`):

- `apps/web/src/routes/dev/hay-inbox.tsx` (new)
- `apps/web/src/components/hay-demo/hay-inbox-demo.tsx` (new)
- `apps/web/src/components/hay-demo/onboarding.tsx` (new)
- `apps/web/src/components/hay-demo/app-shell.tsx` (new)
- `apps/web/src/components/hay-demo/hay-inbox-styles.css` (new)
- `apps/web/src/routeTree.gen.ts` (regenerated by the router plugin)
- `docs/specs/04-spec-inbox-ui-recreation/04-tasks-inbox-ui-recreation.md` (task state)
- `docs/specs/04-spec-inbox-ui-recreation/proof/01-onboarding-step*.png` (deep-link proof set)

In-browser interaction fix (retry):

- `apps/web/vite.config.ts` — restored documented SPA config.
- `apps/web/src/lib/auth.ts` — always resolve an absolute Better Auth `baseURL`.
- `apps/web/src/routes/__root.tsx` — render Solid `<HydrationScript />`.
- `apps/web/src/client.tsx` — use canonical Solid `hydrate()`.
- `docs/specs/04-spec-inbox-ui-recreation/proof/01-onboarding-interactive-*.png`
  (click-driven proof set: 5 steps + shell handoff).
- `docs/specs/04-spec-inbox-ui-recreation/proof/01-onboarding-PROOF.md` (this file).

Onboarding-parity pass (latest):

- `apps/web/src/components/hay-demo/onboarding.tsx` — reworked to port the
  prototype's exact copy/titles/order, header (logo chip + `Get started — N/M`
  + Skip-right), footer (Back / dots / Next-or-Open-Hay with chevrons), and the
  five per-step visuals (connect cards, Screener card, category rows, AI-summary
  card, empty-inbox state). Behavior (Back / Next / Skip / Open Hay / replay /
  `?step=N` deep-link / `initialStep`) preserved.
- `apps/web/src/components/hay-demo/hay-inbox-styles.css` — replaced the generic
  `.ob-icon` / `.ob-preview` / `.ob-chip` step-content styles with
  prototype-faithful `.ob-title` / `.ob-sub` / `.ob-connect-*` / `.ob-screener-*`
  / `.ob-cat-*` / `.ob-ai-*` / `.ob-extract-*` / `.ob-empty-*` rules, all scoped
  under `.hay-demo` and consuming existing token aliases. Removed the now-unused
  `.wordmark` rule.
- `docs/specs/04-spec-inbox-ui-recreation/proof/01-onboarding-step*.png` and
  `01-onboarding-interactive-*.png` — re-captured against the corrected UI at
  1440×900.
