import type { Component, JSX } from "solid-js";
import { mergeProps, splitProps } from "solid-js";
import { cn } from "../../lib/utils";

const variant_classes: Record<string, string> = {
	default: "",
	main: "is-main",
	feed: "is-feed",
	paper: "is-paper",
	ai: "is-ai",
	danger: "is-danger",
	inbox: "is-inbox",
	muted: "is-muted",
};

const priority_classes: Record<string, string> = {
	P1: "is-p1",
	P2: "is-p2",
	P3: "is-p3",
};

export type BadgeProps = {
	variant?:
		| "default"
		| "main"
		| "feed"
		| "paper"
		| "ai"
		| "danger"
		| "inbox"
		| "muted";
	square?: boolean;
	priority?: "P1" | "P2" | "P3";
	class?: string;
	children?: JSX.Element;
};

const Badge: Component<BadgeProps> = (raw_props) => {
	const props = mergeProps({ variant: "default" as const }, raw_props);
	const [local, others] = splitProps(props, [
		"variant",
		"square",
		"priority",
		"class",
		"children",
	]);

	if (local.priority) {
		return (
			<span
				class={cn(
					"atlas-priority",
					priority_classes[local.priority],
					local.class,
				)}
				{...others}
			>
				{local.priority}
			</span>
		);
	}

	return (
		<span
			class={cn(
				"atlas-badge",
				variant_classes[local.variant],
				local.square && "is-square",
				local.class,
			)}
			{...others}
		>
			{local.children}
		</span>
	);
};

export { Badge };
