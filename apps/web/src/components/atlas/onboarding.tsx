// Atlas — onboarding walkthrough card.
//
// The five-step first-run / replay flow: a centered card with a header (logo +
// "Get started — N/5" + Skip), a body (Bungee title, muted sub, the step's
// visual panel), and a footer (Back, step dots, Next / Open Atlas). Mirrors the
// prototype's `Onboarding` component in `docs/prototype/onboarding.jsx`.
//
// Navigation is link-driven. Each control is a `<Link>` that renders a real
// `<a href>` server-side:
//   • Back / Next  → same onboarding route with `?step=N`
//   • Skip / Open Atlas → `/atlas/inbox`
// The current step is owned by the route (driven by the `step` search param), so
// every transition is observable in server-rendered output.

import { Link } from "@tanstack/solid-router";
import type { Component } from "solid-js";
import { For, Show, createEffect, createMemo, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";
import { ONBOARDING_STEPS } from "../../lib/atlas/app_state";
import { resolveOnboardingDirection } from "../../lib/atlas/onboarding_transition";
import type { OnboardingStep } from "../../lib/atlas/types";
import { cn } from "../../lib/utils";
import { AtlasIcon } from "./atlas_icon";
import { Logo } from "./logo";
import { OnboardingVisualPanel } from "./onboarding_visuals";

export interface OnboardingProps {
	/** Current step index (0-based), clamped by the route. */
	step: number;
	/** Route path the Back/Next links point at (e.g. "/atlas" or "/atlas/onboarding"). */
	basePath: "/atlas" | "/atlas/onboarding";
}

const Onboarding: Component<OnboardingProps> = (props) => {
	const total = ONBOARDING_STEPS.length;
	const step = () => Math.min(Math.max(props.step, 0), total - 1);
	// step() is clamped to a valid index; the cast keeps the type non-optional
	// under noUncheckedIndexedAccess (ONBOARDING_STEPS is always non-empty).
	const data = (): OnboardingStep => ONBOARDING_STEPS[step()] as OnboardingStep;
	const isLast = () => step() === total - 1;
	// Slide direction for the view transition, from cached client state (the
	// previously rendered step) rather than the URL. forward → slide in from the
	// right, backward → slide in from the left, none → no directional slide.
	// A memo guarantees `resolveOnboardingDirection` (which mutates the cached
	// step) runs exactly once per step change, regardless of how many readers
	// (effect + JSX) access it — calling it per-read would advance the cache
	// twice and collapse the result to "none".
	const direction = createMemo(() => resolveOnboardingDirection(step()));

	// The `::view-transition-*` pseudo-elements hang off the document root, so the
	// directional CSS keys off `data-onb-dir` on <html>, not on this subtree. We
	// mirror the cached direction onto the root element on the client only (the
	// attribute is meaningless during SSR and is cleaned up on unmount).
	if (!isServer) {
		createEffect(() => {
			const dir = direction();
			document.documentElement.setAttribute("data-onb-dir", dir);
		});
		onCleanup(() => {
			document.documentElement.removeAttribute("data-onb-dir");
		});
	}

	return (
		<div class="atlas-onboarding" data-screen-label="Onboarding">
			<div class="atlas-onboarding-card">
				<div class="atlas-onboarding-head">
					<div class="atlas-row atlas-gap-8">
						<Logo markSize={24} />
						<span class="atlas-onb-progress">
							Get started — {step() + 1}/{total}
						</span>
					</div>
					<Link
						to="/atlas/inbox"
						class="atlas-btn is-ghost is-sm"
						data-action="skip"
					>
						Skip
					</Link>
				</div>

				<div class="atlas-onboarding-body">
					<h1 class="atlas-onb-title">{data().title}</h1>
					<p class="atlas-onb-sub">{data().sub}</p>
					<OnboardingVisualPanel visual={data().visual} />
				</div>

				<div class="atlas-onboarding-foot">
					<Show
						when={step() > 0}
						fallback={
							<button
								type="button"
								class="atlas-btn is-sm"
								disabled
								aria-disabled="true"
							>
								<AtlasIcon name="back" size={14} /> Back
							</button>
						}
					>
						<Link
							to={props.basePath}
							search={{ step: step() - 1 }}
							class="atlas-btn is-sm"
							data-action="back"
						>
							<AtlasIcon name="back" size={14} /> Back
						</Link>
					</Show>

					<div class="atlas-step-dots">
						<For each={ONBOARDING_STEPS}>
							{(_, i) => (
								<div
									class={cn("atlas-step-dot", i() === step() && "is-active")}
								/>
							)}
						</For>
					</div>

					<Show
						when={!isLast()}
						fallback={
							<Link
								to="/atlas/inbox"
								class="atlas-btn is-primary is-sm"
								data-action="open"
							>
								Open Atlas{" "}
								<AtlasIcon name="chevron-right" size={14} stroke={2.5} />
							</Link>
						}
					>
						<Link
							to={props.basePath}
							search={{ step: step() + 1 }}
							class="atlas-btn is-primary is-sm"
							data-action="next"
						>
							Next <AtlasIcon name="chevron-right" size={14} stroke={2.5} />
						</Link>
					</Show>
				</div>
			</div>
		</div>
	);
};

export { Onboarding };
