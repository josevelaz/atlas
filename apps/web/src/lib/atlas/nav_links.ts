// Atlas — sidebar navigation link resolver.
//
// Client hydration is healthy (the `<HydrationScript />` + `hydrate()` entry are
// in place), so sidebar `<Link>`s perform client-side SPA navigation. Every
// shipped destination (Screener / Inbox / Feed / Paper Trail + Tasks & Dates +
// Settings) carries the current `?d=` screener-decision token-string so items
// stay reflected across screens (including the Tasks & Dates counts), and that
// state also survives the in-app navigation. This resolver is shared by every
// Atlas route so the linking behavior is identical (and stays DRY) regardless of
// which screen is active.

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
	tasks: "/tasks",
	settings: "/settings",
};

/**
 * Build a `linkFor(id)` resolver for the sidebar that routes every shipped
 * destination, carrying the current `?d=` decisions so accepted screener items
 * stay reflected across screens (including the Tasks & Dates counts). Any nav id
 * without a mapping in `ROUTES` returns `undefined` so it stays inert until its
 * own route ships.
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

/**
 * Resolve the route a citation's mail id opens. Inbox / Feed / Paper Trail
 * citations deep-link to their category list with the row pre-selected via
 * `?sel=`; Screener citations open the Screener. Returns `undefined` when the
 * id has no shipped destination so the citation stays inert.
 *
 * The current `?d=` screener decisions are carried through so the destination
 * stays consistent with the rest of the session.
 */
export function atlasCiteLinkFor(
	id: string,
	d: string | undefined,
): NavLinkTarget | undefined {
	const view = viewForMailId(id);
	if (!view) return undefined;
	const to = ROUTES[view];
	if (!to) return undefined;
	// Category lists support row pre-selection; the Screener has no per-row
	// selection, so it just routes (still carrying any decisions).
	const search: Record<string, unknown> = {};
	if (d) search.d = d;
	if (view === "inbox" || view === "feed" || view === "paper") {
		search.sel = id;
	}
	return { to, search: Object.keys(search).length ? search : undefined };
}
