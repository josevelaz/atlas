// Atlas — SSR-proof sidebar navigation link resolver.
//
// Client hydration is disabled by a pre-existing TanStack Start/Solid error, so
// sidebar navigation is driven by real server-rendered `<a href>` links. Every
// mail destination (Screener / Inbox / Feed / Paper Trail) carries the current
// `?d=` screener-decision token-string so accepted items stay reflected across
// all four screens. This resolver is shared by every mail route so the linking
// behavior is identical (and stays DRY) regardless of which screen is active.

import type { Screen } from "./types";

/** A route mapping for a navigable nav id (Link target + search). */
export interface NavLinkTarget {
	to: string;
	search?: Record<string, unknown>;
}

/** Path for each routed mail destination. */
const MAIL_ROUTES: Partial<Record<Screen, string>> = {
	screener: "/atlas/screener",
	inbox: "/atlas/inbox",
	feed: "/atlas/feed",
	paper: "/atlas/paper-trail",
};

/**
 * Build a `linkFor(id)` resolver for the mail sidebar that routes every mail
 * destination, carrying the current `?d=` decisions. Non-mail entries (Tasks,
 * Settings) return `undefined` so they stay inert until their own tasks ship.
 */
export function atlasMailLinkFor(
	d: string | undefined,
): (id: Screen) => NavLinkTarget | undefined {
	const passD = d ? { d } : undefined;
	return (id: Screen) => {
		const to = MAIL_ROUTES[id];
		if (!to) return undefined;
		return { to, search: passD };
	};
}
