import type { Component, JSX } from "solid-js";
import { mergeProps, splitProps } from "solid-js";
import { cardClasses } from "../../lib/atlas/component_classes";
import { cn } from "../../lib/utils";

export type CardProps = {
	/** Larger 8px radius + 6px shadow for big containers. */
	size?: "default" | "lg";
	class?: string;
	children?: JSX.Element;
} & JSX.HTMLAttributes<HTMLDivElement>;

const Card: Component<CardProps> = (raw_props) => {
	const props = mergeProps({ size: "default" as const }, raw_props);
	const [local, others] = splitProps(props, ["size", "class", "children"]);

	return (
		<div
			// `atlas-card` is a selector hook for app-shell composition
			// (e.g. `.atlas-card.atlas-settings-card`).
			class={cn("atlas-card", cardClasses({ size: local.size }), local.class)}
			{...others}
		>
			{local.children}
		</div>
	);
};

export { Card };
