# Task 01 — Baseline Manifest

**Task:** Lock the parity baseline and validation workflow  
**Date:** 2026-06-05  
**HEAD commit:** `708b9ad feat: design system — tokens, DESIGN.md, base components (#20)`

---

## Dirty Worktree Baseline (`git status --short`)

```
 M DESIGN.md
 D docs/prototype/hay-inbox-prototype.html
?? .weave/plans/web-prototype-recreation.md
?? "docs/prototype/Atlas Logo.html"
?? docs/prototype/Atlas.html
?? docs/prototype/DESIGN.md
?? docs/prototype/app.jsx
?? docs/prototype/data.jsx
?? docs/prototype/design-canvas.jsx
?? docs/prototype/icons.jsx
?? docs/prototype/onboarding.jsx
?? docs/prototype/retro.css
?? docs/prototype/screens.jsx
?? docs/prototype/screenshots/
?? docs/prototype/styles.css
?? docs/prototype/tweaks-panel.jsx
?? docs/specs/02-spec-web-prototype-recreation/
```

**Pre-existing changes preserved.** No files were modified to establish this baseline.

---

## Prototype Server

Served from: `docs/prototype/Atlas.html`  
Command: `cd docs/prototype && python3 -m http.server 8765`  
URL: `http://localhost:8765/Atlas.html`

Verified: HTTP 200 response confirmed before screenshot capture.

---

## agent-browser Workflow

Loaded via: `npx agent-browser skills get core`  
Version: loaded from installed CLI (npx)  
Viewport control: `npx agent-browser set viewport {width} {height}`  
Screenshot: `npx agent-browser screenshot {path}`

---

## Screenshots Captured

All screenshots are in `screenshots/` relative to this manifest.

### 1440x900 — Desktop (primary)

| File | Screen | State | Notes |
|---|---|---|---|
| `1440x900-onboarding-step1.png` | Onboarding | Step 1/5 — Welcome to Atlas | Connect with OAuth buttons visible |
| `1440x900-onboarding-step2.png` | Onboarding | Step 2/5 — Strangers go to the Screener | |
| `1440x900-onboarding-step3.png` | Onboarding | Step 3/5 — Three categories. No folders to manage | |
| `1440x900-onboarding-step4.png` | Onboarding | Step 4/5 — AI helps you triage. You stay in charge | |
| `1440x900-onboarding-step5.png` | Onboarding | Step 5/5 — Atlas organizes new mail. Not old mail | Open Atlas button visible |
| `1440x900-inbox-default.png` | Inbox | Default — first mail selected | 3-column layout, mail detail visible |
| `1440x900-screener.png` | Screener | Default — pending items | Accept/reject actions visible |
| `1440x900-feed.png` | Feed | Default | |
| `1440x900-paper-trail.png` | Paper Trail | Default | |
| `1440x900-tasks.png` | Tasks & Dates | Default | |
| `1440x900-settings.png` | Settings | Default | |
| `1440x900-compose.png` | Compose | Overlay open | Reply compose panel visible |
| `1440x900-assistant-initial.png` | Assistant | Initial state | "Ask Atlas" overlay, semantic search prompt |

### 1024x768 — Small laptop / tablet landscape

| File | Screen | State |
|---|---|---|
| `1024x768-inbox-default.png` | Inbox | Default |
| `1024x768-screener.png` | Screener | Default |

### 768x1024 — Tablet portrait

| File | Screen | State |
|---|---|---|
| `768x1024-inbox-default.png` | Inbox | Default |
| `768x1024-screener.png` | Screener | Default |

### 390x844 — Mobile (iPhone 14 Pro)

| File | Screen | State |
|---|---|---|
| `390x844-inbox-default.png` | Inbox | Default |
| `390x844-screener.png` | Screener | Default |

---

## Prototype Structure Notes

The prototype is a React 18 SPA (Babel standalone, no build step) with:

- **`app.jsx`** — root `App` component; manages `view`, `selected`, `composeOpen`, `assistantOpen` state
- **`screens.jsx`** — all screen components: `MailList`, `MailDetail`, `Screener`, `Feed`, `Paper`, `Tasks`, `Settings`, `Compose`, `Assistant`
- **`onboarding.jsx`** — 5-step onboarding walkthrough
- **`data.jsx`** — `SAMPLE` data: `screener`, `inbox`, `feed`, `paper`, `threadBody`
- **`icons.jsx`** — `Icon` component with named SVG icons
- **`tweaks-panel.jsx`** — design tweak panel (accent color, shadow, dark mode, font)
- **`styles.css`** + **`retro.css`** — base styles and retro/neobrutalist overrides

### Navigation model

- Sidebar nav items: Screener, Inbox, Feed, Paper Trail, Tasks & Dates, Settings
- Compose: opens as overlay via `composeOpen` state (triggered by Compose button or `C` key)
- Assistant: opens as overlay via `assistantOpen` state (triggered by "Search or ask" button or `⌘K`)
- Onboarding: shown on first load; re-accessible via "Replay onboarding" sidebar link

### Keyboard shortcuts (from `app.jsx`)

| Key | Action |
|---|---|
| `1` | Screener |
| `2` | Inbox |
| `3` | Feed |
| `4` | Paper Trail |
| `5` | Tasks |
| `C` | Open Compose |
| `⌘K` / `/` | Open Assistant |
| `Escape` | Close overlays |

---

## Acceptance Criteria Status

- [x] `git status --short` recorded with pre-existing changes
- [x] Prototype served from `docs/prototype/Atlas.html`
- [x] Baseline screenshots captured (onboarding steps 1-5, inbox, screener, feed, paper trail, tasks, settings, compose, assistant)
- [x] All 4 viewport sizes covered (1440x900, 1024x768, 768x1024, 390x844)
- [x] Proof README defines viewport matrix, naming convention, and proof rule
- [x] This manifest documents commands, baseline state, and screenshot inventory
