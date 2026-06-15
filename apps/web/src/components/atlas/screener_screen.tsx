// Atlas — screener screen (full-width workspace region).
//
// Renders the prototype's `ScreenerScreen`: a centered, scrollable column with
// a "The Screener" header and one `ScreenerCard` per pending first-time sender.
// When every item has been decided, it swaps to the "Screener clear" empty
// state. Mirrors `docs/prototype/screens.jsx` (`ScreenerScreen`).
//
// Data is server-backed: the pending list is the `screener` view from the mail
// query layer (`lib/mail/queries`), and Accept / Reject on each card dispatch
// user-global sender decisions through `useAcceptSender` / `useRejectSender`.
// On success the mail slice is invalidated, so the screener shrinks in place
// and accepted senders' threads flow into the inbox/feed/paper lists — no URL
// change. The decision is keyed on the sender's email (the server model),
// resolved from each card's `addr`.

import type { Component } from "solid-js";
import { createMemo, For, Show } from "solid-js";
import {
	screenerInnerClasses,
	screenerIntroClasses,
	screenerScrollClasses,
	screenerSubClasses,
	screenerTitleClasses,
} from "../../lib/atlas/component_classes";
import type { AiCategory, ScreenerItem } from "../../lib/atlas/types";
import {
	useAcceptSender,
	useRejectSender,
	useScreenerList,
} from "../../lib/mail/queries";
import { EmptyState } from "./empty_state";
import { ScreenerCard } from "./screener_card";

const ScreenerScreen: Component = () => {
	const { items, isPending } = useScreenerList();
	const accept = useAcceptSender();
	const reject = useRejectSender();

	// Map each card's id back to its sender email so decisions hit the server's
	// user-global sender model. Rebuilt whenever the pending list changes.
	const addrById = createMemo(() => {
		const map = new Map<string, string>();
		for (const item of items()) map.set(item.id, item.addr);
		return map;
	});

	const onAccept = (id: string, category: AiCategory) => {
		const email = addrById().get(id);
		if (email) accept.mutate({ email, category });
	};
	const onReject = (id: string) => {
		const email = addrById().get(id);
		if (email) reject.mutate(email);
	};

	const pending = (): ScreenerItem[] => items();

	return (
		<Show
			when={pending().length > 0}
			fallback={
				<div class={screenerScrollClasses} data-screener-state="clear">
					<EmptyState
						icon="check"
						iconSize={40}
						iconStroke={3}
						heading={isPending() ? "Loading…" : "Screener clear"}
						body={
							isPending()
								? "Fetching first-time senders."
								: "You've decided on everyone in the screener. New first-time senders will land here when they arrive."
						}
					/>
				</div>
			}
		>
			<div class={screenerScrollClasses} data-screener-state="pending">
				<div class={screenerInnerClasses}>
					<div class={screenerIntroClasses}>
						<h2 class={screenerTitleClasses}>The Screener</h2>
						<p class={screenerSubClasses}>
							First-time senders. Decide once — Atlas routes the rest.
						</p>
					</div>
					<For each={pending()}>
						{(item) => (
							<ScreenerCard
								item={item}
								onAccept={onAccept}
								onReject={onReject}
							/>
						)}
					</For>
				</div>
			</div>
		</Show>
	);
};

export { ScreenerScreen };
