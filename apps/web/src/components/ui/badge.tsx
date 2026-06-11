import type { Component, JSX } from "solid-js";
import { mergeProps, splitProps } from "solid-js";
import {
	badgeClasses,
	priorityClasses,
} from "../../lib/atlas/component_classes";
import { cn } from "../../lib/utils";

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
				// `atlas-priority` is a selector hook for the app-shell retro pass
				// (`.atlas-app .atlas-priority` rotation/VT323 sizing).
				class={cn(
					"atlas-priority",
					priorityClasses({ priority: local.priority }),
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
			// `atlas-badge` is a selector hook for the app-shell retro pass
			// (e.g. `.atlas-app .atlas-tasks-col-head .atlas-badge` rotation).
			class={cn(
				"atlas-badge",
				badgeClasses({
					variant: local.variant,
					square: local.square ?? false,
				}),
				local.class,
			)}
			{...others}
		>
			{local.children}
		</span>
	);
};

export { Badge };
