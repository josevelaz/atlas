// Atlas — Feed route (`/atlas/feed`).
//
// The mail workspace screen for the Feed category (newsletters, marketing,
// browse-later content). Reuses the shared Atlas workspace components — only the
// `view` differs from `/atlas/inbox`, so the list header ("The Feed"), row
// treatments, category count, empty/no-thread pane behavior, tags, and time
// metadata all come from the same derivation layer. Lives under the `/atlas`
// layout segment and does not touch `/`.
//
// Optional search params seed server-rendered proof variants so the
// interaction model is observable even when client hydration is unavailable:
//   ?sel=<mailId>        — pre-select a different feed row
//   ?d=<decisions>       — screener accept/reject token-string; accepted Feed
//                          items appear here, and the nav counts reflect it
//                          (shared with `/atlas/screener` so navigation is
//                          stateful under broken hydration).

import { createFileRoute } from "@tanstack/solid-router";
import { AtlasApp } from "../../components/atlas/atlas_app";
import { decodeDecisions } from "../../lib/atlas/app_state";
import { atlasMailLinkFor } from "../../lib/atlas/nav_links";

type FeedSearch = {
	sel?: string;
	d?: string;
};

export const Route = createFileRoute("/atlas/feed")({
	validateSearch: (search: Record<string, unknown>): FeedSearch => ({
		sel: typeof search.sel === "string" ? search.sel : undefined,
		d: typeof search.d === "string" ? search.d : undefined,
	}),
	component: FeedScreen,
});

function FeedScreen() {
	const search = Route.useSearch();
	const decisions = () => decodeDecisions(search().d);

	// SSR-proof nav: keep the current decisions when moving between mail screens.
	const linkFor = () => atlasMailLinkFor(search().d);

	return (
		<AtlasApp
			view="feed"
			decisions={decisions()}
			linkFor={linkFor()}
			initialSelectedId={search().sel}
		/>
	);
}
