// Atlas — Feed route (`/feed`).
//
// A thin view selector: it renders the shared `AtlasApp` shell with the "feed"
// view. The mail-shell wiring (top bar, sidebar, list, thread pane, screener
// decisions, overlays) lives in `AtlasApp` and is shared with `/inbox` and
// `/paper-trail` — only the `view` differs, so this route owns no business
// state of its own.

import { createFileRoute } from "@tanstack/solid-router";
import { AtlasApp } from "../components/atlas/atlas_app";
import { requireOnboarded } from "../lib/identity/route_guards";

export const Route = createFileRoute("/feed")({
	beforeLoad: requireOnboarded,
	component: FeedScreen,
});

function FeedScreen() {
	return <AtlasApp view="feed" />;
}
