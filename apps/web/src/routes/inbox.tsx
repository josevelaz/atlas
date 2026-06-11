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
// Optional search params seed server-rendered proof variants so the
// interaction model is observable even when client hydration is unavailable:
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
import { AtlasApp } from "../components/atlas/atlas_app";
import { decodeComposeMode } from "../lib/atlas/app_state";
import { useAtlasState } from "../lib/atlas/atlas_state";
import { atlasMailLinkFor } from "../lib/atlas/nav_links";

type InboxSearch = {
	compose?: string;
	ask?: string;
	assistant?: boolean;
};

/** Coerce a query value (string/number/boolean) to a boolean flag. */
function asFlag(value: unknown): boolean {
	return value === true || value === 1 || value === "1" || value === "true";
}

export const Route = createFileRoute("/inbox")({
	validateSearch: (search: Record<string, unknown>): InboxSearch => ({
		compose: typeof search.compose === "string" ? search.compose : undefined,
		ask: typeof search.ask === "string" ? search.ask : undefined,
		assistant: asFlag(search.assistant),
	}),
	component: InboxScreen,
});

function InboxScreen() {
	const search = Route.useSearch();
	// Screener decisions live in the shared Atlas store; accepted Inbox items and
	// the nav counts derive from it reactively.
	const decisions = useAtlasState((s) => s.screener);

	const composeMode = () => decodeComposeMode(search().compose);

	const linkFor = atlasMailLinkFor();

	return (
		<AtlasApp
			view="inbox"
			decisions={decisions()}
			linkFor={linkFor}
			initialCompose={composeMode()}
			initialAsk={search().ask}
			initialAssistantOpen={search().assistant}
		/>
	);
}
