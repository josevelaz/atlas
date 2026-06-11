// Atlas — Screener route (`/screener`).
//
// The first-time-sender triage screen. Renders the app shell (top bar +
// sidebar) with the full-width screener region in place of the list/pane pair,
// mirroring the prototype's `view === "screener"` branch (`gridColumn: 2 / 4`).
//
// Screener decisions live in the shared Atlas store (`atlas_state.tsx`): each
// Accept / Reject dispatches a live store action, the pending list shrinks in
// place (no URL change), the "Screener clear" empty state appears once all are
// decided, the sidebar counts update, and accepted items flow into `/inbox`
// (and Feed / Paper Trail) via the shared derivation helpers in `app_state.ts`.

import { createFileRoute } from "@tanstack/solid-router";
import { AppShell } from "../components/atlas/app_shell";
import { ScreenerScreen } from "../components/atlas/screener_screen";
import { SidebarNav } from "../components/atlas/sidebar_nav";
import { TopBar } from "../components/atlas/top_bar";
import { atlasMailLinkFor } from "../lib/atlas/nav_links";

export const Route = createFileRoute("/screener")({
	component: ScreenerRoute,
});

function ScreenerRoute() {
	const noop = () => {};
	const linkFor = atlasMailLinkFor();

	return (
		<AppShell
			topBar={<TopBar onSearch={noop} onCompose={noop} />}
			sidebar={<SidebarNav activeView="screener" linkFor={linkFor} />}
		>
			<div class="atlas-list is-wide">
				<ScreenerScreen />
			</div>
		</AppShell>
	);
}
