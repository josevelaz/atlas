/**
 * Auth-aware route guards — async `beforeLoad` helpers for TanStack Router.
 *
 * Both guards are no-ops on the server (`typeof window === "undefined"`):
 * prerendering the SPA shell must never fetch identity or throw a redirect.
 * In the browser they resolve identity through the shared `queryClient` via
 * `ensureQueryData`, so guard checks and `useIdentityStatus()` share one
 * cache (keys under `['identity', …]`, see `./queries`).
 *
 * "Onboarded" = signed in (`GET /me` → non-null) AND at least one connected
 * OAuth account. Any fetch failure is treated as not-onboarded: a connection
 * cannot be confirmed, so gated routes bounce to `/` and `/` stays put.
 *
 * Ungated by design: `/onboarding`, `/logout`, and `/dev/*`.
 */

import type { EnsureQueryDataOptions, QueryKey } from "@tanstack/solid-query";
import { redirect } from "@tanstack/solid-router";

import { queryClient } from "../tanstack/query";
import { connectedAccountsQueryOptions, meQueryOptions } from "./queries";

/**
 * `ensureQueryData`, but refetch when the cache entry was explicitly
 * invalidated (e.g. `invalidateIdentity` on logout) — `ensureQueryData`
 * alone would return the stale signed-in snapshot and the guard would
 * bounce a just-signed-out user straight back into the app.
 */
function ensureCurrentQueryData<TData, TKey extends QueryKey>(
	options: EnsureQueryDataOptions<TData, Error, TData, TKey>,
): Promise<TData> {
	if (queryClient.getQueryState(options.queryKey)?.isInvalidated) {
		return queryClient.fetchQuery(options);
	}
	return queryClient.ensureQueryData(options);
}

/**
 * Resolve whether the user is fully onboarded. Browser-only — callers gate
 * on `window`. Errors (server down, unexpected non-2xx) resolve `false`.
 */
async function resolveOnboarded(): Promise<boolean> {
	try {
		const me = await ensureCurrentQueryData(meQueryOptions());
		if (me == null) return false;
		const accounts = await ensureCurrentQueryData(
			connectedAccountsQueryOptions(),
		);
		return accounts.accounts.length >= 1;
	} catch {
		return false;
	}
}

/**
 * `beforeLoad` for gated app routes (`/inbox`, `/feed`, `/paper-trail`,
 * `/screener`, `/tasks`, `/settings`): redirect to `/` unless onboarded.
 */
export async function requireOnboarded(): Promise<void> {
	if (typeof window === "undefined") return;
	if (!(await resolveOnboarded())) {
		throw redirect({ to: "/" });
	}
}

/**
 * `beforeLoad` for `/`: an onboarded user skips the walkthrough and lands
 * in `/inbox`.
 */
export async function redirectIfOnboarded(): Promise<void> {
	if (typeof window === "undefined") return;
	if (await resolveOnboarded()) {
		throw redirect({ to: "/inbox" });
	}
}
