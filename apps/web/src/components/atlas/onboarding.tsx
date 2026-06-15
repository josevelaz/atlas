// Atlas — onboarding walkthrough card.
//
// The five-step first-run / replay flow: a centered card with a header (logo +
// "Get started — N/5" + Skip), a body (Bungee title, muted sub, the step's
// visual panel), and a footer (Back, step dots, Next / Open Atlas). Mirrors the
// prototype's `Onboarding` component in `docs/prototype/onboarding.jsx`.
//
// The active step is owned by local client state (a signal), NOT the URL — the
// flow no longer uses a `?step=N` query param. Back/Next are buttons that mutate
// the step signal inside a directional view transition (see
// `startOnboardingTransition`). Entering the flow always starts at step 0 (the
// cached transition state is reset on mount), so a fresh entry / replay is clean.
//
// There is no "Skip"/"Open Atlas" bypass: the walkthrough leads and the final
// step is the connect/consent gate, whose visual hosts the only forward path
// (Connect with Google). Un-onboarded users are bounced from gated routes by
// the route guards, so removing the bypass links keeps the UI honest.

import type { Component } from "solid-js";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";

import { ONBOARDING_STEPS } from "../../lib/atlas/app_state";
import {
	buttonClasses,
	gap8Classes,
	onboardingBodyClasses,
	onboardingCardClasses,
	onboardingClasses,
	onboardingFootClasses,
	onboardingHeadClasses,
	onboardingProgressClasses,
	onboardingSubClasses,
	onboardingTitleClasses,
	rowClasses,
	stepDotActiveClasses,
	stepDotClasses,
	stepDotsClasses,
} from "../../lib/atlas/component_classes";
import {
	resetOnboardingDirection,
	startOnboardingTransition,
} from "../../lib/atlas/onboarding_transition";
import type { OnboardingStep } from "../../lib/atlas/types";
import { cn } from "../../lib/utils";
import { AtlasIcon } from "./atlas_icon";
import { Logo } from "./logo";
import { OnboardingVisualPanel } from "./onboarding_visuals";

const Onboarding: Component = () => {
	const total = ONBOARDING_STEPS.length;
	// Active step is local client state. Entering the flow resets the cached
	// transition direction so the first render is non-directional ("none").
	resetOnboardingDirection();
	const [step, setStep] = createSignal(0);

	// step() is always a valid index; the cast keeps the type non-optional under
	// noUncheckedIndexedAccess (ONBOARDING_STEPS is always non-empty).
	const data = (): OnboardingStep => ONBOARDING_STEPS[step()] as OnboardingStep;
	const isLast = () => step() === total - 1;

	// Move to `next` (clamped) as a directional view transition. The direction is
	// derived from cached client state and stamped on <html> as `data-onb-dir`,
	// which the CSS `::view-transition` rules key off of.
	const goToStep = (next: number) => {
		const clamped = Math.min(Math.max(next, 0), total - 1);
		if (clamped === step()) return;
		startOnboardingTransition(clamped, () => setStep(clamped));
	};

	// Clean up the root attribute when leaving the flow.
	onMount(() => {
		onCleanup(() => {
			document.documentElement.removeAttribute("data-onb-dir");
		});
	});

	return (
		<div class={onboardingClasses} data-screen-label="Onboarding">
			{/* The card names its own view-transition (`[view-transition-name:atlas-onb-card]`
			    in onboardingCardClasses) so the global directional slide rules in
			    styles.css can target it — no marker class needed. */}
			<div class={onboardingCardClasses}>
				<div class={onboardingHeadClasses}>
					<div class={cn(rowClasses, gap8Classes)}>
						<Logo markSize={24} />
						<span class={onboardingProgressClasses}>
							Get started — {step() + 1}/{total}
						</span>
					</div>
				</div>

				<div class={onboardingBodyClasses}>
					<h1 class={onboardingTitleClasses}>{data().title}</h1>
					<p class={onboardingSubClasses}>{data().sub}</p>
					<OnboardingVisualPanel visual={data().visual} />
				</div>

				<div class={onboardingFootClasses}>
					<button
						type="button"
						class={buttonClasses({ size: "sm", disabled: step() === 0 })}
						disabled={step() === 0}
						aria-disabled={step() === 0}
						data-action="back"
						onClick={() => goToStep(step() - 1)}
					>
						<AtlasIcon name="back" size={14} /> Back
					</button>

					<div class={stepDotsClasses}>
						<For each={ONBOARDING_STEPS}>
							{(_, i) => (
								<div
									class={cn(
										stepDotClasses,
										i() === step() && stepDotActiveClasses,
									)}
								/>
							)}
						</For>
					</div>

					{/* On the final (connect/consent) step there is no Next/Open
					    Atlas: the connect card's "Connect with Google" CTA is the
					    only forward path. A disabled spacer keeps the footer
					    balanced and signals the gate. */}
					<Show
						when={!isLast()}
						fallback={
							<button
								type="button"
								class={buttonClasses({
									variant: "primary",
									size: "sm",
									disabled: true,
								})}
								disabled
								aria-disabled="true"
								data-action="connect-gate"
							>
								Connect to finish{" "}
								<AtlasIcon name="chevron-right" size={14} stroke={2.5} />
							</button>
						}
					>
						<button
							type="button"
							class={buttonClasses({ variant: "primary", size: "sm" })}
							data-action="next"
							onClick={() => goToStep(step() + 1)}
						>
							Next <AtlasIcon name="chevron-right" size={14} stroke={2.5} />
						</button>
					</Show>
				</div>
			</div>
		</div>
	);
};

export { Onboarding };
