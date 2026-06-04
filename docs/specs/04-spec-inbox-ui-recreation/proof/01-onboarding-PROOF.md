# Proof — Task 1.0: Protected demo route, styling foundation, and onboarding recreation

Feature: `04-spec-inbox-ui-recreation`
Parent task: **1.0 — Create the protected demo route, prototype styling foundation, and onboarding recreation**
Sub-tasks covered: 1.1, 1.2, 1.3, 1.4, 1.5
Date captured: 2026-06-04
Review viewport: **1440 × 900** (single consistent desktop viewport, resolving the spec's Open Question #1)

---

## Summary

A protected internal demo route `/dev/hay-inbox` was added to `apps/web` using
TanStack Start file routing. It renders a route-local, isolated Hay demo
component tree whose first surface is a recreated **5-step onboarding
walkthrough** matching the prototype's neobrutalist visual treatment. Dismissing
onboarding (Skip or finish) hands off to a main Hay shell surface (`AppShell`),
which exposes a "Replay onboarding" affordance.

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

Five steps, matching the spec's required onboarding themes (Unit 1):

1. **Connect your mailbox** — mailbox connection
2. **The Screener decides who gets in** — Screener explanation
3. **Everything sorts into categories** — category explanation (Inbox / Feed / Paper)
4. **Ask Hay anything** — AI assistance explanation
5. **New mail only** — new-mail-only disclosure

Branded treatment present: **HAY** wordmark + "Step N of 5" mono label in the
card header, step-dot progress indicator, and **Back / Skip / Next** (→ **Open Hay**
on the final step) controls in the footer. Navigation logic is local-state only
(`createSignal`), clamps to `[0, 4]`, and calls `onFinish` on Skip / final-step.

Screenshot set (one per step, captured at 1440×900):

| Step | File | Header shown |
| --- | --- | --- |
| 1 | `01-onboarding-step1-connect.png` | Step 1 of 5 — Connect your mailbox |
| 2 | `01-onboarding-step2-screener.png` | Step 2 of 5 — The Screener decides who gets in |
| 3 | `01-onboarding-step3-categories.png` | Step 3 of 5 — Everything sorts into categories |
| 4 | `01-onboarding-step4-assistant.png` | Step 4 of 5 — Ask Hay anything |
| 5 | `01-onboarding-step5-new-mail-only.png` | Step 5 of 5 — New mail only |

These steps were also captured by **clicking the Next control in-browser**
(not via `?step=N`), proving the click-driven transitions work end-to-end. The
click-driven captures live alongside the deterministic deep-link set:

| Step | Click-driven capture | Heading reached via click |
| --- | --- | --- |
| 1 | `01-onboarding-interactive-step1.png` | Connect your mailbox |
| 2 | `01-onboarding-interactive-step2.png` | The Screener decides who gets in |
| 3 | `01-onboarding-interactive-step3.png` | Everything sorts into categories |
| 4 | `01-onboarding-interactive-step4.png` | Ask Hay anything |
| 5 | `01-onboarding-interactive-step5.png` | New mail only |
| shell | `01-onboarding-interactive-shell.png` | "You're in." (after **Open Hay**) |

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
$ bun run --cwd apps/web lint         → exit 0 (Checked 30 files, no fixes)
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

The following were exercised by **real clicks** in-browser (not `?step=N`):

- **Next** advances Step 1 → 2 → 3 → 4 → 5 (heading + "Step N of 5" counter
  update reactively on each click).
- **Back** returns Step 5 → 4 (and is hidden on Step 1).
- **Skip** dismisses onboarding and hands off to the `AppShell` ("You're in.").
- **Open Hay** (final-step Next label) dismisses onboarding → `AppShell`.
- **Replay onboarding** (shell affordance) returns to Step 1 of 5.

All transitions confirmed via the live `data-testid=ob-step-counter` /
`.ob-step h2` / `data-testid=hay-shell` DOM reads after each click.

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
