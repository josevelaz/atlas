// Atlas — Inbox route (`/inbox`).
//
// A thin view selector: it renders the shared `AtlasApp` shell with the
// "inbox" view. All shell wiring (top bar, sidebar, mail list, selected
// thread, screener decisions, and the compose / assistant overlays) lives in
// `AtlasApp`, driven by the shared Atlas store — this route owns no business
// state of its own.

import { createFileRoute } from "@tanstack/solid-router";
import { AtlasApp } from "../components/atlas/atlas_app";

export const Route = createFileRoute("/inbox")({
	component: InboxScreen,
});

function InboxScreen() {
	return <AtlasApp view="inbox" />;
}
