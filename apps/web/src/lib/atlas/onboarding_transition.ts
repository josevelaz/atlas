// Atlas — onboarding view-transition direction (cached client state).
//
// The onboarding flow is driven by local client state (a step signal in
// `onboarding.tsx`), NOT by the URL. Because a signal update is not a route
// navigation, it won't trigger the router's automatic view transition, so we
// drive the transition ourselves: classify the direction, stamp it onto the
// document root, and run the step mutation inside `document.startViewTransition`.
//
// We cache the last-rendered step in module scope (plain client state that
// survives across renders) and diff against it to classify each transition.
// `direction` is applied as a `data-onb-dir` attribute on <html> that the CSS
// `::view-transition` rules key off of.

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

/** Reset cached step (e.g. when entering / leaving the onboarding flow). */
export function resetOnboardingDirection(): void {
	cachedStep = null;
}

/**
 * Run a step-changing `apply` callback as a directional onboarding transition.
 *
 * Classifies the direction of `nextStep` against the cached step, stamps it
 * onto the document root (`data-onb-dir`) so the CSS `::view-transition` rules
 * pick the right slide, then runs `apply` inside `document.startViewTransition`.
 * Falls back to a plain synchronous `apply` when the View Transitions API is
 * unavailable (older browsers, reduced-motion is handled separately in CSS).
 */
export function startOnboardingTransition(
	nextStep: number,
	apply: () => void,
): void {
	const dir = resolveOnboardingDirection(nextStep);

	if (typeof document === "undefined") {
		apply();
		return;
	}

	document.documentElement.setAttribute("data-onb-dir", dir);

	type DocWithVT = Document & {
		startViewTransition?: (cb: () => void) => unknown;
	};
	const doc = document as DocWithVT;
	if (typeof doc.startViewTransition === "function") {
		doc.startViewTransition(apply);
	} else {
		apply();
	}
}
