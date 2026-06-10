// Atlas — Paper Trail route (`/paper-trail`).
//
// The mail workspace screen for the Paper Trail category (receipts,
// confirmations, shipping notices). Reuses the shared Atlas workspace
// components — only the `view` differs from `/inbox`, so the list header
// ("Paper Trail"), row treatments, category count, empty/no-thread pane
// behavior, tags, and time metadata all come from the same derivation layer.
//
// Optional search params seed server-rendered proof variants so the
// interaction model is observable even when client hydration is unavailable:
//   ?sel=<mailId>        — pre-select a different paper-trail row
//   ?d=<decisions>       — screener accept/reject token-string; accepted Paper
//                          Trail items appear here, and the nav counts reflect
//                          it (shared with `/screener` so navigation is
//                          stateful under broken hydration).

import { createFileRoute } from "@tanstack/solid-router";
import { AtlasApp } from "../components/atlas/atlas_app";
import { decodeDecisions } from "../lib/atlas/app_state";
import { atlasMailLinkFor } from "../lib/atlas/nav_links";

type PaperTrailSearch = {
	sel?: string;
	d?: string;
};

export const Route = createFileRoute("/paper-trail")({
	validateSearch: (search: Record<string, unknown>): PaperTrailSearch => ({
		sel: typeof search.sel === "string" ? search.sel : undefined,
		d: typeof search.d === "string" ? search.d : undefined,
	}),
	component: PaperTrailScreen,
});

function PaperTrailScreen() {
	const search = Route.useSearch();
	const decisions = () => decodeDecisions(search().d);

	// SSR-proof nav: keep the current decisions when moving between mail screens.
	const linkFor = () => atlasMailLinkFor(search().d);

	return (
		<AtlasApp
			view="paper"
			decisions={decisions()}
			linkFor={linkFor()}
			initialSelectedId={search().sel}
		/>
	);
}
