import type { Component, JSX } from "solid-js";
import { mergeProps, splitProps } from "solid-js";
import { cn } from "../../lib/utils";

const variant_bg: Record<string, string> = {
	default: "bg-secondary-background",
	main: "bg-main",
	feed: "bg-feed",
	paper: "bg-paper",
	ai: "bg-ai",
	danger: "bg-danger",
	inbox: "bg-inbox",
	muted: "bg-muted",
};

const priority_to_variant: Record<string, string> = {
	P1: "danger",
	P2: "feed",
	P3: "default",
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

	const resolved_variant = (): string =>
		local.priority
			? (priority_to_variant[local.priority] ?? local.variant)
			: local.variant;

	return (
		<span
			class={cn(
				"inline-flex items-center justify-center px-2 py-0.5 text-xs font-[var(--font-weight-base)]",
				"border-[length:var(--border-w)] border-border min-h-[22px]",
				"transition-transform duration-[var(--duration-base)] ease-[var(--ease-base)]",
				"hover:scale-105",
				local.square ? "rounded-[var(--radius)]" : "rounded-full",
				variant_bg[resolved_variant()],
				local.class,
			)}
			style={{ transform: "rotate(-1.2deg)" }}
			{...others}
		>
			{local.priority ? local.priority : local.children}
		</span>
	);
};

export { Badge };
