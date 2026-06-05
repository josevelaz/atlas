// Atlas — SSR-proof sidebar navigation link resolver.
//
// Client hydration is disabled by a pre-existing TanStack Start/Solid error, so
// sidebar navigation is driven by real server-rendered `<a href>` links. Every
// shipped destination (Screener / Inbox / Feed / Paper Trail + Tasks & Dates)
// carries the current `?d=` screener-decision token-string so accepted items
// stay reflected across screens (including the Tasks & Dates counts). This
// resolver is shared by every Atlas route so the linking behavior is identical
// (and stays DRY) regardless of which screen is active.

import type { Screen } from "./types";

/** A route mapping for a navigable nav id (Link target + search). */
export interface NavLinkTarget {
	to: string;
	search?: Record<string, unknown>;
}

/**
 * Path for each routed destination. Mail screens (Screener / Inbox / Feed /
 * Paper Trail) plus the routed Assist screens that have shipped (Tasks &
 * Dates). Settings stays out until its own task ships, so it remains inert.
 */
const ROUTES: Partial<Record<Screen, string>> = {
	screener: "/atlas/screener",
	inbox: "/atlas/inbox",
	feed: "/atlas/feed",
	paper: "/atlas/paper-trail",
	tasks: "/atlas/tasks",
};

/**
 * Build a `linkFor(id)` resolver for the sidebar that routes every shipped
 * destination, carrying the current `?d=` decisions so accepted screener items
 * stay reflected across screens (including the Tasks & Dates counts). Non-routed
 * entries (Settings) return `undefined` so they stay inert until their own task
 * ships.
 */
export function atlasMailLinkFor(
	d: string | undefined,
): (id: Screen) => NavLinkTarget | undefined {
	const passD = d ? { d } : undefined;
	return (id: Screen) => {
		const to = ROUTES[id];
		if (!to) return undefined;
		return { to, search: passD };
	};
}
