// Atlas — Settings route (`/atlas/settings`).
//
// The Settings screen. Renders the app shell (top bar + sidebar) with the
// full-width Settings region in place of the list/pane pair, mirroring the
// prototype's `view === "settings"` branch. Lives under the `/atlas` layout
// segment and does not touch `/`.
//
// Optional `?d=` search param carries the screener accept/reject token-string so
// the sidebar counts (and onward mail-screen navigation) stay consistent under
// the pre-existing broken-hydration constraint — identical to the other routes.

import { createFileRoute } from "@tanstack/solid-router";
import { AppShell } from "../../components/atlas/app_shell";
import { SettingsScreen } from "../../components/atlas/settings_screen";
import { SidebarNav } from "../../components/atlas/sidebar_nav";
import { TopBar } from "../../components/atlas/top_bar";
import { decodeDecisions } from "../../lib/atlas/app_state";
import { atlasMailLinkFor } from "../../lib/atlas/nav_links";

type SettingsSearch = {
	d?: string;
};

export const Route = createFileRoute("/atlas/settings")({
	validateSearch: (search: Record<string, unknown>): SettingsSearch => ({
		d: typeof search.d === "string" ? search.d : undefined,
	}),
	component: SettingsRoute,
});

function SettingsRoute() {
	const search = Route.useSearch();
	const decisions = () => decodeDecisions(search().d);
	const noop = () => {};

	// SSR-proof nav: keep the current decisions when moving between screens.
	const linkFor = () => atlasMailLinkFor(search().d);

	return (
		<AppShell
			topBar={<TopBar onSearch={noop} onCompose={noop} />}
			sidebar={
				<SidebarNav
					activeView="settings"
					decisions={decisions()}
					linkFor={linkFor()}
				/>
			}
		>
			<div class="atlas-fullpane">
				<SettingsScreen />
			</div>
		</AppShell>
	);
}
