// Atlas — Paper Trail route (`/paper-trail`).
//
// The mail workspace screen for the Paper Trail category (receipts,
// confirmations, shipping notices). Reuses the shared Atlas workspace
// components — only the `view` differs from `/inbox`, so the list header
// ("Paper Trail"), row treatments, category count, empty/no-thread pane
// behavior, tags, and time metadata all come from the same derivation layer.
//
// Row selection and the set-aside / reply-later toggles live in the shared
// Atlas store (`atlas_state.tsx`), so selecting a Paper Trail row and toggling
// its handling state survives SPA navigation with no `?sel=` token. Screener
// decisions also live in the store: accepted Paper Trail items appear here and
// the nav counts reflect them through provider state (shared with `/screener`).

import { createFileRoute } from "@tanstack/solid-router";
import { AtlasApp } from "../components/atlas/atlas_app";
import { useAtlasState } from "../lib/atlas/atlas_state";
import { atlasMailLinkFor } from "../lib/atlas/nav_links";

export const Route = createFileRoute("/paper-trail")({
	component: PaperTrailScreen,
});

function PaperTrailScreen() {
	const decisions = useAtlasState((s) => s.screener);
	const linkFor = atlasMailLinkFor();

	return <AtlasApp view="paper" decisions={decisions()} linkFor={linkFor} />;
}
