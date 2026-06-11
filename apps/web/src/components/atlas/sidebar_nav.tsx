// Atlas — sidebar navigation.
//
// "Mail" group (Screener / Inbox / Feed / Paper Trail) + "Assist" group
// (Tasks & Dates / Settings), the AI usage card, and a "Replay onboarding"
// link. Mirrors the prototype's `.sidebar`.
//
// Routed destinations (Screener, Inbox, Feed, Paper Trail, …) render as
// `<Link>`s and navigate client-side via the router. Screener decisions live in
// the shared Atlas store, so accepted items stay reflected across Screener ↔
// Inbox through provider state (the nav counts read from the store) — no `?d=`
// token. Other entries stay visually present (for parity) but inert — we don't
// route users to incomplete screens.

import { Link } from "@tanstack/solid-router";
import type { Component } from "solid-js";
import { For, Show } from "solid-js";

import { ASSIST_NAV_ITEMS, mailNavItems } from "../../lib/atlas/app_state";
import { useAtlasState } from "../../lib/atlas/atlas_state";
import type { NavItem, Screen } from "../../lib/atlas/types";
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
	/**
	 * Resolve a routed `<Link>` target for a nav id. Return `undefined` to keep
	 * the entry inert. Lets routes wire navigation without coupling the sidebar
	 * to any one route.
	 */
	linkFor?: (id: Screen) => NavLinkTarget | undefined;
}

const SidebarNav: Component<SidebarNavProps> = (props) => {
	const decisions = useAtlasState((s) => s.screener);
	const linkFor = (id: Screen): NavLinkTarget | undefined =>
		props.linkFor?.(id);

	return (
		<div class="atlas-sidebar">
			<div class="atlas-section-title">Mail</div>
			<For each={mailNavItems(decisions())}>
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
				to="/onboarding"
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
