# Hay Design System

This document is the canonical reference for all design tokens, typography, spacing, shadows, borders, and motion used in the Hay application. All tokens are defined in `apps/web/src/styles.css` using Tailwind v4's `@theme` directive and mirrored in a `:root` block for guaranteed CSS custom property availability.

---

## Approach: Tailwind v4 `@theme`

Hay uses **Tailwind CSS v4** with the `@theme {}` directive to define design tokens. This approach:

- Registers tokens as Tailwind utility classes (e.g., `bg-main`, `text-foreground`, `shadow-sm`)
- Exposes tokens as CSS custom properties on `:root` / `:host`
- Enables arbitrary-value usage: `bg-[var(--color-main)]`

Tokens are also mirrored in a plain `:root {}` block to guarantee availability regardless of Tailwind's utility-class tree-shaking.

---

## Color Tokens

### Light Mode (default)

| Token | CSS Variable | Value | Usage |
|---|---|---|---|
| Background | `--color-background` | `oklch(92.13% 0.0388 282.36)` | Page/app background |
| Secondary Background | `--color-secondary-background` | `oklch(100% 0 0)` | Card/panel background |
| Foreground | `--color-foreground` | `oklch(0% 0 0)` | Primary text |
| Muted | `--color-muted` | `oklch(40% 0.02 282)` | Secondary/muted text |
| Main | `--color-main` | `oklch(66.34% 0.1806 277.2)` | Primary brand color (purple-blue) |
| Main Foreground | `--color-main-foreground` | `oklch(0% 0 0)` | Text on `main` backgrounds |
| Border | `--color-border` | `oklch(0% 0 0)` | All borders (neobrutalist black) |
| Feed | `--color-feed` | `#FACC00` | Feed feature accent (yellow) |
| Paper | `--color-paper` | `#00D696` | Paper feature accent (green) |
| Danger | `--color-danger` | `#FF4D50` | Error/destructive states (red) |
| AI | `--color-ai` | `#0099FF` | AI feature accent (blue) |
| Inbox | `--color-inbox` | `#7A83FF` | Inbox feature accent (indigo) |

### Dark Mode Overrides

Applied via `@media (prefers-color-scheme: dark)` on `:root`.

| Token | CSS Variable | Dark Value |
|---|---|---|
| Background | `--color-background` | `oklch(26.58% 0.0737 283.96)` |
| Secondary Background | `--color-secondary-background` | `oklch(20% 0 0)` |
| Foreground | `--color-foreground` | `oklch(96% 0 0)` |
| Muted | `--color-muted` | `oklch(75% 0.02 282)` |

> Feature accent colors (`feed`, `paper`, `danger`, `ai`, `inbox`) do not change in dark mode — they are intentionally vivid in both modes.

### Tailwind Utility Classes

| Token | Tailwind Class Examples |
|---|---|
| `--color-main` | `bg-main`, `text-main`, `border-main` |
| `--color-background` | `bg-background` |
| `--color-foreground` | `text-foreground` |
| `--color-feed` | `bg-feed`, `text-feed` |
| `--color-paper` | `bg-paper`, `text-paper` |
| `--color-danger` | `bg-danger`, `text-danger` |
| `--color-ai` | `bg-ai`, `text-ai` |
| `--color-inbox` | `bg-inbox`, `text-inbox` |

---

## Typography

### Font Families

| Token | CSS Variable | Value | Tailwind Class |
|---|---|---|---|
| Sans | `--font-sans` | `"Archivo", ui-sans-serif, system-ui, sans-serif` | `font-sans` |
| Mono | `--font-mono` | `"JetBrains Mono", "SF Mono", Menlo, monospace` | `font-mono` |

**Archivo** is loaded from Google Fonts with the following weights and styles:
- `400` (regular)
- `400 italic`
- `600` (semibold)
- `700` (bold)
- `900` (black)

