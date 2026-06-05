import type { Component, JSX } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "../../lib/utils";

export type KbdProps = {
	class?: string;
	children?: JSX.Element;
} & JSX.HTMLAttributes<HTMLElement>;

const Kbd: Component<KbdProps> = (raw_props) => {
	const [local, others] = splitProps(raw_props, ["class", "children"]);
	return (
		<kbd class={cn("atlas-kbd", local.class)} {...others}>
			{local.children}
		</kbd>
	);
};

export { Kbd };
