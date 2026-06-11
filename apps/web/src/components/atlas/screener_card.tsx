// Atlas — screener card.
//
// One first-time sender awaiting a decision. Mirrors the prototype's
// `.screener-card`: avatar + sender head, a clipped preview, the electric-blue
// AI recommendation strip (hint + category pill), and a split Accept / Reject
// action bar. Mirrors `ScreenerScreen`'s card in `docs/prototype/screens.jsx`.
//
// Accept / Reject are live `<button>`s that dispatch into the shared Atlas
// store via the parent's `onAccept` / `onReject` callbacks. The decision is held
// in provider state, so the pending list shrinks in place and accepted items
// flow into the inbox/feed/paper lists without a URL change.

import type { Component } from "solid-js";
import {
	screenerAcceptClasses,
	screenerActionsClasses,
	screenerAddrClasses,
	screenerAiClasses,
	screenerCardClasses,
	screenerHeadClasses,
	screenerHintClasses,
	screenerNameClasses,
	screenerPillClasses,
	screenerPreviewClasses,
	screenerRejectClasses,
	screenerSubjectClasses,
	screenerTimeClasses,
	screenerWhoClasses,
} from "../../lib/atlas/component_classes";
import type { AiCategory, ScreenerItem } from "../../lib/atlas/types";
import { AtlasIcon } from "./atlas_icon";
import { AtlasAvatar } from "./mail_row";

export interface ScreenerCardProps {
	item: ScreenerItem;
	/** Accept this item into `category` (dispatches the live store action). */
	onAccept: (id: string, category: AiCategory) => void;
	/** Reject this item (dispatches the live store action). */
	onReject: (id: string) => void;
}

const ScreenerCard: Component<ScreenerCardProps> = (props) => {
	const item = () => props.item;
	const category = () => item().aiCategory.toUpperCase();

	return (
		<div class={screenerCardClasses} data-screener-id={item().id}>
			<div class={screenerHeadClasses}>
				<AtlasAvatar name={item().from} size="lg" />
				<div class={screenerWhoClasses}>
					<div class={screenerNameClasses}>{item().from}</div>
					<div class={screenerAddrClasses}>{item().addr}</div>
				</div>
				<div class={screenerTimeClasses}>{item().time}</div>
			</div>

			<div class={screenerPreviewClasses}>
				<div class={screenerSubjectClasses}>{item().subject}</div>
				<div>{item().preview}</div>
			</div>

			<div class={screenerAiClasses}>
				<AtlasIcon name="sparkle" size={14} color="#fff" stroke={2.5} />
				<span class={screenerHintClasses}>{item().aiHint}</span>
				<span class={screenerPillClasses}>{category()}</span>
			</div>

			<div class={screenerActionsClasses}>
				<button
					type="button"
					class={screenerAcceptClasses}
					data-action="accept"
					data-category={item().aiCategory}
					onClick={() => props.onAccept(item().id, item().aiCategory)}
				>
					<AtlasIcon name="check" size={18} stroke={3} />
					ACCEPT INTO {category()}
				</button>
				<button
					type="button"
					class={screenerRejectClasses}
					data-action="reject"
					onClick={() => props.onReject(item().id)}
				>
					<AtlasIcon name="hide" size={18} stroke={3} />
					REJECT
				</button>
			</div>
		</div>
	);
};

export { ScreenerCard };
