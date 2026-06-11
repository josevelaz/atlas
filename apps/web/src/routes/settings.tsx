// Atlas — Settings route (`/settings`).
//
// The Settings screen. Renders the app shell (top bar + sidebar) with the
// full-width Settings region in place of the list/pane pair, mirroring the
// prototype's `view === "settings"` branch.
//
// Screener decisions live in the shared Atlas store, so the sidebar counts (and
// onward mail-screen navigation) stay consistent through provider state — no
// `?d=` token, identical to the other routes.

import { createFileRoute } from "@tanstack/solid-router";
import { AppShell } from "../components/atlas/app_shell";
import { SettingsScreen } from "../components/atlas/settings_screen";
import { SidebarNav } from "../components/atlas/sidebar_nav";
import { TopBar } from "../components/atlas/top_bar";
import { atlasMailLinkFor } from "../lib/atlas/nav_links";

export const Route = createFileRoute("/settings")({
	component: SettingsRoute,
});

function SettingsRoute() {
	const noop = () => {};
	const linkFor = atlasMailLinkFor();

	return (
		<AppShell
			topBar={<TopBar onSearch={noop} onCompose={noop} />}
			sidebar={<SidebarNav activeView="settings" linkFor={linkFor} />}
		>
			<div class="atlas-fullpane">
				<SettingsScreen />
			</div>
		</AppShell>
	);
}
