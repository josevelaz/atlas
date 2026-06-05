# Proof — Web Prototype Recreation

This directory holds visual proof artifacts for every UI task in the
`02-spec-web-prototype-recreation` spec. Each task appends its own
subdirectory here.

---

## Purpose

Every UI task **must** compare app screenshots against the corresponding
prototype state before the task is marked complete. This README defines
the shared conventions all tasks follow.

---

## Viewport Matrix

| Label | Width | Height | Target device |
|---|---|---|---|
| `1440x900` | 1440 | 900 | Desktop (primary) |
| `1024x768` | 1024 | 768 | Small laptop / tablet landscape |
| `768x1024` | 768 | 1024 | Tablet portrait |
| `390x844` | 390 | 844 | Mobile (iPhone 14 Pro) |

All screenshots are captured at 1× device pixel ratio unless noted.

---

## Screenshot Naming Convention

```
{viewport}-{screen}-{state}.png
```

Examples:
- `1440x900-inbox-default.png` — inbox at desktop, default state
- `390x844-screener.png` — screener at mobile
- `1440x900-onboarding-step1.png` — onboarding step 1 at desktop
- `1440x900-compose.png` — compose overlay open at desktop
- `1440x900-assistant-initial.png` — assistant overlay, initial state

**Segments:**
- `{viewport}` — one of `1440x900`, `1024x768`, `768x1024`, `390x844`
- `{screen}` — one of `onboarding`, `inbox`, `screener`, `feed`, `paper-trail`, `tasks`, `settings`, `compose`, `assistant`
- `{state}` — optional qualifier: `default`, `step1`–`step5`, `initial`, `empty`, `selected`, etc.

---

## Prototype Source

The source-of-truth prototype is served from:

```
docs/prototype/Atlas.html
```

Serve it locally with:

```sh
cd docs/prototype && python3 -m http.server 8765
# then open http://localhost:8765/Atlas.html
```

The prototype is a self-contained React app (Babel standalone, no build step).
It loads `styles.css`, `retro.css`, `data.jsx`, `icons.jsx`, `screens.jsx`,
`onboarding.jsx`, `app.jsx`, and `tweaks-panel.jsx` from the same directory.

---

## Proof Rule

> **Every UI task must capture side-by-side or equivalent visual comparison
> screenshots of the app against the prototype before the task is marked
> complete. Any visual mismatch in spacing, typography, color, border, radius,
> shadow, layout, or responsive behavior blocks task completion.**

Workflow per task:
1. Serve the prototype at `http://localhost:8765/Atlas.html`
2. Serve the app dev server (typically `http://localhost:3001`)
3. For each affected screen and viewport, capture:
   - `prototype/{viewport}-{screen}-{state}.png`
   - `app/{viewport}-{screen}-{state}.png`
4. Record the comparison result in the task's `manifest.md`
5. If any mismatch is found, fix it before committing

---

## Task Directories

| Task | Directory | Status |
|---|---|---|
| Task 01 — Baseline | `task-01-baseline/` | ✅ complete |
| Task 05 — Onboarding entry & replay | `task-05-onboarding/` | ✅ complete |
| Task 06 — Screener route & accept/reject | `task-06-screener/` | ✅ complete |
| Task 07 — Feed & Paper Trail routes | `task-07-feed-paper/` | ✅ complete |

---

## Screens Covered by Baseline

The following prototype states are captured in `task-01-baseline/screenshots/`:

| Screen | States captured | Viewports |
|---|---|---|
| Onboarding | step1, step2, step3, step4, step5 | 1440x900 |
| Inbox | default | 1440x900, 1024x768, 768x1024, 390x844 |
| Screener | default | 1440x900, 1024x768, 768x1024, 390x844 |
| Feed | default | 1440x900 |
| Paper Trail | default | 1440x900 |
| Tasks & Dates | default | 1440x900 |
| Settings | default | 1440x900 |
| Compose | overlay open | 1440x900 |
| Assistant | initial state | 1440x900 |
