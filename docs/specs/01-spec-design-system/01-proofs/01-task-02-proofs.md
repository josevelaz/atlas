# Task 2.0 Proof Artifacts — Design Tokens: Wire OKLCH Tokens into Tailwind v4 + Populate DESIGN.md

**Date**: 2026-05-26  
**Branch**: `feat/issue-2-design-system`  
**Commits**: see git log for `feat(tokens): wire OKLCH design tokens into Tailwind v4 and populate DESIGN.md`

---

## Summary

Task 2.0 wires all OKLCH design tokens into Tailwind v4's `@theme` directive, adds a `:root` mirror block for guaranteed CSS custom property availability, adds dark-mode overrides, adds a reduced-motion rule, loads the Archivo font via Google Fonts, and populates `DESIGN.md` with full token documentation.

---

## Proof 1: `--color-main` Resolves on `:root`

**What it proves**: The `--color-main` CSS custom property is defined and resolves to `oklch(66.34% 0.1806 277.2)` on the document root.

**Method**: JavaScript evaluation via `agent-browser eval` against the live dev server at `http://localhost:3001`.

**Command run**:
```
npx agent-browser eval "getComputedStyle(document.documentElement).getPropertyValue('--color-main').trim()"
```

**Output**:
```
"oklch(66.34% 0.1806 277.2)"
```

**All tokens verified** (full token dump):
```json
{
  "--color-main": "oklch(66.34% 0.1806 277.2)",
  "--color-background": "oklch(26.58% 0.0737 283.96)",
  "--color-secondary-background": "oklch(20% 0 0)",
  "--color-foreground": "oklch(96% 0 0)",
  "--color-muted": "oklch(75% 0.02 282)",
  "--color-border": "oklch(0% 0 0)",
  "--color-feed": "#facc00",
  "--color-paper": "#00d696",
  "--color-danger": "#ff4d50",
  "--color-ai": "#0099ff",
  "--color-inbox": "#7a83ff",
  "--shadow-x": "4px",
  "--shadow-y": "4px",
  "--shadow": "4px 4px 0px oklch(0% 0 0)",
  "--shadow-sm": "2px 2px 0px oklch(0% 0 0)",
  "--shadow-lg": "6px 6px 0px oklch(0% 0 0)",
  "--border-w": "2px",
  "--font-weight-base": "600",
  "--font-weight-heading": "900",
  "--duration-fast": "60ms",
  "--duration-base": "120ms",
  "--ease-base": "ease"
}
```

> Note: `--color-background` shows the dark mode value (`oklch(26.58% 0.0737 283.96)`) because the test machine was in dark mode — this simultaneously proves the dark mode override is working correctly.

---

## Proof 2: Archivo Font Loading

**What it proves**: The Archivo font is loaded from Google Fonts via the correct `<link>` tags in `__root.tsx`.

**Method**: JavaScript evaluation checking the `<link>` element's `href`.

**Command run**:
```
npx agent-browser eval "document.querySelector('link[href*=\"Archivo\"]')?.href"
```

**Output**:
```
"https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,400;0,600;0,700;0,900;1,400&display=swap"
```

**Preconnect links also verified**:
```
npx agent-browser eval "document.querySelector('link[href*=\"fonts.googleapis.com\"]')?.href"
→ "https://fonts.googleapis.com/"
```

**HTML output** (from `curl http://localhost:3001`):
```html
<link rel="preconnect" href="https://fonts.googleapis.com" nonce="undefined"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" nonce="undefined"/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,400;0,600;0,700;0,900;1,400&display=swap" nonce="undefined"/>
```

---

## Proof 3: Dark Mode Token Override

**What it proves**: The `@media (prefers-color-scheme: dark)` block is present and overrides `--color-background` and related tokens.

**Method**: JavaScript evaluation checking for the dark mode media query in the document's stylesheets.

**Command run**:
```
npx agent-browser eval "Array.from(document.styleSheets).some(s => {
  try { return Array.from(s.cssRules).some(r => r.media?.mediaText?.includes('prefers-color-scheme: dark')); }
  catch(e) { return false; }
})"
```

**Output**: `true`

**CSS content verified** (from compiled CSS served at `/src/styles.css`):
```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-background: oklch(26.58% 0.0737 283.96);
    --color-secondary-background: oklch(20% 0 0);
    --color-foreground: oklch(96% 0 0);
    --color-muted: oklch(75% 0.02 282);
  }
}
```

**Live verification**: `--color-background` resolved to `oklch(26.58% 0.0737 283.96)` (dark mode value) on the test machine, confirming the override is active when OS dark mode is enabled.

---

## Proof 4: DESIGN.md Completeness

**What it proves**: `DESIGN.md` at the repo root contains all required sections.

**File**: `DESIGN.md`

**Sections present**:
- ✅ Approach: Tailwind v4 `@theme`
- ✅ Color Tokens — Light Mode table (11 tokens with CSS variable, value, usage)
- ✅ Color Tokens — Dark Mode Overrides table (4 tokens)
- ✅ Color Tokens — Tailwind Utility Classes table
- ✅ Typography — Font Families table
- ✅ Typography — Font Weights table
- ✅ Border & Shadow — Border tokens table
- ✅ Border & Shadow — Shadow tokens table
- ✅ Motion — Duration + Easing tokens table
- ✅ Motion — Reduced Motion section with CSS snippet
- ✅ Usage Notes — CSS variable usage
- ✅ Usage Notes — Tailwind class usage
- ✅ Usage Notes — Dark Mode explanation
- ✅ Usage Notes — Neobrutalist Aesthetic description
- ✅ File Reference table

---

## Proof 5: Lint and Typecheck Pass

**What it proves**: No Biome lint errors and no TypeScript type errors after all changes.

**Commands run** (from `apps/web/`):

```
$ bun run lint
→ Checked 15 files in 23ms. No fixes applied.

$ bun run typecheck
→ (exits 0, no output = no errors)
```

**Additional fix applied**: Added `css.parser.tailwindDirectives: true` to `biome.json` to enable Biome's Tailwind CSS parser, which is required to parse `@theme {}` blocks without errors.

**Biome suppress comments**: Added `biome-ignore lint/complexity/noImportantStyles` comments on the two `!important` declarations in the reduced-motion rule (required for accessibility override semantics).

---

## Implementation Notes

### Tailwind v4 Token Availability

Tailwind v4's `@theme` directive registers tokens for utility class generation but only outputs tokens to `:root` when they are referenced in utility classes found in scanned source files. To ensure all design tokens are always available as CSS custom properties (required for the proof and for runtime use), a plain `:root {}` block mirrors all tokens from `@theme`. This is the correct pattern for Tailwind v4 when tokens must be available before components are built.

### Biome CSS Parser

`biome.json` required `css.parser.tailwindDirectives: true` to parse `@theme {}` without a parse error. This was added as part of this task.

### Files Changed

| File | Change |
|---|---|
| `apps/web/src/styles.css` | Added `@theme {}` block (all tokens), `:root {}` mirror, dark mode overrides, reduced-motion rule, biome-ignore comments |
| `apps/web/src/routes/__root.tsx` | Added 3 font link entries before the stylesheet link |
| `DESIGN.md` | Fully populated with all token documentation sections |
| `biome.json` | Added `css.parser.tailwindDirectives: true` |
| `docs/specs/01-spec-design-system/01-tasks-design-system.md` | Sub-tasks 2.1–2.9 marked `[x]` |
