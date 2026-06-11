// Atlas — Feed route (`/feed`).
//
// The mail workspace screen for the Feed category (newsletters, marketing,
// browse-later content). Reuses the shared Atlas workspace components — only the
// `view` differs from `/inbox`, so the list header ("The Feed"), row
// treatments, category count, empty/no-thread pane behavior, tags, and time
// metadata all come from the same derivation layer.
//
// Row selection and the set-aside / reply-later toggles live in the shared
// Atlas store (`atlas_state.tsx`), so selecting a Feed row and toggling its
// handling state survives SPA navigation with no `?sel=` token. Screener
// decisions also live in the store: accepted Feed items appear here and the nav
// counts reflect them through provider state (shared with `/screener`).

import { createFileRoute } from "@tanstack/solid-router";
import { AtlasApp } from "../components/atlas/atlas_app";
import { useAtlasState } from "../lib/atlas/atlas_state";
import { atlasMailLinkFor } from "../lib/atlas/nav_links";

export const Route = createFileRoute("/feed")({
	component: FeedScreen,
});

function FeedScreen() {
	const decisions = useAtlasState((s) => s.screener);
	const linkFor = atlasMailLinkFor();

	return <AtlasApp view="feed" decisions={decisions()} linkFor={linkFor} />;
}
