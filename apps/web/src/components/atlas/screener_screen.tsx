// Atlas — screener screen (full-width workspace region).
//
// Renders the prototype's `ScreenerScreen`: a centered, scrollable column with
// a "The Screener" header and one `ScreenerCard` per pending first-time sender.
// When every item has been decided, it swaps to the "Screener clear" empty
// state. Mirrors `docs/prototype/screens.jsx` (`ScreenerScreen`).
//
// Decisions arrive as a `?d=` token string (SSR-proof, link-driven — client
// hydration is disabled). Accept / Reject on each card append the new decision
// to that string via the card's `to` + next-`d` builders, so the pending list
// shrinks and accepted items flow into the inbox/feed/paper lists (and the nav
// counts) through the shared derivation helpers in `app_state.ts`.

import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import {
	acceptScreener,
	encodeDecisions,
	pendingScreener,
	rejectScreener,
} from "../../lib/atlas/app_state";
import type { AiCategory, ScreenerDecisions } from "../../lib/atlas/types";
import { EmptyState } from "./empty_state";
import { ScreenerCard } from "./screener_card";

export interface ScreenerScreenProps {
	decisions: ScreenerDecisions;
	/** Route path the card links navigate to (e.g. "/atlas/screener"). */
	to: string;
}

const ScreenerScreen: Component<ScreenerScreenProps> = (props) => {
	const pending = () => pendingScreener(props.decisions);

	const acceptD = (id: string, category: AiCategory): string =>
		encodeDecisions(acceptScreener(props.decisions, id, category));
	const rejectD = (id: string): string =>
		encodeDecisions(rejectScreener(props.decisions, id));

	return (
		<Show
			when={pending().length > 0}
			fallback={
				<div class="atlas-screener-scroll" data-screener-state="clear">
					<EmptyState
						icon="check"
						iconSize={40}
						iconStroke={3}
						heading="Screener clear"
						body="You've decided on everyone in the screener. New first-time senders will land here when they arrive."
					/>
				</div>
			}
		>
			<div class="atlas-screener-scroll" data-screener-state="pending">
				<div class="atlas-screener-inner">
					<div class="atlas-screener-intro">
						<h2 class="atlas-screener-title">The Screener</h2>
						<p class="atlas-screener-sub">
							First-time senders. Decide once — Atlas routes the rest.
						</p>
					</div>
					<For each={pending()}>
						{(item) => (
							<ScreenerCard
								item={item}
								to={props.to}
								acceptD={acceptD}
								rejectD={rejectD}
							/>
						)}
					</For>
				</div>
			</div>
		</Show>
	);
};

export { ScreenerScreen };
