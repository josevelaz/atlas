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

Each step was rendered via the `?step=N` deep-link the route exposes
(`validateSearch` → `initialStep`), which deterministically renders any step's
true content/layout (verified server-side: `?step=3` renders "Everything sorts…").

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

- URL exercised: `http://localhost:3001/dev/hay-inbox` (and `?step=1..5`).
- The demo route renders with **zero console errors** and **zero network
  errors** (favicon 404 is the only request miss and is unrelated/benign).
- Route-local CSS verified to apply via computed styles (see 1.2).
- All 5 onboarding steps verified to render the correct counter + heading.

### Known environment limitation (pre-existing, app-wide — NOT introduced by task 1)

In the current `apps/web` dev **and** production-preview builds, client
**hydration does not attach interactive event handlers** for any route. This was
proven independent of task 1:

- A top-level `onMount` in the demo component never fires.
- The pre-existing home route's **"Sign out"** button is equally non-functional.
- `apps/web/vite.config.ts` on `main` uses `tanstackStart()` **without** the
  `spa: { enabled: true, prerender: { outputPath: "/index" } }` configuration
  that `AGENTS.md` documents as **required**. The committed config omits it.

Because of this, click-driven step transitions cannot be exercised in-browser at
this time. To keep task 1 scoped (it must not replace production routes or
re-architect the app's render mode), the SSR-rendered `?step=N` deep-link was
used to capture each step's true rendered output as proof, and the navigation
logic itself is verified by `tsc` and code review. Restoring the documented
`spa.enabled`/`prerender` Vite config (an app-wide infrastructure fix) is the
correct follow-up to enable full click-through interaction proof — tracked as a
discrepancy in the task report rather than silently expanding task 1's scope.

---

## Files added/changed for task 1

- `apps/web/src/routes/dev/hay-inbox.tsx` (new)
- `apps/web/src/components/hay-demo/hay-inbox-demo.tsx` (new)
- `apps/web/src/components/hay-demo/onboarding.tsx` (new)
- `apps/web/src/components/hay-demo/app-shell.tsx` (new)
- `apps/web/src/components/hay-demo/hay-inbox-styles.css` (new)
- `apps/web/src/routeTree.gen.ts` (regenerated by the router plugin)
- `docs/specs/04-spec-inbox-ui-recreation/04-tasks-inbox-ui-recreation.md` (task state)
- `docs/specs/04-spec-inbox-ui-recreation/proof/01-onboarding-*.png` (proof set)
- `docs/specs/04-spec-inbox-ui-recreation/proof/01-onboarding-PROOF.md` (this file)
