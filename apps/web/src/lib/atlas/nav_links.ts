// Atlas — sidebar navigation link resolver.
//
// Sidebar `<Link>`s perform client-side SPA navigation and screener decisions
// live in the shared Atlas store (`atlas_state.tsx`) rather than in the URL.
// Accepted/rejected state therefore survives navigation through provider state,
// so the links carry no decision token. This resolver is shared by every Atlas
// route so the linking behavior is identical (and stays DRY) regardless of which
// screen is active.

import { viewForMailId } from "./app_state";
import type { Screen } from "./types";

/** A route mapping for a navigable nav id (Link target + search). */
export interface NavLinkTarget {
	to: string;
	search?: Record<string, unknown>;
}

/**
 * Path for each routed destination. Mail screens (Screener / Inbox / Feed /
 * Paper Trail) plus the routed Assist screens that have shipped (Tasks & Dates,
 * Settings). Every shipped Assist screen routes through this shared resolver so
 * the sidebar links stay DRY across routes.
 */
const ROUTES: Partial<Record<Screen, string>> = {
	screener: "/screener",
	inbox: "/inbox",
	feed: "/feed",
	paper: "/paper-trail",
	spam: "/spam",
	tasks: "/tasks",
	settings: "/settings",
};

/**
 * Build a `linkFor(id)` resolver for the sidebar that routes every shipped
 * destination. Screener decisions live in the shared Atlas store, so the links
 * carry no decision token. Any nav id without a mapping in `ROUTES` returns
 * `undefined` so it stays inert until its own route ships.
 */
export function atlasMailLinkFor(): (id: Screen) => NavLinkTarget | undefined {
	return (id: Screen) => {
		const to = ROUTES[id];
		if (!to) return undefined;
		return { to };
	};
}

/**
 * Resolve the route a citation's mail id opens. Inbox / Feed / Paper Trail
 * citations open their category list; Screener citations open the Screener.
 * Returns `undefined` when the id has no shipped destination so the citation
 * stays inert.
 *
 * Row pre-selection no longer rides in the URL — clicking a citation dispatches
 * a `select(view, id)` store action (see `assistant_dialog.tsx`) so the cited
 * thread is focused through shared provider state, and this resolver only owns
 * the navigation target.
 */
export function atlasCiteLinkFor(id: string): NavLinkTarget | undefined {
	const view = viewForMailId(id);
	if (!view) return undefined;
	const to = ROUTES[view];
	if (!to) return undefined;
	return { to };
}
