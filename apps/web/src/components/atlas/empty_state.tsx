// Atlas — empty-state panel.
//
// Centered icon-box + heading + body used when no thread is selected or a list
// is empty. Mirrors the prototype's `.empty` block (yellow icon box with a hard
// offset shadow, Bungee heading, muted body copy).

import type { Component } from "solid-js";
import { mergeProps } from "solid-js";
import { AtlasIcon, type IconName } from "./atlas_icon";

export interface EmptyStateProps {
	icon: IconName;
	iconSize?: number;
	iconStroke?: number;
	heading: string;
	body: string;
}

const EmptyState: Component<EmptyStateProps> = (raw_props) => {
	const props = mergeProps({ iconSize: 36, iconStroke: 2.5 }, raw_props);

	return (
		<div class="atlas-empty">
			<div class="atlas-empty-box">
				<AtlasIcon
					name={props.icon}
					size={props.iconSize}
					stroke={props.iconStroke}
				/>
			</div>
			<h3>{props.heading}</h3>
			<p>{props.body}</p>
		</div>
	);
};

export { EmptyState };
