# 02 Questions Round 1 - Web Prototype Recreation

Please answer each question below (select one or more options, or add your own notes). Feel free to add additional context under any question.

## 1. Delivery Surface

Where should this recreated prototype live in `apps/web` for the first shippable slice?

- [ ] (A) Replace the current main `/` experience with the recreated Atlas app.
- [ ] (B) Add the recreated Atlas app under a dedicated route such as `/prototype` or `/app`, while leaving current dev/demo routes intact.
- [ ] (C) Build it only as a dev route alongside the current design-system showcase.
- [ ] (D) Recreate the UI in reusable components first, without wiring a user-facing route yet.
- [ ] (E) Other (describe)

**Recommended answer(s):** [(B)]

**Why these are recommended:**

- `(B)` creates a real navigable experience without forcing an immediate replacement of the current root route.
- `(B)` keeps review risk lower than `(A)` while still proving the prototype works end to end better than `(C)` or `(D)`.
- `(C)` is safer but can turn the work into a demo-only implementation rather than a product slice.

## 2. Scope of Prototype Parity

How much of `docs/prototype` should this first implementation recreate?

- [ ] (A) Only the main inbox shell and one representative thread view.
- [ ] (B) The full prototype information architecture: onboarding, screener, inbox, feed, paper trail, tasks, settings, compose, and assistant overlays.
- [ ] (C) All major screens, but simplified interactions where needed as long as the visual and structural parity is preserved.
- [ ] (D) Only the reusable primitives and layout system; application screens can come later.
- [ ] (E) Other (describe)

**Recommended answer(s):** [(C)]

**Why these are recommended:**

- `(C)` best matches “recreate `docs/prototype`” while keeping the spec implementable in phased slices.
- `(B)` may still be right, but it risks turning the first spec into a large all-at-once rewrite if every behavior must be exact immediately.
- `(A)` and `(D)` are smaller, but they undercut the user intent to recreate the prototype experience rather than only parts of it.

## 3. Behavior Fidelity

What level of interaction fidelity should this first version target?

- [ ] (A) Visual parity only; interactions can be static placeholders.
- [ ] (B) Visual parity plus key local interactions from the prototype using local/sample data, without backend integration.
- [ ] (C) Full feature behavior integrated with real backend data and production workflows.
- [ ] (D) Visual parity plus only navigation interactions; overlays and list/thread behaviors can wait.
- [ ] (E) Other (describe)

**Recommended answer(s):** [(B)]

**Why these are recommended:**

- `(B)` preserves the prototype’s feel and makes validation concrete without prematurely inventing backend dependencies.
- `(A)` is easier, but it weakens proof artifacts because the recreated app would not meaningfully behave like the prototype.
- `(C)` is likely too large for a first spec because the current request is framed around recreation of a prototype UI, not a full product backend rollout.

## 4. Component Strategy

How should Solid UI / shadcn-style primitives be used in this implementation?

- [ ] (A) Use library primitives directly with minimal Atlas-specific wrappers.
- [ ] (B) Build Atlas-specific wrapper components on top of Solid UI / shadcn-style primitives so prototype styling and behavior are centralized.
- [ ] (C) Avoid the primitive library unless absolutely necessary and hand-roll all components.
- [ ] (D) Use the primitive library only for overlays/forms and custom-build the mail application surfaces.
- [ ] (E) Other (describe)

**Current best-practice context:** Current SolidJS guidance favors reusable component composition with framework-native control-flow primitives and avoiding React-specific patterns. For a prototype recreation, centralizing style/behavior in wrappers usually produces cleaner reuse and safer iteration than scattering utility classes across screens.

**Recommended answer(s):** [(B), (D)]

**Why these are recommended:**

- `(B)` keeps Atlas visual rules in one place and makes it easier to align Tailwind styling with the prototype’s primitives.
- `(D)` reflects a practical split: primitive libraries help most with forms, dialogs, toggles, and overlays, while specialized mail surfaces often still need custom composition.
- `(A)` is faster initially but can leak prototype-specific styling into many screens.

## 5. Responsive Expectations

What viewport behavior should the recreated web app support in this spec?

- [ ] (A) Desktop-first only, matching the prototype’s fixed shell.
- [ ] (B) Desktop-first with graceful tablet collapse where practical, but no mobile redesign yet.
- [ ] (C) Fully responsive across desktop, tablet, and mobile in this same spec.
- [ ] (D) Match the prototype exactly, even if that means overflow or reduced usability on smaller screens.
- [ ] (E) Other (describe)

**Recommended answer(s):** [(B)]

**Why these are recommended:**

- `(B)` respects the prototype’s desktop-centered structure while avoiding a spec that ignores common browser sizes entirely.
- `(C)` materially increases scope because the prototype is organized as a multi-pane desktop shell.
- `(A)` or `(D)` may be acceptable, but they reduce usability expectations for a web implementation.

## 6. Proof Artifacts

Which proof artifacts should Phase 1 and later implementation phases plan around?

- [ ] (A) Route-level screenshots matching the prototype’s main screens.
- [ ] (B) Browser-driven validation of key interactions (for example onboarding flow, screen navigation, compose modal, assistant panel).
- [ ] (C) Component-level screenshots or stories only.
- [ ] (D) Typecheck/lint output only.
- [ ] (E) Other (describe)

**Recommended answer(s):** [(A), (B), (D)]

**Why these are recommended:**

- `(A)` proves visual recreation.
- `(B)` proves the app behaves like the prototype, not just that static screens render.
- `(D)` is still needed for engineering quality, but by itself it would not prove parity with the prototype.
