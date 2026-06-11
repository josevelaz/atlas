// Atlas — a single Settings row.
//
// Mirrors the prototype's `.settings-row` (`docs/prototype/screens.jsx`):
// a three-column grid — a 48px coded icon tile, a title + sub-label stack, and
// a trailing control slot (a `<Toggle>`, a `<Button>`, a `<Badge>` + button
// pair, etc.). Layout-only; the icon tile accent and trailing control are
// supplied by the caller so every row stays consistent without one-off styling.

import type { Component, JSX } from "solid-js";
import { Show } from "solid-js";
import {
	settingsControlClasses,
	settingsIconClasses,
	settingsRowClasses,
	settingsRowSubClasses,
	settingsRowTitleClasses,
	settingsTextClasses,
} from "../../lib/atlas/component_classes";
import { AtlasIcon, type IconName } from "./atlas_icon";

export interface SettingsRowProps {
	/** Icon glyph rendered in the leading tile. */
	icon: IconName;
	/** Tile background (a coded accent var, or undefined for the default fill). */
	tileBackground?: string;
	/** Icon stroke color (white for accent-filled tiles, ink otherwise). */
	iconColor?: string;
	/** Icon stroke weight (matches the prototype's per-row stroke). */
	iconStroke?: number;
	/** Icon size in px (the prototype uses 24 for account rows, 20 elsewhere). */
	iconSize?: number;
	/** Primary row title. */
	title: string;
	/** Secondary descriptive line under the title. */
	sub?: JSX.Element;
	/** Whether the sub line uses the mono/data face (account meta rows). */
	subMono?: boolean;
	/** Trailing control(s): a toggle, button(s), badge + button, etc. */
	control: JSX.Element;
}

const SettingsRow: Component<SettingsRowProps> = (props) => {
	return (
		<div class={settingsRowClasses}>
			<span
				class={settingsIconClasses}
				style={
					props.tileBackground
						? { background: props.tileBackground }
						: undefined
				}
			>
				<AtlasIcon
					name={props.icon}
					size={props.iconSize ?? 20}
					stroke={props.iconStroke}
					color={props.iconColor ?? "#000"}
				/>
			</span>
			<div class={settingsTextClasses}>
				<div class={settingsRowTitleClasses}>{props.title}</div>
				<Show when={props.sub}>
					<div class={settingsRowSubClasses({ mono: props.subMono ?? false })}>
						{props.sub}
					</div>
				</Show>
			</div>
			<div class={settingsControlClasses}>{props.control}</div>
		</div>
	);
};

export { SettingsRow };
