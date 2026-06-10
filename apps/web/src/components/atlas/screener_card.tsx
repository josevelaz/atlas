// Atlas — screener card.
//
// One first-time sender awaiting a decision. Mirrors the prototype's
// `.screener-card`: avatar + sender head, a clipped preview, the electric-blue
// AI recommendation strip (hint + category pill), and a split Accept / Reject
// action bar. Mirrors `ScreenerScreen`'s card in `docs/prototype/screens.jsx`.
//
// Client hydration is disabled (pre-existing TanStack/Solid error), so the
// Accept / Reject controls are rendered as `<Link>`s that carry the next
// cumulative decision token-string in the `?d=` search param (matching the
// onboarding flow's link-driven SSR-proof pattern). The parent supplies the
// `to` path and the next-`d` builders so the card stays route-agnostic.

import { Link } from "@tanstack/solid-router";
import type { Component } from "solid-js";
import type { AiCategory, ScreenerItem } from "../../lib/atlas/types";
import { AtlasIcon } from "./atlas_icon";
import { AtlasAvatar } from "./mail_row";

export interface ScreenerCardProps {
	item: ScreenerItem;
	/** Route path the Accept / Reject links navigate to (e.g. "/screener"). */
	to: string;
	/** Next `?d=` token string after accepting this item into `category`. */
	acceptD: (id: string, category: AiCategory) => string;
	/** Next `?d=` token string after rejecting this item. */
	rejectD: (id: string) => string;
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
				<Link
					to={props.to}
					search={{ d: props.acceptD(item().id, item().aiCategory) }}
					class="atlas-screener-accept"
					data-action="accept"
					data-category={item().aiCategory}
				>
					<AtlasIcon name="check" size={18} stroke={3} />
					ACCEPT INTO {category()}
				</Link>
				<Link
					to={props.to}
					search={{ d: props.rejectD(item().id) }}
					class="atlas-screener-reject"
					data-action="reject"
				>
					<AtlasIcon name="hide" size={18} stroke={3} />
					REJECT
				</Link>
			</div>
		</div>
	);
};

export { ScreenerCard };
