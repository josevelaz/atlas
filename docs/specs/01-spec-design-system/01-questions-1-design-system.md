# 01 Questions Round 1 - Design System

Please answer each question below (select one or more options, or add your own notes). Feel free to add additional context under any question.

## 1. Font Family

The issue text says **"Archivo font (400–700 weights)"**, but the prototype (`docs/prototype/hay-inbox-prototype.html`) uses **"DM Sans"** as `--font-base` and `--font-heading`. These are different typefaces with different visual character.

Which font should the design system use?

- [ ] (A) DM Sans — match the prototype exactly (already embedded in prototype, Google Fonts available)
- [x] (B) Archivo — use the font named in the issue (neobrutalist, variable font, Google Fonts available)
- [ ] (C) Both — use Archivo for headings, DM Sans for body
- [ ] (D) Other (describe)

**Recommended answer(s):** [(B)]

**Why this is recommended:**

- The issue explicitly states the prototype is the **source of truth** for visual design and token values. The prototype uses DM Sans.
- Switching to Archivo would diverge from the live prototype reference and require re-validating all visual decisions.
- If Archivo was the original intent, the prototype should be updated first — but that's a separate decision.

---

## 2. Toggle Component Implementation

The issue lists a `Toggle` component described as "animated slide toggle (used in Settings and Compose)". The prototype references a toggle visually but its implementation detail (HTML structure, controlled vs. uncontrolled, accessible checkbox vs. button role) is not extractable from the prototype CSS alone.

What should the Toggle component's API look like?

- [x] (A) Controlled signal — `checked` prop + `onChange` callback (caller owns state)
- [ ] (B) Uncontrolled with internal signal — `defaultChecked` prop, self-contained
- [ ] (C) Both — support controlled and uncontrolled via optional `checked` prop
- [ ] (D) Other (describe)

**Recommended answer(s):** [(A)]

**Why this is recommended:**

- Controlled components are the standard SolidJS pattern for form-like inputs — they compose cleanly with `createSignal` at the call site.
- Uncontrolled adds complexity (internal signal + sync logic) with little benefit for a design system primitive.
- The Settings and Compose screens will likely manage their own state, making controlled the natural fit.

---

## 3. Avatar Color Derivation

The issue says Avatar should have "colored background derived from name". The prototype shows avatars with solid colored backgrounds but doesn't specify the derivation algorithm.

How should the background color be derived from the name?

- [x] (A) Hash the name string to an index into a fixed palette of 6–8 brand colors (e.g., `--main`, `--feed`, `--paper`, `--ai`, `--inbox`, `--danger`)
- [ ] (B) Generate an OKLCH hue by hashing the name (fully dynamic, infinite colors)
- [ ] (C) Accept an explicit `color` prop — no automatic derivation
- [ ] (D) Other (describe)

**Recommended answer(s):** [(A)]

**Why this is recommended:**

- Using the brand palette keeps avatars visually consistent with the design system tokens.
- Dynamic OKLCH hues (B) can produce colors that clash with the neobrutalist palette.
- Explicit prop (C) pushes color logic to every call site, which is more work for consumers.

---

## 4. Dark Mode

The prototype has a dark mode (`.dark` class on `<body>` with alternate token values). The issue does not mention dark mode.

Should the design system spec include dark mode token variants?

- [ ] (A) No — light mode only for this issue; dark mode is a separate future issue
- [x] (B) Yes — include dark mode CSS variables alongside light mode tokens
- [ ] (C) Partial — define the dark token values in DESIGN.md documentation only, no CSS implementation yet

**Recommended answer(s):** [(B)]

**Why this is recommended:**

- The issue acceptance criteria make no mention of dark mode.
- Adding dark mode now expands scope significantly (doubles token definitions, requires testing all 5 components in both modes).
- The prototype already has the dark values documented — they can be added in a follow-up issue without rework.
