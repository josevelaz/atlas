/**
 * Identity query layer — solid-query options, hooks, and mutations.
 *
 * Consumes the fetchers in `./api` and the shared `queryClient` mounted by
 * `routes/__root.tsx` (via `QueryClientProvider`). Keys live under the
 * `['identity', …]` namespace so the whole slice can be invalidated at once
 * (see `invalidateIdentity`).
 *
 * SSR / prerender safety: every query is gated with `enabled: !isServer`, so
 * prerendering the SPA shell never executes a fetch — queries resolve only in
 * the browser. Browser-only auth concerns stay lazy: `getAuthClient()` is
 * called inside a `mutationFn`, which can only run client-side.
 *
 * This module is independent of `lib/atlas/**` by design.
 */

import {
	type QueryClient,
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/solid-query";
import { type Accessor, createMemo } from "solid-js";
import { isServer } from "solid-js/web";

import { getAuthClient } from "../auth";
import {
	fetchConnectedAccounts,
	fetchMe,
	putPrimaryConnectedAccount,
} from "./api";
import type { ConnectedAccount } from "./types";

/** Query-key namespace for the identity slice. */
export const identityKeys = {
	all: ["identity"] as const,
	me: ["identity", "me"] as const,
	connectedAccounts: ["identity", "connected-accounts"] as const,
};

/**
 * The user's overall identity state:
 * - `loading`        — session not resolved yet (or accounts still loading).
 * - `signedOut`      — no session (`GET /me` → 401 → `null`).
 * - `needsConnection`— signed in but zero connected OAuth accounts.
 * - `onboarded`      — signed in with at least one connected account.
 */
export type IdentityStatus =
	| "loading"
	| "signedOut"
	| "needsConnection"
	| "onboarded";

/**
 * Options for `GET /me`.
 *
 * `retry: false` — a 401 already resolves to `null` (signed out is a state,
 * not an error), so any thrown error is a real failure worth surfacing fast.
 */
export function meQueryOptions() {
	return queryOptions({
		queryKey: identityKeys.me,
		queryFn: fetchMe,
		retry: false,
		staleTime: 30_000,
	});
}

/**
 * Options for `GET /me/connected-accounts`.
 *
 * Callers must gate this on a signed-in session — the endpoint throws on 401.
 * `useConnectedAccounts()` applies that gate (`enabled` when `me` resolved
 * non-null); prefer the hook unless you are prefetching after a known sign-in.
 */
export function connectedAccountsQueryOptions() {
	return queryOptions({
		queryKey: identityKeys.connectedAccounts,
		queryFn: fetchConnectedAccounts,
		retry: false,
		staleTime: 30_000,
	});
}

/** The signed-in user's profile (`null` when signed out). */
export function useUser() {
	return useQuery(() => ({
		...meQueryOptions(),
		enabled: !isServer,
	}));
}

/**
 * The user's connected OAuth accounts. Enabled only once `me` has resolved
 * to a non-null user, so it never fires while signed out.
 */
export function useConnectedAccounts() {
	const me = useUser();
	return useQuery(() => ({
		...connectedAccountsQueryOptions(),
		enabled: !isServer && me.data != null,
	}));
}

/**
 * The row matching `primaryConnectedAccountId`, or `null` when unresolved —
 * still loading, signed out, or no connected accounts (the server sends an
 * empty string for credential-only users).
 */
export function usePrimaryConnectedAccount(): Accessor<ConnectedAccount | null> {
	const accounts = useConnectedAccounts();
	return createMemo(() => {
		const data = accounts.data;
		if (!data?.primaryConnectedAccountId) return null;
		return (
			data.accounts.find(
				(account) => account.id === data.primaryConnectedAccountId,
			) ?? null
		);
	});
}

/**
 * Combined identity status. `onboarded` = user non-null AND at least one
 * connected account. A failed connected-accounts fetch while signed in is
 * treated as `needsConnection` (a connection cannot be confirmed).
 */
export function useIdentityStatus(): Accessor<IdentityStatus> {
	const me = useUser();
	const accounts = useConnectedAccounts();
	return createMemo<IdentityStatus>(() => {
		if (me.isPending) return "loading";
		if (me.isError || me.data == null) return "signedOut";
		if (accounts.isPending) return "loading";
		if (accounts.data && accounts.data.accounts.length >= 1) return "onboarded";
		return "needsConnection";
	});
}

/**
 * Update the user's display name through Better Auth, then refetch `me`.
 * `getAuthClient()` is resolved inside the mutation, keeping the auth client
 * lazy (browser-only).
 */
export function useUpdateDisplayName() {
	const client = useQueryClient();
	return useMutation(() => ({
		mutationFn: async (name: string) => {
			const { error } = await getAuthClient().updateUser({ name });
			if (error) {
				throw new Error(error.message ?? "Failed to update display name");
			}
		},
		onSuccess: () => client.invalidateQueries({ queryKey: identityKeys.me }),
	}));
}

/**
 * Mark a connected account as primary, then refetch connected accounts.
 * Server rejections (404 unknown/foreign row, 403 credential row, 401 signed
 * out) surface as mutation errors.
 */
export function useSetPrimary() {
	const client = useQueryClient();
	return useMutation(() => ({
		mutationFn: (accountId: string) => putPrimaryConnectedAccount(accountId),
		onSuccess: () =>
			client.invalidateQueries({ queryKey: identityKeys.connectedAccounts }),
	}));
}

/**
 * Invalidate the whole identity slice — call on logout so `me` refetches
 * (resolving to `null`) and dependent queries settle into the signed-out
 * state.
 */
export function invalidateIdentity(queryClient: QueryClient): Promise<void> {
	return queryClient.invalidateQueries({ queryKey: identityKeys.all });
}
