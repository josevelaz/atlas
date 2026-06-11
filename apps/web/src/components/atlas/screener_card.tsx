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
		<div class="atlas-screener-card" data-screener-id={item().id}>
			<div class="atlas-screener-head">
				<AtlasAvatar name={item().from} size="lg" />
				<div style={{ flex: 1, "min-width": 0 }}>
					<div class="atlas-screener-name">{item().from}</div>
					<div class="atlas-screener-addr">{item().addr}</div>
				</div>
				<div class="atlas-screener-time">{item().time}</div>
			</div>

			<div class="atlas-screener-preview">
				<div class="atlas-screener-subject">{item().subject}</div>
				<div>{item().preview}</div>
			</div>

			<div class="atlas-screener-ai">
				<AtlasIcon name="sparkle" size={14} color="#fff" stroke={2.5} />
				<span style={{ flex: 1 }}>{item().aiHint}</span>
				<span class="atlas-screener-pill">{category()}</span>
			</div>

			<div class="atlas-screener-actions">
				<button
					type="button"
					class="atlas-screener-accept"
					data-action="accept"
					data-category={item().aiCategory}
					onClick={() => props.onAccept(item().id, item().aiCategory)}
				>
					<AtlasIcon name="check" size={18} stroke={3} />
					ACCEPT INTO {category()}
				</button>
				<button
					type="button"
					class="atlas-screener-reject"
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
