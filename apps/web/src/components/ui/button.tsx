import type { Component, JSX } from "solid-js";
import { mergeProps, splitProps } from "solid-js";
import { Motion } from "solid-motionone";
import { cn } from "../../lib/utils";

const variant_classes: Record<string, string> = {
	primary: "bg-main text-main-foreground shadow-[var(--shadow)]",
	ghost: "bg-transparent shadow-none",
	default: "bg-secondary-background shadow-[var(--shadow)]",
};

const size_classes: Record<string, string> = {
	default: "h-[36px] px-4 text-sm",
	sm: "h-[28px] px-[10px] text-[12px]",
};

export type ButtonProps = {
	variant?: "primary" | "ghost" | "default";
	size?: "default" | "sm";
	disabled?: boolean;
	class?: string;
	children?: JSX.Element;
} & Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "disabled">;

const Button: Component<ButtonProps> = (raw_props) => {
	const props = mergeProps(
		{ variant: "default" as const, size: "default" as const },
		raw_props,
	);
	const [local, others] = splitProps(props, [
		"variant",
		"size",
		"disabled",
		"class",
		"children",
	]);

	return (
		<Motion.button
			press={
				local.disabled
					? undefined
					: {
							transform: `translate(var(--shadow-x), var(--shadow-y))`,
							"box-shadow": "none",
						}
			}
			hover={
				local.disabled
					? undefined
					: {
							transform: "translate(-1px, -1px)",
							"box-shadow": "5px 5px 0px oklch(0% 0 0)",
						}
			}
			transition={{ duration: 0.12, easing: "ease" }}
			class={cn(
				"inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-[var(--font-weight-base)]",
				"border-[length:var(--border-w)] border-border rounded-[var(--radius)]",
				"transition-[transform,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-base)]",
				"focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-main",
				variant_classes[local.variant],
				size_classes[local.size],
				local.disabled && "opacity-50 cursor-not-allowed pointer-events-none",
				local.class,
			)}
			disabled={local.disabled}
			{...others}
		>
			{local.children}
		</Motion.button>
	);
};

export { Button };
