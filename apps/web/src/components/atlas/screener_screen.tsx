// Atlas — screener screen (full-width workspace region).
//
// Renders the prototype's `ScreenerScreen`: a centered, scrollable column with
// a "The Screener" header and one `ScreenerCard` per pending first-time sender.
// When every item has been decided, it swaps to the "Screener clear" empty
// state. Mirrors `docs/prototype/screens.jsx` (`ScreenerScreen`).
//
// Decisions are live: Accept / Reject on each card dispatch into the shared
// Atlas store (`useAtlasActions`), and the pending list is derived from the
// store's screener decisions (`useAtlasState`). Accepting shrinks the pending
// list in place and routes the item into the inbox/feed/paper lists (and the
// nav counts) through the shared derivation helpers in `app_state.ts` — no URL
// change.

import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import { pendingScreener } from "../../lib/atlas/app_state";
import { useAtlasActions, useAtlasState } from "../../lib/atlas/atlas_state";
import { EmptyState } from "./empty_state";
import { ScreenerCard } from "./screener_card";

const ScreenerScreen: Component = () => {
	const decisions = useAtlasState((s) => s.screener);
	const actions = useAtlasActions();
	const pending = () => pendingScreener(decisions());

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
								onAccept={actions.accept}
								onReject={actions.reject}
							/>
						)}
					</For>
				</div>
			</div>
		</Show>
	);
};

export { ScreenerScreen };
