---
version: alpha
name: Atlas
description: A retro, neobrutalist design system for an AI-managed email client. Hard offset shadows, heavy 2px ink borders, warm-cream paper, a single electric accent, and a typewriter/arcade type voice.
colors:
  primary: "#1D1F27"
  secondary: "#6B6456"
  tertiary: "#FACC00"
  neutral: "#F0EBE0"
  surface: "#FFFDF7"
  on-surface: "#1D1F27"
  border: "#1D1F27"
  muted: "#6B6456"
  muted-2: "#9A9184"
  feed: "#FFD600"
  paper: "#00E5A0"
  ai: "#3D7EFF"
  inbox: "#A78BFA"
  error: "#FF4D50"
typography:
  display:
    fontFamily: Bungee
    fontSize: 22px
    fontWeight: 400
    lineHeight: 1
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Bungee
    fontSize: 22px
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Bungee
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.1
  body-md:
    fontFamily: Space Mono
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: Space Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.35
  label-md:
    fontFamily: Space Mono
    fontSize: 11px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.02em
  label-caps:
    fontFamily: Space Mono
    fontSize: 10px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.08em
  data-mono:
    fontFamily: VT323
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1
rounded:
  none: 0px
  sm: 4px
  md: 5px
  lg: 8px
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  xxl: 24px
  border-w: 2px
elevation:
  shadow-sm: 2px 2px 0 0 {colors.border}
  shadow: 4px 4px 0 0 {colors.border}
  shadow-lg: 6px 6px 0 0 {colors.border}
components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 0 14px
    height: 36px
    typography: "{typography.label-md}"
  button-primary-hover:
    backgroundColor: "{colors.tertiary}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    height: 36px
  button-danger:
    backgroundColor: "{colors.error}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 8px 10px
  badge:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.full}"
    height: 22px
    padding: 0 8px
    typography: "{typography.label-md}"
  nav-item-active:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
  ai-surface:
    backgroundColor: "{colors.ai}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
---

# Atlas — Design System

## Overview

Atlas is an AI-managed inbox that triages, summarizes, and extracts tasks from
email. The interface borrows the confident, slightly mischievous energy of
late-90s / early-2000s software and arcade UI, filtered through a modern
neobrutalist discipline.

The feeling should be **tactile and engineered**: every surface is a physical
chip stamped onto warm paper, outlined in heavy ink, and lifted by a hard,
blur-free drop shadow. Nothing floats softly — things sit, click, and snap.
Color is rationed: the canvas is calm warm-cream, type is near-black ink, and a
single electric accent does the pointing. Category colors (feed, paper trail,
AI, inbox) are loud on purpose but appear only as small coded tokens, never as
fields.

Voice: direct, technical, a little retro. Monospace for the running text gives
the product a "terminal you trust" quality; the arcade display face reserves
spectacle for names and headlines only.

## Colors

The palette is built on warm neutrals, ink-black structure, and a rationed set
of saturated "coded" accents.

