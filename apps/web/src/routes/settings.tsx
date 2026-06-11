// Atlas — Settings route (`/settings`).
//
// A thin view selector: it renders the shared `AtlasApp` shell with the
// "settings" view. `AtlasApp` swaps the list/pane pair for the full-width
// Settings region and owns all shell wiring (top bar, sidebar, screener
// decisions) — this route owns no business state of its own.

import { createFileRoute } from "@tanstack/solid-router";
import { AtlasApp } from "../components/atlas/atlas_app";
import { requireOnboarded } from "../lib/identity/route_guards";

export const Route = createFileRoute("/settings")({
	beforeLoad: requireOnboarded,
	component: SettingsRoute,
});

function SettingsRoute() {
	return <AtlasApp view="settings" />;
}
