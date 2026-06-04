import type { Component } from "solid-js";
import { createSignal, Show } from "solid-js";
import { AppShell } from "./app-shell";
import { Onboarding } from "./onboarding";
import "./hay-inbox-styles.css";

/**
 * HayInboxDemo — top-level container for the /dev/hay-inbox internal demo.
 *
 * Recreates the prototype's first-run model: onboarding is the default surface,
 * and dismissing it (skip or finish) hands off to the main Hay shell. A replay
 * affordance on the shell returns the user to onboarding. All state is local —
 * no backend, no persistence.
 */
export const HayInboxDemo: Component<{ initialStep?: number }> = (props) => {
	// Onboarding is the default first-run surface.
	const [showOnboarding, setShowOnboarding] = createSignal(true);

	return (
		<div class="hay-demo" data-testid="hay-demo-root">
			<Show
				when={showOnboarding()}
				fallback={
					<AppShell onReplayOnboarding={() => setShowOnboarding(true)} />
				}
			>
				<Onboarding
					initialStep={props.initialStep ?? 0}
					onFinish={() => setShowOnboarding(false)}
				/>
			</Show>
		</div>
	);
};
