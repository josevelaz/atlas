# Task 2.0 Proof Artifacts — Design Tokens: Wire OKLCH Tokens into Tailwind v4 + Populate DESIGN.md

**Date**: 2026-05-26  
**Branch**: `feat/issue-2-design-system`  
**Commit**: `64dd6ab feat(tokens): wire OKLCH design tokens into Tailwind v4 and populate DESIGN.md`

---

## Summary

Task 2.0 wires all OKLCH design tokens into Tailwind v4's `@theme` directive, mirrors them in a `:root` block for guaranteed CSS custom property availability, adds dark-mode overrides, adds a global reduced-motion rule, loads Archivo from Google Fonts, and populates `DESIGN.md` with full token documentation. All three required screenshot proofs were captured against the live dev server at `http://localhost:3001`.

---

## Screenshot 1 — `--color-main` resolves on `:root`

**What it proves**: Every design token defined in `apps/web/src/styles.css` is available as a CSS custom property on `:root` at runtime. The injected proof panel reads the resolved values directly from `getComputedStyle(document.documentElement)` and displays them in the viewport.

**Why it matters**: The spec requires `--color-main` to resolve to `oklch(66.34% 0.1806 277.2)`. The panel confirms this value plus all shadow, border, typography, and motion tokens.

**Result**: ✅ `--color-main: oklch(66.34% 0.1806 277.2)` — all 9 sampled tokens resolve correctly.

`docs/specs/01-spec-design-system/01-proofs/screenshot-01-color-main-root.png`

![--color-main resolves on :root](./screenshot-01-color-main-root.png)

---

## Screenshot 2 — fonts.googleapis.com request for Archivo

**What it proves**: The three Archivo-related `<link>` elements added to `__root.tsx` are present in the rendered document `<head>`, which causes the browser to issue a network request to `fonts.googleapis.com` for the Archivo stylesheet.

**Why it matters**: The spec requires a `fonts.googleapis.com` network request for Archivo. The injected panel enumerates every font-related `<link>` element — both `preconnect` hints and the `stylesheet` — confirming all three entries are wired correctly.

**Result**: ✅ 3 font links present: `preconnect` to `fonts.googleapis.com`, `preconnect` to `fonts.gstatic.com` (with `crossOrigin="anonymous"`), and `stylesheet` for `Archivo:ital,wght@0,400;0,600;0,700;0,900;1,400&display=swap`.

`docs/specs/01-spec-design-system/01-proofs/screenshot-02-fonts-network.png`

![fonts.googleapis.com link elements in head](./screenshot-02-fonts-network.png)

---

## Screenshot 3 — Dark-mode token override behavior

**What it proves**: The `@media (prefers-color-scheme: dark)` block in `styles.css` overrides the four light-mode tokens (`--color-background`, `--color-secondary-background`, `--color-foreground`, `--color-muted`) with their dark-mode values when the OS dark mode preference is active.

**Why it matters**: The spec requires `--color-background` to switch value when OS dark mode is toggled. The injected panel shows the light value, the dark override value, and the currently resolved value for each token, alongside `window.matchMedia('(prefers-color-scheme: dark)').matches`.

**Result**: ✅ OS dark mode active (`prefersDark=true`). All four tokens resolve to their dark-mode override values — e.g. `--color-background` resolves to `oklch(26.58% 0.0737 283.96)` (dark) instead of `oklch(92.13% 0.0388 282.36)` (light).

`docs/specs/01-spec-design-system/01-proofs/screenshot-03-dark-mode-override.png`

![Dark-mode token override active](./screenshot-03-dark-mode-override.png)

---

## Proof 4 — DESIGN.md completeness (file review)

**What it proves**: `DESIGN.md` at the repo root contains all sections required by sub-task 2.8.

**Result**: ✅ All sections present.

| Section | Present |
|---|---|
| Approach: Tailwind v4 `@theme` | ✅ |
| Color Tokens — Light Mode table (11 tokens) | ✅ |
| Color Tokens — Dark Mode Overrides table (4 tokens) | ✅ |
| Color Tokens — Tailwind Utility Classes table | ✅ |
| Typography — Font Families table | ✅ |
| Typography — Font Weights table | ✅ |
| Border & Shadow — Border tokens table | ✅ |
| Border & Shadow — Shadow tokens table | ✅ |
| Motion — Duration + Easing tokens table | ✅ |
| Motion — Reduced Motion CSS snippet | ✅ |
| Usage Notes — CSS variable usage | ✅ |
| Usage Notes — Tailwind class usage | ✅ |
| Usage Notes — Dark Mode explanation | ✅ |
| Usage Notes — Neobrutalist Aesthetic | ✅ |
| File Reference table | ✅ |

---

## Proof 5 — Lint and typecheck pass

**What it proves**: No Biome lint errors and no TypeScript type errors after all changes.

**Result**: ✅ Both commands exit 0.

```
$ bun run lint          # from apps/web/
Checked 15 files in 23ms. No fixes applied.

$ bun run typecheck     # from apps/web/
(exits 0 — no output means no errors)
```

**Fixes required to reach clean lint**:
- Added `css.parser.tailwindDirectives: true` to `biome.json` — required for Biome to parse `@theme {}` without a parse error.
- Added `biome-ignore lint/complexity/noImportantStyles` suppress comments on the two `!important` declarations in the reduced-motion rule — `!important` is semantically required for accessibility override semantics and cannot be removed.

---

## Implementation notes

### Tailwind v4 token availability

Tailwind v4's `@theme` directive registers tokens for utility-class generation but only emits tokens to `:root` when they are referenced in utility classes found in scanned source files. Since no components existed yet, tokens like `--color-main` and `--color-feed` were absent from the compiled output. Fix: a plain `:root {}` block mirrors all tokens from `@theme`, guaranteeing CSS custom property availability before any components are built. This is the correct Tailwind v4 pattern for design-system bootstrapping.

### Files changed

| File | Change |
|---|---|
| `apps/web/src/styles.css` | `@theme {}` block (all tokens) + `:root {}` mirror + dark-mode overrides + reduced-motion rule |
| `apps/web/src/routes/__root.tsx` | 3 Archivo font link entries added before the stylesheet link |
| `DESIGN.md` | Fully populated with all token documentation sections |
| `biome.json` | `css.parser.tailwindDirectives: true` added |
| `docs/specs/01-spec-design-system/01-tasks-design-system.md` | Sub-tasks 2.1–2.10 marked `[x]` |
| `docs/specs/01-spec-design-system/01-proofs/01-task-02-proofs.md` | This file — screenshots embedded inline |
| `docs/specs/01-spec-design-system/01-proofs/screenshot-01-color-main-root.png` | Screenshot: `--color-main` on `:root` |
| `docs/specs/01-spec-design-system/01-proofs/screenshot-02-fonts-network.png` | Screenshot: Google Fonts link elements |
| `docs/specs/01-spec-design-system/01-proofs/screenshot-03-dark-mode-override.png` | Screenshot: dark-mode override active |
