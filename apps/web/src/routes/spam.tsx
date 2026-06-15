// Atlas — Spam route (`/spam`).
//
// A thin view selector: it renders the shared `AtlasApp` shell with the
// "spam" view. Spam lists provider-flagged threads (server `state = "spam"`),
// kept distinct from the Screener (first-time senders awaiting a decision).
// All shell wiring (top bar, sidebar, mail list, selected thread, overlays)
// lives in `AtlasApp`, driven by the shared Atlas store and the mail query
// layer — this route owns no business state of its own.

import { createFileRoute } from "@tanstack/solid-router";
import { AtlasApp } from "../components/atlas/atlas_app";
import { requireOnboarded } from "../lib/identity/route_guards";

export const Route = createFileRoute("/spam")({
	beforeLoad: requireOnboarded,
	component: SpamScreen,
});

function SpamScreen() {
	return <AtlasApp view="spam" />;
}
