// Atlas — Screener route (`/screener`).
//
// A thin view selector: it renders the shared `AtlasApp` shell with the
// "screener" view. `AtlasApp` swaps the list/pane pair for the full-width
// Screener region and owns all shell wiring (top bar, sidebar, screener
// decisions) — this route owns no business state of its own.

import { createFileRoute } from "@tanstack/solid-router";
import { AtlasApp } from "../components/atlas/atlas_app";
import { requireOnboarded } from "../lib/identity/route_guards";

export const Route = createFileRoute("/screener")({
	beforeLoad: requireOnboarded,
	component: ScreenerRoute,
});

function ScreenerRoute() {
	return <AtlasApp view="screener" />;
}
