/**
 * Identity API fetchers.
 *
 * All requests target the API server via `apiUrl()` and send session
 * cookies with `credentials: "include"` (the API may live on another
 * origin; CORS on the server echoes credentials for allowed origins).
 *
 * Error policy:
 *   - `fetchMe()` resolves to `null` on 401 — signed-out is a state,
 *     not an error. Every other non-2xx throws.
 *   - The other fetchers throw on any non-2xx response.
 *
 * This module is independent of `lib/atlas/**` by design.
 */

import { apiFetch } from "../api";
import type { ConnectedAccountsResponse, UserProfile } from "./types";

/** Build an Error from a failed response, including any server message. */
async function responseError(
	response: Response,
	context: string,
): Promise<Error> {
	let detail = "";
	try {
		const body = (await response.json()) as { error?: unknown };
		if (typeof body.error === "string") {
			detail = `: ${body.error}`;
		}
	} catch {
		// Non-JSON body — status alone is enough.
	}
	return new Error(`${context} failed (${response.status})${detail}`);
}

/**
 * Fetch the signed-in user's profile.
 *
 * Resolves to `null` on 401 (signed out); throws on other non-2xx.
 */
export async function fetchMe(): Promise<UserProfile | null> {
	const response = await apiFetch("/me");

	if (response.status === 401) {
		return null;
	}
	if (!response.ok) {
		throw await responseError(response, "GET /me");
	}

	const body = (await response.json()) as { user: UserProfile };
	return body.user;
}

/**
 * Fetch the user's connected OAuth accounts plus the effective primary id.
 *
 * Throws on any non-2xx response (including 401 — callers should gate on
 * a signed-in session, e.g. via `fetchMe()`).
 */
export async function fetchConnectedAccounts(): Promise<ConnectedAccountsResponse> {
	const response = await apiFetch("/me/connected-accounts");

	if (!response.ok) {
		throw await responseError(response, "GET /me/connected-accounts");
	}

	return (await response.json()) as ConnectedAccountsResponse;
}

/**
 * Mark `accountId` as the user's primary connected account.
 *
 * Resolves on success (server responds 204); throws on any non-2xx
 * (404 — unknown/foreign account, 403 — credential row, 401 — signed out).
 */
export async function putPrimaryConnectedAccount(
	accountId: string,
): Promise<void> {
	const response = await apiFetch("/me/primary-connected-account", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ accountId }),
	});

	if (!response.ok) {
		throw await responseError(response, "PUT /me/primary-connected-account");
	}
}

/**
 * Disconnect a connected account (task 11 endpoint
 * `POST /me/connected-accounts/:id/disconnect`).
 *
 * The server stops the mailbox watch (best-effort) and marks the account
 * "disconnected" — its already-synced threads are retained but read-only.
 * Resolves on success (server responds 204); throws on any non-2xx
 * (404 — unknown/foreign account, 403 — credential row, 401 — signed out).
 */
export async function postDisconnectConnectedAccount(
	accountId: string,
): Promise<void> {
	const response = await fetch(
		apiUrl(
			`/me/connected-accounts/${encodeURIComponent(accountId)}/disconnect`,
		),
		{
			method: "POST",
			credentials: "include",
		},
	);

	if (!response.ok) {
		throw await responseError(
			response,
			"POST /me/connected-accounts/:id/disconnect",
		);
	}
}
