import type { Component } from "solid-js";
import { mergeProps } from "solid-js";
import { avatarClasses } from "../../lib/atlas/component_classes";
import { cn } from "../../lib/utils";

const palette = [
	"var(--color-main)",
	"var(--color-feed)",
	"var(--color-paper)",
	"var(--color-ai)",
	"var(--color-inbox)",
	"var(--color-danger)",
] as const;

function hash_name(name: string): number {
	let sum = 0;
	for (let i = 0; i < name.length; i++) {
		sum += name.charCodeAt(i);
	}
	return sum % palette.length;
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
			// The app-shell retro pass (sticker tilt) is baked into `avatarClasses`
			// via a `[.atlas-app_&]:` ancestor variant.
			class={cn(avatarClasses({ size: props.size }), props.class)}
			style={{ "background-color": bg_color() }}
			role="img"
			aria-label={props.name}
		>
			{initials()}
		</div>
	);
};

export { Avatar };
