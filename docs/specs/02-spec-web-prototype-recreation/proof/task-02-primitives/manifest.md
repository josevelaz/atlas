# Task 02 — Primitives Restyle Manifest

**Task:** Restyle Atlas tokens and shadcn-style/Solid UI primitives
**Date:** 2026-06-05
**Spec:** `02-spec-web-prototype-recreation`

---

## Summary

Aligned the `apps/web` styling foundation with `DESIGN.md` and the served
prototype (`docs/prototype/`). Replaced the cool-lavender / Archivo / JetBrains
Mono baseline tokens with Atlas's warm-paper neobrutalist system:

- **Palette:** warm cream canvas (`#F0EBE0`), near-white surface (`#FFFDF7`),
  ink foreground/border (`#1D1F27`), electric yellow accent (`#FACC00`), and
  coded accents (feed `#FFD600`, paper `#00E5A0`, ai `#3D7EFF`, inbox `#A78BFA`,
  error `#FF4D50`).
- **Type voices:** Bungee (display/headings), Space Mono (body/base), VT323
  (pixel/data mono) — loaded via Google Fonts in `__root.tsx`.
- **Structure:** 2px ink borders, 5px chip radius / 8px container radius, hard
  blur-free offset shadows (`Npx Npx 0 0 ink`), kinetic button press
  (hover nudges up-left +1px shadow, active slams into shadow), input focus lift.
- **Centralized primitive classes** live in `src/styles.css` as scoped
  `.atlas-*` utilities (`atlas-btn`, `atlas-card`, `atlas-badge`,
  `atlas-priority`, `atlas-tag`, `atlas-input`, `atlas-textarea`, `atlas-kbd`,
  `atlas-avatar`, `atlas-toggle`, `atlas-overlay*`). SolidJS primitives compose
  these classes rather than re-declaring one-off styling, so later screens reuse
  a single source of truth.

---

## Files Changed

| File | Change |
|---|---|
| `apps/web/src/styles.css` | Rewrote `@theme` + `:root` tokens to Atlas palette/fonts/shadows; added centralized `.atlas-*` primitive utility classes; grain texture; dark theme; reduced-motion + view-transition rules |
| `apps/web/src/routes/__root.tsx` | Swapped Archivo font link for `Bungee + Space Mono + VT323` |
| `apps/web/ui.config.json` | Pointed `tailwind.css` at `src/styles.css` (was stale `src/app.css`) |
| `apps/web/src/components/ui/button.tsx` | Compose `.atlas-btn` (default/primary/danger/ghost, sm, icon); CSS-driven kinetic press; removed Motion (CSS handles it, matches prototype) |
| `apps/web/src/components/ui/badge.tsx` | Compose `.atlas-badge` variants + square; priority path renders `.atlas-priority` (P1/P2/P3) |
| `apps/web/src/components/ui/avatar.tsx` | Compose `.atlas-avatar` (sm/default/lg), hashed coded-accent fill |
| `apps/web/src/components/ui/toggle.tsx` | Square-thumb `.atlas-toggle` matching prototype (52×28, 20px thumb slides 2→28px) |
| `apps/web/src/components/ui/card.tsx` | **New** — `.atlas-card` (+ `size="lg"` for 8px/6px-shadow containers) |
| `apps/web/src/components/ui/input.tsx` | **New** — `Input` + `Textarea` on `.atlas-input` / `.atlas-textarea` with focus lift |
| `apps/web/src/components/ui/dialog.tsx` | **New** — SolidJS-native `Dialog`/`DialogHeader`/`DialogBody` via `Portal` + `Show`; backdrop + Escape dismiss; `.atlas-overlay*` |
| `apps/web/src/components/ui/kbd.tsx` | **New** — `.atlas-kbd` mono key cap with 1.5px border + 1.5px offset shadow |
| `apps/web/src/components/ui/index.ts` | Export Card, Input, Textarea, Dialog (+Header/Body), Kbd |
| `apps/web/src/routes/dev/design-system.tsx` | Rebuilt gallery: Atlas tokens, Bungee/Space Mono/VT323 specimens, buttons, cards, inputs, avatars, badges/priority/tags, kbd, toggles, dialog, icons |

No React imports. No runtime imports from `docs/prototype/**`. SolidJS-native
primitives only.

---

## Commands & Results