Google Fonts link is added via `<link>` tags in `apps/web/src/routes/__root.tsx`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,400;0,600;0,700;0,900;1,400&display=swap">
```

### Font Weights

| Token | CSS Variable | Value | Usage |
|---|---|---|---|
| Base | `--font-weight-base` | `600` | Default UI text weight (semibold) |
| Heading | `--font-weight-heading` | `900` | Headings and display text (black) |

> Hay uses heavier-than-normal default weights as part of its neobrutalist aesthetic.

---

## Border & Shadow

### Border

| Token | CSS Variable | Value | Usage |
|---|---|---|---|
| Border Width | `--border-w` | `2px` | All component borders |
| Border Color | `--color-border` | `oklch(0% 0 0)` | All borders (black) |
| Radius | `--radius` | `5px` | Default border radius |
| Radius Large | `--radius-lg` | `8px` | Larger elements (modals, cards) |

Usage pattern: `border-[length:var(--border-w)] border-border rounded-[var(--radius)]`

### Shadow

Hay uses **flat offset shadows** (neobrutalist style) — no blur, solid black.

| Token | CSS Variable | Value | Usage |
|---|---|---|---|
| Shadow X | `--shadow-x` | `4px` | Horizontal shadow offset |
| Shadow Y | `--shadow-y` | `4px` | Vertical shadow offset |
| Shadow (default) | `--shadow` | `4px 4px 0px oklch(0% 0 0)` | Default component shadow |
| Shadow Small | `--shadow-sm` | `2px 2px 0px oklch(0% 0 0)` | Compact components |
| Shadow Large | `--shadow-lg` | `6px 6px 0px oklch(0% 0 0)` | Prominent elements |

**Press interaction**: On click/tap, components translate by `(var(--shadow-x), var(--shadow-y))` and collapse `box-shadow` to `none`, simulating a physical press.

---

## Motion

| Token | CSS Variable | Value | Usage |
|---|---|---|---|
| Duration Fast | `--duration-fast` | `60ms` | Micro-interactions, icon swaps |
| Duration Base | `--duration-base` | `120ms` | Standard transitions |
| Ease Base | `--ease-base` | `ease` | Default easing function |

### Reduced Motion

A global `@media (prefers-reduced-motion: reduce)` rule overrides all transitions and animations to `0.01ms`, effectively disabling them for users who prefer reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

Components using `solid-motionone` also check `window.matchMedia("(prefers-reduced-motion: reduce)").matches` on mount and set animation duration to `0` when true.

---

## Usage Notes

### Referencing Tokens in CSS

```css
/* Direct CSS variable reference */
.my-component {
  background-color: var(--color-main);
  box-shadow: var(--shadow);
  border: var(--border-w) solid var(--color-border);
  border-radius: var(--radius);
}
```

### Referencing Tokens in Tailwind Classes

```html
<!-- Tailwind utility classes (generated from @theme) -->
<div class="bg-main text-main-foreground rounded-[var(--radius)]">
  Primary button
</div>

<!-- Arbitrary values with CSS variables -->
<div class="border-[length:var(--border-w)] border-border">
  Bordered element
</div>
```

### Dark Mode

Dark mode is handled automatically via `@media (prefers-color-scheme: dark)`. No class toggling is needed. The four tokens that change in dark mode (`background`, `secondary-background`, `foreground`, `muted`) are overridden in the media query.

### Neobrutalist Aesthetic

Hay's design language is **neobrutalist**:
- Heavy borders (2px solid black)
- Flat offset shadows (no blur)
- Bold typography (600–900 weight)
- Slight rotations on badges/avatars (`transform: rotate(-1deg)`)
- Press feedback via shadow collapse + translate on click

---

## File Reference

| File | Purpose |
|---|---|
| `apps/web/src/styles.css` | All `@theme` tokens, `:root` mirror, dark mode overrides, reduced-motion rule |
| `apps/web/src/routes/__root.tsx` | Google Fonts preconnect + Archivo stylesheet links |
| `apps/web/src/components/ui/` | Component library using these tokens |
