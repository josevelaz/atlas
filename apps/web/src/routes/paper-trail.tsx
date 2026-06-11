// Atlas — Paper Trail route (`/paper-trail`).
//
// A thin view selector: it renders the shared `AtlasApp` shell with the "paper"
// view. The mail-shell wiring (top bar, sidebar, list, thread pane, screener
// decisions, overlays) lives in `AtlasApp` and is shared with `/inbox` and
// `/feed` — only the `view` differs, so this route owns no business state of
// its own.

import { createFileRoute } from "@tanstack/solid-router";
import { AtlasApp } from "../components/atlas/atlas_app";

export const Route = createFileRoute("/paper-trail")({
	component: PaperTrailScreen,
});

function PaperTrailScreen() {
	return <AtlasApp view="paper" />;
}
