import type { Component, JSX } from "solid-js";
import { mergeProps, splitProps } from "solid-js";
import { cn } from "../../lib/utils";

const variant_classes: Record<string, string> = {
	default: "",
	primary: "is-primary",
	danger: "is-danger",
	ghost: "is-ghost",
};

const size_classes: Record<string, string> = {
	default: "",
	sm: "is-sm",
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
				"atlas-btn",
				variant_classes[local.variant],
				size_classes[local.size],
				local.icon && "is-icon",
				local.disabled && "is-disabled",
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