- **Primary / Ink (#1D1F27):** Near-black slate for all body text, headlines,
  borders, and rings. This is the structural color of the system.
- **Secondary / Muted (#6B6456):** Warm taupe for metadata, captions, and
  secondary labels.
- **Tertiary / Accent (#FACC00):** Electric yellow. The single driver of
  primary action and active state — buttons, the selected nav item, the logo
  chip, selected rows.
- **Neutral / Paper (#F0EBE0):** Warm limestone-cream canvas. The base
  background everything sits on.
- **Surface (#FFFDF7):** Near-white warm paper for cards, inputs, messages, and
  raised chips.
- **Coded accents:** Each appears only as a small badge, dot, or icon tile —
  never as a large fill. `feed #FFD600` (yellow), `paper #00E5A0` (mint),
  `ai #3D7EFF` (electric blue, the AI's signature), `inbox #A78BFA` (lilac),
  `error #FF4D50` (alarm red, also used for P1 priority).

A grain/noise texture is layered over the whole viewport at ~3% opacity to keep
flat fields from feeling sterile — part of the retro character.

A dark theme inverts the canvas to deep navy (`#1D1F27` background, `#282A35`
surfaces, `#EEEFE9` ink) while keeping black borders and the yellow ring.

## Typography

Three families, each with a strict job. Never blur the roles.

- **Display — Bungee:** A chunky arcade marquee face. Used *only* for the logo,
  view titles, and short headlines. Loud, never long. Set at its natural weight
  (400) — Bungee is bold by design, so do not stack extra weight on it.
- **Body — Space Mono:** The workhorse. All running text, mail rows, message
  bodies, buttons, and most labels are monospace. This is what gives Atlas its
  "trustworthy terminal" texture. 14px base, 1.55 line-height for long form.
- **Data — VT323:** A pixel/CRT mono for dense numeric and telemetry data —
  counts, usage meters, timestamps where a retro-computer flavor is wanted.

Labels and metadata are set in uppercase Space Mono at 10–11px with positive
letter-spacing (0.02–0.08em) to read as engineered tags rather than prose.

## Layout

A fixed three-column application shell with a full-width top bar:

- **Top bar (56px):** logo chip, global search, compose, account — separated
  from the body by a 2px ink rule.
- **Sidebar (240px):** mail folders (Screener, Inbox, Feed, Paper Trail) and
  assist tools (Tasks & Dates, Settings).
- **List (380px):** the active mail list.
- **Pane (1fr):** the open thread, with an optional 360px AI assistant rail
  sliding in from the right.

Spacing follows an 8px-rooted scale (4 / 8 / 12 / 16 / 20 / 24). Columns and
regions are divided by structural 2px ink borders rather than gaps or shadows —
the grid itself is drawn. Internal padding is generous (12–20px) so dense
monospace text breathes.

## Elevation & Depth

Depth is **physical, not atmospheric**. There are no soft, blurred shadows.

- Every raised element (button, card, message, badge stack) carries a hard
  offset shadow: `Npx Npx 0 0 ink` with **zero blur and zero spread**, default
  4px offset.
- Interaction is kinetic: on hover an element nudges up-left (`translate(-1,-1)`)
  and its shadow grows by 1px; on press it slams down into its shadow
  (`translate(4,4)`, shadow collapses to 0) so the surface looks physically
  depressed.
- Tonal layering reinforces hierarchy: cream canvas → near-white surface chips.
- The shadow offset is a tunable token (2–6px) — larger = more playful, smaller
  = more restrained.

## Shapes

A tight, engineered radius language.

- Interactive chips and surfaces use a small **5px** radius (`rounded.md`);
  inputs, nav items, and buttons share it.
- Larger containers (onboarding, overlays, compose) step up to **8px**
  (`rounded.lg`).
- Pills and dots use `full` (9999px) — reserved for badges and status dots.
- Borders are uniformly **2px solid ink** on every bounded element. Hairline
  details (kbd keys, dots, small tags) drop to 1.5px.

## Components

- **Buttons:** 2px ink border, 5px radius, hard offset shadow, 36px tall (28px
  for `.sm`). `primary` fills with the yellow accent; `danger` fills alarm red;
  `ghost` drops border and shadow for tertiary actions. All buttons share the
  press-into-shadow kinetic.
- **Cards / Messages:** surface fill, 2px ink border, 5px radius, default offset
  shadow. No internal elevation — structure comes from border dividers.
- **Inputs / Textareas:** surface fill, 2px ink border; on focus they lift
  up-left and gain the offset shadow rather than changing border color.
- **Badges & Tags:** pill (badge) or 3px-radius (tag) ink-bordered chips. Solid
  variants carry a coded accent fill; tags and priorities use uppercase mono.
- **Priority chips:** `P1` = error red, `P2` = feed yellow, `P3` = neutral
  surface — small mono caps with a 1.5px border.
- **Nav items:** transparent until active; the active item fills yellow, gains
  an ink border and a small offset shadow. Counts ride in a mono pill.
- **AI surfaces:** anything the AI authors (summaries, the assistant rail head,
  screener verdicts) is keyed to electric blue `#3D7EFF` with white text, so the
  machine's voice is always visually distinct from the user's.
- **Kbd:** small mono key caps with a 1.5px border and 1.5px offset shadow.

## Do's and Don'ts

- **Do** reserve the yellow accent for the single most important action or the
  active state per region.
- **Do** key every AI-authored surface to electric blue so the machine's voice
  is unmistakable.
- **Do** keep coded accents (feed/paper/ai/inbox/error) as small tokens —
  badges, dots, icon tiles — never large fields.
- **Do** use Bungee only for the logo and short titles; everything readable is
  Space Mono.
- **Don't** use blurred or soft shadows. Every shadow is a hard, blur-free
  offset of ink.
- **Don't** mix radii arbitrarily — 5px for chips, 8px for big containers, full
  only for pills/dots.
- **Don't** drop below the 2px ink border on bounded elements (1.5px is the only
  exception, for hairline details).
- **Don't** stack heavy font-weights on Bungee, and don't set long passages in
  the display or pixel faces.
