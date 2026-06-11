import type { Component, JSX } from "solid-js";
import { mergeProps, splitProps } from "solid-js";
import { buttonClasses } from "../../lib/atlas/component_classes";
import { cn } from "../../lib/utils";

const VARIANT_MARKERS: Record<string, string> = {
	default: "",
	primary: "is-primary",
	danger: "is-danger",
	ghost: "is-ghost",
};

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
				// `atlas-btn` + `is-*` markers are selector hooks for app-shell CSS
				// (e.g. the `.atlas-app .atlas-btn.is-primary::after` star tick); the
				// styling itself comes from the Tailwind utilities below.
				"atlas-btn",
				VARIANT_MARKERS[local.variant],
				local.size === "sm" && "is-sm",
				local.icon && "is-icon",
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
