# Learnings: 04-spec-inbox-ui-recreation

## Task 1: Create the protected demo route, prototype styling foundation, and onboarding recreation
- **Discrepancy**: The plan's browser-validation acceptance assumed onboarding interactions could be exercised immediately, but the existing web app had app-wide hydration failures that prevented any click handlers from attaching.
- **Resolution**: Task 1 had to expand into an app-shell/client bootstrap fix (`apps/web/src/lib/auth.ts`, `apps/web/src/client.tsx`, `apps/web/src/routes/__root.tsx`, `apps/web/vite.config.ts`) before `npx agent-browser` could verify real Back/Skip/Next/Open Hay interactions.
- **Suggestion**: Future plans for this web app should explicitly validate baseline hydration/client boot before depending on browser-interaction proof.

## Task 1: Create the protected demo route, prototype styling foundation, and onboarding recreation
- **Discrepancy**: The spec task file expects proof artifacts under `docs/specs/04-spec-inbox-ui-recreation/proof/`, while the loaded SDD Phase 3 reference expects a numbered `04-proofs/04-task-01-proofs.md` convention.
- **Resolution**: Proofs were captured under the spec's existing `proof/` path and reviewer markdown was updated there so the implementation matched the selected spec's documented artifact paths.
- **Suggestion**: Align spec task files with the SDD proof-directory convention, or explicitly declare when a spec intentionally overrides it.

## Task 1: Create the protected demo route, prototype styling foundation, and onboarding recreation
- **Discrepancy**: `docs/specs/` is gitignored even though SDD expects spec-task proof artifacts to be committed.
- **Resolution**: Task and proof files had to be force-added to Git to preserve the spec evidence trail.
- **Suggestion**: Document the force-add convention in the spec workflow or stop gitignoring committed spec artifact paths.

## Task 2: Recreate the main Hay shell, sidebar navigation, and category-specific layouts
- **Discrepancy**: The task asked for a navigation GIF, but `ffmpeg` was unavailable in the environment, so the usual browser-recording path was not available.
- **Resolution**: The GIF was generated deterministically from verified per-screen PNG captures after real nav clicks, then encoded with a pure-JS GIF workflow.
- **Suggestion**: Either provision a standard recording dependency for proof capture or explicitly allow a frame-stitched GIF fallback in the plan.

## Task 2: Recreate the main Hay shell, sidebar navigation, and category-specific layouts
- **Discrepancy**: Task 2 only owned shell/navigation work, so the reading pane could not yet render the full prototype thread details referenced elsewhere in the spec.
- **Resolution**: The shell now renders correct navigation, selection state, and a clearly labeled thread placeholder, leaving sender metadata / AI summary / extracted tasks-dates to task 3.
- **Suggestion**: Call out placeholder allowances explicitly in shell-stage tasks when downstream tasks own the detailed pane content.

## Task 3: Recreate mock mail data flows, thread reading, and local Screener triage behavior
- **Discrepancy**: The task uncovered a latent shell bug from task 2 where switching between Inbox / Feed / Paper could keep rendering the previous category's rows due to stale reactive capture.
- **Resolution**: The shell now derives `activeCategory` and `selectedRow` reactively so list and reading-pane content track the active category correctly.
- **Suggestion**: Add explicit cross-category switching checks to shell-stage acceptance criteria, not just same-category row selection.

## Task 3: Recreate mock mail data flows, thread reading, and local Screener triage behavior
- **Discrepancy**: Browser validation initially hit stale `vite preview` assets on port 3001, which could have produced misleading hydration results during proof capture.
- **Resolution**: Restarted the preview server on the trusted 3001 origin before final `agent-browser` verification and proof generation.
- **Suggestion**: Future plans that rely on repeated browser proof capture should call out preview-server freshness/restart expectations.

## Task 4: Recreate overlays, secondary screens, keyboard interactions, and final fidelity polish
- **Discrepancy**: Browser automation could reliably validate overlay behavior through UI controls, but a bare `/` keystroke could sometimes be intercepted by browser chrome instead of the page during automated proof capture.
- **Resolution**: The shared overlay-open path was validated through the UI control while keeping the `/` keyboard handler implemented in code alongside `Ctrl/Cmd-K`.
- **Suggestion**: For browser-proofable shortcut requirements, specify an acceptable validation fallback when browser chrome may intercept global-like keys.

## Fidelity pass: Onboarding parity
- **Discrepancy**: The prototype/design expect yellow-centric accent usage (`#FACC00`) for the `HAY.` logo chip and primary controls, but the shared app token backing `--color-main` currently resolves to a blue/purple value in `apps/web/src/styles.css`.
- **Resolution**: The onboarding pass matched prototype structure/content/token usage without broad token changes, leaving the shared-token mismatch in place for later shell/chrome correction.
- **Suggestion**: Treat shared token alignment as a first-class fidelity task, not just per-component CSS cleanup, because it affects shell-wide proof accuracy.

## Fidelity pass: Data/content parity
- **Discrepancy**: The auth guard on `/dev/hay-inbox` currently routes unauthenticated sessions into an auth chain that fails in this environment because desktop-only Tauri modules are unresolved in `apps/web`, which complicates browser proof capture.
- **Resolution**: Validation temporarily bypassed the session check locally and reverted it before commit; no auth-guard bypass was shipped as part of the content pass.
- **Suggestion**: Track the auth/desktop module resolution issue separately so future fidelity validation does not depend on temporary local bypasses.
