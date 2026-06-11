// Atlas — priority chip.
//
// Renders the P1/P2/P3 chip used on mail rows and the thread header. Reuses the
// shared `priorityClasses` Tailwind utility (component_classes.ts) so it stays
// in lockstep with the design system: P1 = error red, P2 = feed yellow, P3 =
// neutral surface, all in uppercase mono with a 1.5px border. Mirrors the
// prototype's `.priority.p{n}` chips.

import type { Component } from "solid-js";
import { mergeProps, Show } from "solid-js";
import { priorityClasses } from "../../lib/atlas/component_classes";
import type { Priority } from "../../lib/atlas/types";
import { cn } from "../../lib/utils";

const PRIORITY_LABEL: Record<Priority, string> = {
	1: "P1",
	2: "P2",
	3: "P3",
};

const PRIORITY_KEY: Record<Priority, "P1" | "P2" | "P3"> = {
	1: "P1",
	2: "P2",
	3: "P3",
};

export interface PriorityChipProps {
	priority: Priority;
	/** Append a trailing " priority" word, as in the thread header. */
	withLabel?: boolean;
	class?: string;
}

const PriorityChip: Component<PriorityChipProps> = (raw_props) => {
	const props = mergeProps({ withLabel: false }, raw_props);

	return (
		<span
			// The app-shell retro pass (VT323 sizing + sticker tilt) is baked into
			// `priorityClasses` via `[.atlas-app_&]:` ancestor variants.
			class={cn(
				priorityClasses({ priority: PRIORITY_KEY[props.priority] }),
				props.class,
			)}
		>
			{PRIORITY_LABEL[props.priority]}
			<Show when={props.withLabel}> priority</Show>
		</span>
	);
};

export { PriorityChip };
