// Atlas — onboarding view-transition direction (cached client state).
//
// The onboarding flow is link-driven (`?step=N`), so each step is a fresh route
// render. The slide direction of the view transition (forward → slide left,
// backward → slide right) must NOT be derived from the query string — the step
// number alone can't tell us where we came from on a cold load, and encoding a
// direction in the URL would pollute a server-renderable, linkable address.
//
// Instead we cache the last-rendered step in module scope (plain client state
// that survives a same-document navigation / view transition) and diff against
// it to classify the next transition. `direction` is applied as a `data-onb-dir`
// attribute that the CSS `::view-transition` rules key off of.

/** Slide direction for the onboarding step view transition. */
export type OnboardingDirection = "forward" | "backward" | "none";

/** Last step we rendered, or null before the first onboarding render. */
let cachedStep: number | null = null;

/**
 * Resolve the transition direction for `nextStep` against the cached previous
 * step, then update the cache. Pure client state — no URL involvement.
 *
 * - higher step  → "forward"  (new content slides in from the right)
 * - lower step   → "backward" (new content slides in from the left)
 * - same / first → "none"     (no directional slide)
 */
export function resolveOnboardingDirection(
	nextStep: number,
): OnboardingDirection {
	const previous = cachedStep;
	cachedStep = nextStep;
	if (previous === null || previous === nextStep) return "none";
	return nextStep > previous ? "forward" : "backward";
}

/** Reset cached step (e.g. when leaving the onboarding flow). Mainly for tests. */
export function resetOnboardingDirection(): void {
	cachedStep = null;
}
