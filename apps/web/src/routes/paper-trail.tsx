// Atlas — Paper Trail route (`/paper-trail`).
//
// The mail workspace screen for the Paper Trail category (receipts,
// confirmations, shipping notices). Reuses the shared Atlas workspace
// components — only the `view` differs from `/inbox`, so the list header
// ("Paper Trail"), row treatments, category count, empty/no-thread pane
// behavior, tags, and time metadata all come from the same derivation layer.
//
// Optional search params seed server-rendered proof variants so the
// interaction model is observable:
//   ?sel=<mailId>        — pre-select a different paper-trail row
//
// Screener decisions live in the shared Atlas store: accepted Paper Trail items
// appear here and the nav counts reflect them through provider state (shared
// with `/screener`), so navigation stays stateful with no `?d=` token.

import { createFileRoute } from "@tanstack/solid-router";
import { AtlasApp } from "../components/atlas/atlas_app";
import { useAtlasState } from "../lib/atlas/atlas_state";
import { atlasMailLinkFor } from "../lib/atlas/nav_links";

type PaperTrailSearch = {
	sel?: string;
};

export const Route = createFileRoute("/paper-trail")({
	validateSearch: (search: Record<string, unknown>): PaperTrailSearch => ({
		sel: typeof search.sel === "string" ? search.sel : undefined,
	}),
	component: PaperTrailScreen,
});

function PaperTrailScreen() {
	const search = Route.useSearch();
	const decisions = useAtlasState((s) => s.screener);
	const linkFor = atlasMailLinkFor();

	return (
		<AtlasApp
			view="paper"
			decisions={decisions()}
			linkFor={linkFor}
			initialSelectedId={search().sel}
		/>
	);
}
