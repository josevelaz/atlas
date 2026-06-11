// Atlas — Inbox route (`/inbox`).
//
// The mail workspace screen: top bar, sidebar, inbox list, selected thread.
//
// Row selection and the set-aside / reply-later toggles live in the shared
// Atlas store (`atlas_state.tsx`): clicking a row dispatches `select`, and the
// thread toolbar toggles dispatch `toggleSetAside` / `toggleReplyLater`, so the
// interaction state survives SPA navigation with no `?sel=` / `?setAside=` /
// `?replyLater=` tokens.
//
// Compose and assistant overlay state also live in the shared store: the
// top-bar Compose button, thread Reply, the "Search or ask" button, `/`, ⌘K,
// and Escape all dispatch store actions, so the overlays persist across SPA
// navigation with no `?compose=` / `?ask=` / `?assistant=` tokens.

import { createFileRoute } from "@tanstack/solid-router";
import { AtlasApp } from "../components/atlas/atlas_app";
import { useAtlasState } from "../lib/atlas/atlas_state";
import { atlasMailLinkFor } from "../lib/atlas/nav_links";

export const Route = createFileRoute("/inbox")({
	component: InboxScreen,
});

function InboxScreen() {
	// Screener decisions live in the shared Atlas store; accepted Inbox items and
	// the nav counts derive from it reactively.
	const decisions = useAtlasState((s) => s.screener);

	const linkFor = atlasMailLinkFor();

	return <AtlasApp view="inbox" decisions={decisions()} linkFor={linkFor} />;
}
