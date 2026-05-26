import type { Component } from "solid-js";
import { mergeProps } from "solid-js";
import { cn } from "../../lib/utils";

const palette = [
	"var(--color-main)",
	"var(--color-feed)",
	"var(--color-paper)",
	"var(--color-ai)",
	"var(--color-inbox)",
	"var(--color-danger)",
] as const;

const size_map = {
	sm: "h-[28px] w-[28px] text-[10px]",
	default: "h-[36px] w-[36px] text-xs",
	lg: "h-[48px] w-[48px] text-sm",
} as const;

function hash_name(name: string): number {
	let sum = 0;
	for (let i = 0; i < name.length; i++) {
		sum += name.charCodeAt(i);
	}
	return sum % 6;
}

export type AvatarProps = {
	name: string;
	size?: "sm" | "default" | "lg";
	class?: string;
};

const Avatar: Component<AvatarProps> = (raw_props) => {
	const props = mergeProps({ size: "default" as const }, raw_props);

	const initials = () => props.name.slice(0, 2).toUpperCase();
	const bg_color = () => palette[hash_name(props.name)];

	return (
		<div
			class={cn(
				"inline-flex items-center justify-center select-none",
				"border-[length:var(--border-w)] border-border rounded-[var(--radius)]",
				size_map[props.size],
				props.class,
			)}
			style={{
				"background-color": bg_color(),
				transform: "rotate(-1deg)",
				"font-weight": "var(--font-weight-base)",
			}}
			role="img"
			aria-label={props.name}
		>
			{initials()}
		</div>
	);
};

export { Avatar };
