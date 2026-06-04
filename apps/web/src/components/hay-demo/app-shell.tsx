import type { Component } from "solid-js";

/**
 * AppShell — placeholder main Hay shell surface for the /dev/hay-inbox demo.
 *
 * Task 1 scope: provide a clean handoff target so onboarding can dismiss into
 * the "main Hay experience". The full topbar / sidebar / panes are built out
 * in parent task 2.0. For now this renders a minimal branded shell that proves
 * the onboarding → shell transition works, with an affordance to replay
 * onboarding (wired by the parent demo container).
 */
export const AppShell: Component<{ onReplayOnboarding: () => void }> = (
	props,
) => {
	return (
		<div class="shell-placeholder" data-testid="hay-shell">
			<div class="shell-card">
				<span class="wordmark" style={{ "font-size": "24px" }}>
					HAY
				</span>
				<h1>You're in.</h1>
				<p>
					Onboarding is complete. The full Hay shell — topbar, sidebar,
					Screener, Inbox, Feed, Paper Trail, Tasks &amp; Dates, and Settings —
					lands in the next implementation milestone.
				</p>
				<div style={{ display: "flex", gap: "8px" }}>
					<button
						type="button"
						class="btn"
						onClick={() => props.onReplayOnboarding()}
						data-testid="replay-onboarding"
					>
						Replay onboarding
					</button>
				</div>
			</div>
		</div>
	);
};