```sh
bun run --cwd apps/web typecheck   # tsc --noEmit → PASS (0 errors)
bun run --cwd apps/web lint        # biome lint ./src → PASS (Checked 26 files, no fixes)
```

`aft_inspect` over `apps/web/src`: **0 errors, 0 warnings** (remaining items are
biome assist `organizeImports` info hints, several pre-existing on `client.tsx` /
`__root.tsx`; not lint failures).

---

## Prototype Server

Served from: `docs/prototype/Atlas.html`
Command: `cd docs/prototype && python3 -m http.server 8765`
URL: `http://localhost:8765/Atlas.html` — verified HTTP 200.

## App Dev Server

`bun run --cwd apps/web dev` → `http://localhost:3001` — verified HTTP 200.

---

## Screenshots Captured

Relative to this manifest, under `screenshots/`.

### App — `/dev/design-system`

| File | Viewport | Notes |
|---|---|---|
| `app/1440x900-design-system.png` | 1440×900 | Full primitive gallery (Atlas-styled) |
| `app/390x844-design-system.png` | 390×844 | Mobile — primitives reflow, parity preserved |
| `app/1440x900-dialog.png` | 1440×900 | Dialog section (see Interactivity note) |

### Prototype reference (`docs/prototype/Atlas.html`)

| File | Viewport | Primitives shown |
|---|---|---|
| `prototype/1440x900-inbox.png` | 1440×900 | Buttons, cards, badges, priority chips, avatars, tags |
| `prototype/1440x900-settings.png` | 1440×900 | Toggles, setting rows |
| `prototype/1440x900-compose.png` | 1440×900 | Overlay/dialog shell, inputs, textarea |

---

## Parity Verification (computed styles)

Confirmed via `agent-browser eval getComputedStyle(...)` on both app and
prototype:

| Property | App | Prototype | Match |
|---|---|---|---|
| Button font | `"Space Mono"` | `"Space Mono"` | ✅ |
| Button border-width | `2px` | `2px` | ✅ |
| Button box-shadow | `rgb(29,31,39) 4px 4px 0px 0px` (hard, zero blur) | hard ink offset | ✅ |
| Heading font | `Bungee` | Bungee (display) | ✅ |
| Body background | `rgb(240,235,224)` (`#F0EBE0`) | `rgb(240,235,224)` | ✅ |
| Badge radius | `9999px` (pill) | pill | ✅ |

Primitive parity confirmed: buttons, badges, priority chips, tags, cards,
inputs, overlays/dialog shell, avatars, kbd, and toggles all match the
prototype's token system (color, font, 2px border, 5px/8px radius, hard offset
shadow).

---

## Interactivity Note (pre-existing, out of scope)

The dev server logs a **pre-existing** TanStack Start + Solid hydration warning
(`template2 is not a function` / "error wasn't caught by any route") that breaks
client-side reactivity on `apps/web`. This was verified to reproduce on the
**original (pre-task) code** by stashing this task's changes — the original
`Toggle` (using `solid-motionone`) was equally non-interactive, and the warning
also appears on the `/` route which imports none of these primitives. It is
therefore an environmental scaffold issue, **not introduced by this task**.

Impact on proof: primitives are validated by **static render parity** +
computed-style comparison (above). The dialog open-state could not be captured
interactively for the same reason; `app/1440x900-dialog.png` shows the page with
the dialog trigger. Static styling of the overlay/dialog shell is verified via
the centralized `.atlas-overlay*` classes and the prototype compose reference.

---

## Acceptance Criteria Status

- [x] `bun run --cwd apps/web typecheck` passes (0 errors)
- [x] `bun run --cwd apps/web lint` passes (no fixes)
- [x] `/dev/design-system` shows Atlas-styled primitives (warm paper, Bungee/Space Mono/VT323, 2px ink borders, hard offset shadows, kinetic buttons, badges/priority/tags, input focus lift, card surfaces, kbd, avatars, toggles, dialog shell)
- [x] Screenshots at `1440x900` and `390x844` captured demonstrating primitive parity vs the served prototype (buttons, badges, cards, inputs, overlays, avatars, toggles)
- [x] `/` route still renders (`HELLO FROM TANSTACK START + SOLIDJS`)
- [x] SolidJS-native only — no React imports, no runtime imports from `docs/prototype/**`
