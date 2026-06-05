# Task 03 — Data, Icons, Logo & Solid State Contracts Manifest

**Task:** Port prototype data, icons, logo, and Solid state contracts
**Date:** 2026-06-05
**Spec:** `02-spec-web-prototype-recreation`

---

## Summary

Converted the self-contained React prototype's sample data and interaction
model into typed, SolidJS-friendly local modules under `apps/web/src`. No
runtime imports from `docs/prototype/**` — only provenance comments reference
the prototype source.

- **Types** (`types.ts`): full domain & state-contract type surface —
  `MailCategory`, `Priority`, `MailTag`, `ScreenerItem`, `MailItem`,
  `ThreadMessage`/`ThreadBody`/`Thread`, `ExtractedItem`, `TaskEntry`/`DateEntry`,
  `SampleData`, assistant types (`AssistantMessage`/`AssistantCitation`/
  `AssistantRule`), onboarding types (declarative `OnboardingVisual` tagged
  union), `Screen`/`NavItem`, and the interaction-model contracts
  (`SelectionState`, `ScreenerDecisions`, `ToggleSet`, `OverlayState`,
  `AtlasState`).
- **Sample data** (`sample_data.ts`): all rows ported verbatim — content,
  ordering, ids, timestamps, category labels, tags, AI summary/extraction text,
  and the `i1` thread body. Exported as a single `SAMPLE: SampleData`.
- **Assistant** (`assistant_responses.ts`): the prototype's regex-branching
  canned replies as ordered `AssistantRule`s + a catch-all fallback;
  `ASSISTANT_INTRO`, `ASSISTANT_EXAMPLES`, and a pure `answerQuery()` resolver.
- **App state** (`app_state.ts`): `createInitialState()`, pure derivation
  helpers (active category lists with accepted-screener extras prepended,
  `pendingScreener`, `currentThread`, `selectedIdForView`, `viewForMailId`),
  pure transitions (`selectInView`, `acceptScreener`, `rejectScreener`), nav
  builders (`mailNavItems`, `ASSIST_NAV_ITEMS`, `listTitle`), the declarative
  keyboard-shortcut resolver (`resolveShortcut`), and the 5-step
  `ONBOARDING_STEPS` copy/visual data.
- **Icons** (`components/atlas/atlas_icon.tsx`): SolidJS port of the
  prototype's hand-rolled inline-SVG icon set (37 named glyphs + fallback),
  paths/viewBox/strokes preserved verbatim, decorative (`aria-hidden`).
  Exports `IconName` union (consumed by `types.ts` / `app_state.ts`).
- **Logo** (`components/atlas/logo.tsx`): SolidJS port of `CompassMark` + full
  `Logo` lockup, self-contained via Atlas tokens (`--color-main`,
  `--color-border`, `--color-foreground`, `--radius`, `--shadow-sm`,
  `--font-display`) so it does not depend on prototype-only `.logo*` CSS.

---

## Files Changed

| File | Change |
|---|---|
| `apps/web/src/lib/atlas/types.ts` | **New** — domain & state-contract types |
| `apps/web/src/lib/atlas/sample_data.ts` | **New** — `SAMPLE` dataset (verbatim) |
| `apps/web/src/lib/atlas/assistant_responses.ts` | **New** — canned Ask-Atlas replies + `answerQuery()` |
| `apps/web/src/lib/atlas/app_state.ts` | **New** — initial state, derivation helpers, transitions, nav, shortcuts, onboarding steps |
| `apps/web/src/components/atlas/atlas_icon.tsx` | **New** — SolidJS inline icon set + `IconName` |
| `apps/web/src/components/atlas/logo.tsx` | **New** — `CompassMark` + `Logo` |

No Task-2 surface (`styles.css`, `routes/__root.tsx`, `components/ui/*`) was
modified. SolidJS-native only — no React imports, no runtime imports from
`docs/prototype/**`.

---

## Commands & Results

```sh
bun run --cwd apps/web typecheck                       # tsc --noEmit → PASS (0 errors)
bun run --cwd apps/web lint                            # biome lint ./src → PASS (Checked 32 files, no fixes)
bunx @biomejs/biome lint src/lib/atlas src/components/atlas  # PASS (0 errors)
```

### Acceptance greps

```sh
grep -rEn "from 'react'|import React|React\.(use|create|FC)" src/lib/atlas src/components/atlas
#   → NO REACT IMPORTS

grep -rEn "^\s*import .*docs/prototype|require\(.*docs/prototype" src/
#   → NO RUNTIME IMPORTS (all docs/prototype matches are provenance comments)
```

### Sample-count verification (executed via bun)

| Collection | Actual | Expected | Status |
|---|---|---|---|
| `screener` | 4 | 4 | ✅ |
| `inbox` | 9 | 9 | ✅ |
| `feed` | 7 | 7 | ✅ |
| `paper` | 7 | 7 | ✅ |
| `tasks` | 5 | 5 | ✅ |
| `dates` | 5 | 5 | ✅ |
| `ONBOARDING_STEPS` | 5 | 5 | ✅ |

`answerQuery("…priya…")` → cites `i1`; `answerQuery("zzz nonsense")` →
fallback (0 cites). `SAMPLE.threadBody` keys: `i1`.

---

## Visual-Drift Recheck (vs Task 2 primitives)

Task 3 is data/contract-only and modifies **none** of Task 2's styling surface
(`styles.css`, `__root.tsx`, `components/ui/*` are untouched — confirmed via
`git status`). To prove no visual drift, the Task 2 primitive proof surface
(`/dev/design-system`) was re-captured and compared against the Task 2
baseline.

App dev server: `bun run --cwd apps/web dev` → `http://localhost:3001` (HTTP 200,
`/dev/design-system` HTTP 200).

### Full-page screenshot dimensions (identical = no layout reflow)

| Viewport | Task 2 baseline | Task 3 recheck | Match |
|---|---|---|---|
| 1440×900 (full) | 1440×2368 | 1440×2368 | ✅ |
| 390×844 (full) | 390×2864 | 390×2864 | ✅ |

Recheck captures: `screenshots/recheck/{1440x900,390x844}-design-system.png`.

### Computed-style parity (re-measured this task vs Task 2's recorded table)

| Property | Task 3 measured | Task 2 recorded | Match |
|---|---|---|---|
| Body background | `rgb(240, 235, 224)` (`#F0EBE0`) | `rgb(240,235,224)` | ✅ |
| Body / button font | `"Space Mono"` | `"Space Mono"` | ✅ |
| Button border-width | `2px` | `2px` | ✅ |
| Button box-shadow | `rgb(29,31,39) 4px 4px 0px 0px` (hard, zero blur) | `rgb(29,31,39) 4px 4px 0px 0px` | ✅ |
| `documentElement.scrollHeight` | `2368` | `2368` (baseline image height) | ✅ |

Identical full-page heights + identical token-driven computed styles confirm
**no visual drift** from Task 2.

---

## Acceptance Criteria Status

- [x] `bun run --cwd apps/web typecheck` passes (0 errors)
- [x] Sample counts match the prototype — screener 4, inbox 9, feed 7,
      paper 7, tasks 5, dates 5 (verified at runtime)
- [x] No runtime imports reference `docs/prototype/**` (only provenance comments)
- [x] Grep verification finds no React imports in new Atlas files
- [x] Previous primitive screenshots rechecked — no visual drift from Task 2
      (identical full-page dimensions + identical computed styles)
