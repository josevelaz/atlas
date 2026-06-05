// Atlas — sidebar navigation.
//
// "Mail" group (Screener / Inbox / Feed / Paper Trail) + "Assist" group
// (Tasks & Dates / Settings), the AI usage card, and a "Replay onboarding"
// link. Mirrors the prototype's `.sidebar`.
//
// For the inbox vertical slice only the Inbox destination is wired to a real
// route; the other entries stay visually present (for inbox parity) but are
// inert — we don't route users to incomplete placeholder screens.

import type { Component } from "solid-js";
import { For, Show } from "solid-js";
import { ASSIST_NAV_ITEMS, mailNavItems } from "../../lib/atlas/app_state";
import type { NavItem, Screen, ScreenerDecisions } from "../../lib/atlas/types";
import { cn } from "../../lib/utils";
import { AiUsageCard } from "./ai_usage_card";
import { AtlasIcon } from "./atlas_icon";

/** Tile background for a nav item, matching the prototype's coded tiles. */
function tileBackground(item: NavItem, active: boolean): string {
	if (active) return "var(--color-background)";
	return item.color ?? "var(--color-secondary-background)";
}

/** Tile glyph color (white for the AI-keyed tasks tile, else ink). */
function tileColor(item: NavItem, active: boolean): string {
	if (active) return "#000";
	return item.id === "tasks" ? "#fff" : "#000";
}

interface NavRowProps {
	item: NavItem;
	active: boolean;
	enabled: boolean;
	onSelect: (id: Screen) => void;
}

function NavRow(props: NavRowProps) {
	return (
		<button
			type="button"
			class={cn("atlas-nav-item", props.active && "is-active")}
			aria-current={props.active ? "page" : undefined}
			aria-disabled={props.enabled ? undefined : "true"}
			onClick={() => {
				if (props.enabled) props.onSelect(props.item.id);
			}}
		>
			<span
				class="atlas-nav-tile"
				style={{
					background: tileBackground(props.item, props.active),
					color: "#000",
				}}
			>
				<AtlasIcon
					name={props.item.icon}
					size={15}
					stroke={2.5}
					color={tileColor(props.item, props.active)}
				/>
			</span>
			<span>{props.item.label}</span>
			<Show when={props.item.count !== null && props.item.count > 0}>
				<span class="atlas-count">{props.item.count}</span>
			</Show>
		</button>
	);
}

export interface SidebarNavProps {
	activeView: Screen;
	decisions: ScreenerDecisions;
	/** Invoked when a navigable destination is chosen. */
	onSelect: (id: Screen) => void;
	/** Replay the onboarding walkthrough. */
	onReplayOnboarding?: () => void;
}

const SidebarNav: Component<SidebarNavProps> = (props) => {
	// Only Inbox routes in this slice; others remain visible but inert.
	const isEnabled = (id: Screen) => id === "inbox";

	return (
		<div class="atlas-sidebar">
			<div class="atlas-section-title">Mail</div>
			<For each={mailNavItems(props.decisions)}>
				{(item) => (
					<NavRow
						item={item}
						active={props.activeView === item.id}
						enabled={isEnabled(item.id)}
						onSelect={props.onSelect}
					/>
				)}
			</For>

			<div class="atlas-section-title">Assist</div>
			<For each={ASSIST_NAV_ITEMS}>
				{(item) => (
					<NavRow
						item={item}
						active={props.activeView === item.id}
						enabled={isEnabled(item.id)}
						onSelect={props.onSelect}
					/>
				)}
			</For>

			<div class="atlas-spacer" />

			<AiUsageCard />

			<button
				type="button"
				class="atlas-nav-item"
				style={{ "margin-top": "4px" }}
				onClick={() => props.onReplayOnboarding?.()}
			>
				<span
					class="atlas-nav-tile"
					style={{ border: "none", background: "transparent" }}
				>
					<AtlasIcon name="user" size={15} />
				</span>
				<span style={{ "font-size": "13px", "font-weight": 400 }}>
					Replay onboarding
				</span>
			</button>
		</div>
	);
};

export { SidebarNav };
