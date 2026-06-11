// Atlas — Feed route (`/feed`).
//
// The mail workspace screen for the Feed category (newsletters, marketing,
// browse-later content). Reuses the shared Atlas workspace components — only the
// `view` differs from `/inbox`, so the list header ("The Feed"), row
// treatments, category count, empty/no-thread pane behavior, tags, and time
// metadata all come from the same derivation layer.
//
// Optional search params seed server-rendered proof variants so the
// interaction model is observable:
//   ?sel=<mailId>        — pre-select a different feed row
//
// Screener decisions live in the shared Atlas store: accepted Feed items appear
// here and the nav counts reflect them through provider state (shared with
// `/screener`), so navigation stays stateful with no `?d=` token.

import { createFileRoute } from "@tanstack/solid-router";
import { AtlasApp } from "../components/atlas/atlas_app";
import { useAtlasState } from "../lib/atlas/atlas_state";
import { atlasMailLinkFor } from "../lib/atlas/nav_links";

type FeedSearch = {
	sel?: string;
};

export const Route = createFileRoute("/feed")({
	validateSearch: (search: Record<string, unknown>): FeedSearch => ({
		sel: typeof search.sel === "string" ? search.sel : undefined,
	}),
	component: FeedScreen,
});

function FeedScreen() {
	const search = Route.useSearch();
	const decisions = useAtlasState((s) => s.screener);
	const linkFor = atlasMailLinkFor();

	return (
		<AtlasApp
			view="feed"
			decisions={decisions()}
			linkFor={linkFor}
			initialSelectedId={search().sel}
		/>
	);
}
