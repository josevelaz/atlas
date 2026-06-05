// Atlas — Inbox route (`/atlas/inbox`).
//
// The first dedicated Atlas screen: renders the full desktop mail workspace
// (top bar, sidebar, inbox list, selected thread). Lives under the `/atlas`
// layout segment and does not touch `/`.
//
// Optional search params seed server-rendered proof variants so the
// interaction model (row selection updates the pane; set-aside / reply-later
// toggle state) is observable even when client hydration is unavailable:
//   ?sel=<mailId>        — pre-select a different inbox row
//   ?setAside=1          — render the selected row's "set aside" toggle active
//   ?replyLater=1        — render the selected row's "reply later" toggle active

import { createFileRoute } from "@tanstack/solid-router";
import { AtlasApp } from "../../components/atlas/atlas_app";
import type { ToggleSet } from "../../lib/atlas/types";

type InboxSearch = {
	sel?: string;
	setAside?: boolean;
	replyLater?: boolean;
};

/** Coerce a query value (string/number/boolean) to a boolean flag. */
function asFlag(value: unknown): boolean {
	return value === true || value === 1 || value === "1" || value === "true";
}

export const Route = createFileRoute("/atlas/inbox")({
	validateSearch: (search: Record<string, unknown>): InboxSearch => ({
		sel: typeof search.sel === "string" ? search.sel : undefined,
		setAside: asFlag(search.setAside),
		replyLater: asFlag(search.replyLater),
	}),
	component: InboxScreen,
});

function InboxScreen() {
	const search = Route.useSearch();
	const selectedId = () => search().sel ?? "i1";
	const setAsideMap = (): ToggleSet =>
		search().setAside ? { [selectedId()]: true } : {};
	const replyLaterMap = (): ToggleSet =>
		search().replyLater ? { [selectedId()]: true } : {};

	return (
		<AtlasApp
			initialSelectedId={search().sel}
			initialSetAside={setAsideMap()}
			initialReplyLater={replyLaterMap()}
		/>
	);
}
