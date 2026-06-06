// Atlas — Inbox route (`/atlas/inbox`).
//
// The mail workspace screen: top bar, sidebar, inbox list, selected thread.
// Lives under the `/atlas` layout segment and does not touch `/`.
//
// Optional search params seed server-rendered proof variants so the
// interaction model is observable even when client hydration is unavailable:
//   ?sel=<mailId>        — pre-select a different inbox row
//   ?setAside=1          — render the selected row's "set aside" toggle active
//   ?replyLater=1        — render the selected row's "reply later" toggle active
//   ?d=<decisions>       — screener accept/reject token-string; accepted Inbox
//                          items appear here, and the nav counts reflect it
//                          (shared with `/atlas/screener` so navigation is
//                          stateful under broken hydration).
//   ?compose=new|reply   — open the compose overlay server-side (proof variant):
//                          `new` opens a blank "New message"; `reply` opens a
//                          "Reply" prefilled from the selected row's sender.
//   ?assistant=1         — open the Ask Atlas assistant server-side in its
//                          initial state (intro bubble + example chips), no
//                          seeded query (proof variant).
//   ?ask=<query>         — open the Ask Atlas assistant server-side (proof
//                          variant), seeded with a submitted query so the chat
//                          response + citations render inline (e.g. a Priya /
//                          Stripe / screener / Marcus example prompt).

import { createFileRoute } from "@tanstack/solid-router";
import { AtlasApp } from "../../components/atlas/atlas_app";
import { decodeComposeMode, decodeDecisions } from "../../lib/atlas/app_state";
import { atlasMailLinkFor } from "../../lib/atlas/nav_links";
import type { ToggleSet } from "../../lib/atlas/types";

type InboxSearch = {
	sel?: string;
	setAside?: boolean;
	replyLater?: boolean;
	d?: string;
	compose?: string;
	ask?: string;
	assistant?: boolean;
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
		d: typeof search.d === "string" ? search.d : undefined,
		compose: typeof search.compose === "string" ? search.compose : undefined,
		ask: typeof search.ask === "string" ? search.ask : undefined,
		assistant: asFlag(search.assistant),
	}),
	component: InboxScreen,
});

function InboxScreen() {
	const search = Route.useSearch();
	const selectedId = () => search().sel ?? "i1";
	const decisions = () => decodeDecisions(search().d);
	const setAsideMap = (): ToggleSet =>
		search().setAside ? { [selectedId()]: true } : {};
	const replyLaterMap = (): ToggleSet =>
		search().replyLater ? { [selectedId()]: true } : {};

	const composeMode = () => decodeComposeMode(search().compose);

	// SSR-proof nav: keep the current decisions when moving between mail screens.
	const linkFor = () => atlasMailLinkFor(search().d);

	return (
		<AtlasApp
			view="inbox"
			decisions={decisions()}
			linkFor={linkFor()}
			initialSelectedId={search().sel}
			initialSetAside={setAsideMap()}
			initialReplyLater={replyLaterMap()}
			initialCompose={composeMode()}
			initialAsk={search().ask}
			initialAssistantOpen={search().assistant}
		/>
	);
}
