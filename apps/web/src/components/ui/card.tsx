import type { Component, JSX } from "solid-js";
import { mergeProps, splitProps } from "solid-js";
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
			class={cn("atlas-card", local.size === "lg" && "is-lg", local.class)}
			{...others}
		>
			{local.children}
		</div>
	);
};

export { Card };
