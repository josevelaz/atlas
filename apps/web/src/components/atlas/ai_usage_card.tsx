// Atlas — AI usage meter card.
//
// Electric-blue card pinned to the bottom of the sidebar: sparkle + "AI USAGE"
// label, a thin progress track, and a mono "x/100 monthly · Free tier" readout.
// Mirrors the prototype's sidebar usage block.

import type { Component } from "solid-js";
import { mergeProps } from "solid-js";
import {
	usageCardClasses,
	usageFillClasses,
	usageLabelClasses,
	usageLabelTextClasses,
	usageMetaClasses,
	usageTrackClasses,
} from "../../lib/atlas/component_classes";
import { AtlasIcon } from "./atlas_icon";

export interface AiUsageCardProps {
	/** Used credits this month. */
	used?: number;
	/** Monthly credit allowance. */
	total?: number;
	tier?: string;
}

const AiUsageCard: Component<AiUsageCardProps> = (raw_props) => {
	const props = mergeProps(
		{ used: 34, total: 100, tier: "Free tier" },
		raw_props,
	);
	const pct = () =>
		Math.max(0, Math.min(100, Math.round((props.used / props.total) * 100)));

	return (
		<div class={usageCardClasses}>
			<div class={usageLabelClasses}>
				<AtlasIcon name="sparkle" size={12} color="#fff" stroke={2.5} />
				<span class={usageLabelTextClasses}>AI usage</span>
			</div>
			<div class={usageTrackClasses}>
				<div class={usageFillClasses} style={{ width: `${pct()}%` }} />
			</div>
			<div class={usageMetaClasses}>
				{props.used}/{props.total} monthly · {props.tier}
			</div>
		</div>
	);
};

export { AiUsageCard };
