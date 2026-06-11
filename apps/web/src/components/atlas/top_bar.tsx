// Atlas — application top bar.
//
// Logo + version chip · spacer · "Search or ask" (opens assistant, ⌘K) ·
// "Compose" (opens compose, C) · divider · account avatar. Mirrors the
// prototype's `.topbar`.

import type { Component } from "solid-js";
import {
	dividerVClasses,
	spacerClasses,
	topBarClasses,
	topBarVersionClasses,
} from "../../lib/atlas/component_classes";
import { Button, Kbd } from "../ui/index";
import { AtlasIcon } from "./atlas_icon";
import { Logo } from "./logo";
import { AtlasAvatar } from "./mail_row";

export interface TopBarProps {
	onSearch: () => void;
	onCompose: () => void;
}

const TopBar: Component<TopBarProps> = (props) => {
	return (
		<div class={topBarClasses}>
			<Logo markSize={26} />
			<span class={topBarVersionClasses}>v0.1 · MVP</span>
			<div class={spacerClasses} />
			<Button size="sm" onClick={props.onSearch}>
				<AtlasIcon name="search" size={14} /> Search or ask
				<Kbd style={{ "margin-left": "6px" }}>⌘K</Kbd>
			</Button>
			<Button size="sm" variant="primary" onClick={props.onCompose}>
				<AtlasIcon name="compose" size={14} stroke={2.5} /> Compose
				<Kbd
					style={{
						"margin-left": "6px",
						background: "var(--color-background)",
					}}
				>
					C
				</Kbd>
			</Button>
			<div class={dividerVClasses} />
			<AtlasAvatar name="Rob Barrett" size="sm" />
		</div>
	);
};

export { TopBar };
