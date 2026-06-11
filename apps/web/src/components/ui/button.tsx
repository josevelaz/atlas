import type { Component, JSX } from "solid-js";
import { mergeProps, splitProps } from "solid-js";
import { buttonClasses } from "../../lib/atlas/component_classes";
import { cn } from "../../lib/utils";

export type ButtonProps = {
	variant?: "default" | "primary" | "danger" | "ghost";
	size?: "default" | "sm";
	icon?: boolean;
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
		"icon",
		"disabled",
		"class",
		"children",
	]);

	return (
		<button
			class={cn(
				// All styling — including the app-shell-only primary star tick (the
				// former `.atlas-app .atlas-btn.is-primary::after` pass) — lives in
				// `buttonClasses`, applied via `[.atlas-app_&]:` ancestor variants.
				buttonClasses({
					variant: local.variant,
					size: local.size,
					icon: local.icon ?? false,
					disabled: local.disabled ?? false,
				}),
				local.class,
			)}
			disabled={local.disabled}
			{...others}
		>
			{local.children}
		</button>
	);
};

export { Button };
