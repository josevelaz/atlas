// Atlas — sidebar navigation.
//
// "Mail" group (Screener / Inbox / Feed / Paper Trail) + "Assist" group
// (Tasks & Dates / Settings), the AI usage card, and a "Replay onboarding"
// link. Mirrors the prototype's `.sidebar`.
//
// Routed destinations (Screener, Inbox) render as `<Link>`s so navigation works
// server-side under the pre-existing broken-hydration constraint; each link
// carries the current `?d=` screener-decision token-string so accepted items
// stay reflected across Screener ↔ Inbox. Other entries stay visually present
// (for parity) but inert — we don't route users to incomplete screens.

import { Link } from "@tanstack/solid-router";
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

interface NavTileProps {
	item: NavItem;
	active: boolean;
}

/** Shared inner content (tile + label + count) for button and link rows. */
function NavRowInner(props: NavTileProps) {
	return (
		<>
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
		</>
	);
}

/** A route mapping for a navigable nav id (Link target + search). */
interface NavLinkTarget {
	to: string;
	search?: Record<string, unknown>;
}

interface NavRowProps {
	item: NavItem;
	active: boolean;
	/** When present, the row renders as a `<Link>`; otherwise an inert button. */
	link?: NavLinkTarget;
}

function NavRow(props: NavRowProps) {
	return (
		<Show
			when={props.link}
			fallback={
				<button
					type="button"
					class={cn("atlas-nav-item", props.active && "is-active")}
					aria-current={props.active ? "page" : undefined}
					aria-disabled="true"
				>
					<NavRowInner item={props.item} active={props.active} />
				</button>
			}
		>
			{(link) => (
				<Link
					to={link().to}
					search={link().search}
					class={cn("atlas-nav-item", props.active && "is-active")}
					aria-current={props.active ? "page" : undefined}
					data-nav={props.item.id}
				>
					<NavRowInner item={props.item} active={props.active} />
				</Link>
			)}
		</Show>
	);
}

export interface SidebarNavProps {
	activeView: Screen;
	decisions: ScreenerDecisions;
	/**
	 * Resolve a routed `<Link>` target for a nav id. Return `undefined` to keep
	 * the entry inert. Lets routes wire SSR-proof navigation (carrying the
	 * current `?d=` decisions) without coupling the sidebar to any one route.
	 */
	linkFor?: (id: Screen) => NavLinkTarget | undefined;
}

const SidebarNav: Component<SidebarNavProps> = (props) => {
	const linkFor = (id: Screen): NavLinkTarget | undefined =>
		props.linkFor?.(id);

	return (
		<div class="atlas-sidebar">
			<div class="atlas-section-title">Mail</div>
			<For each={mailNavItems(props.decisions)}>
				{(item) => (
					<NavRow
						item={item}
						active={props.activeView === item.id}
						link={linkFor(item.id)}
					/>
				)}
			</For>

			<div class="atlas-section-title">Assist</div>
			<For each={ASSIST_NAV_ITEMS}>
				{(item) => (
					<NavRow
						item={item}
						active={props.activeView === item.id}
						link={linkFor(item.id)}
					/>
				)}
			</For>

			<div class="atlas-spacer" />

			<AiUsageCard />

			<Link
				to="/atlas/onboarding"
				search={{ step: 0 }}
				class="atlas-nav-item"
				style={{ "margin-top": "4px" }}
				data-action="replay-onboarding"
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
			</Link>
		</div>
	);
};

export { SidebarNav };
