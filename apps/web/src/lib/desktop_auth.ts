import { authClient } from "./auth";
import { apiUrl } from "./api";
import { awaitDeepLinkCallback } from "./desktop_deeplink";

/**
 * Returns true when the app is running inside the Tauri desktop shell.
 * Uses the presence of `window.__TAURI_INTERNALS__` as the detection signal.
 */
export function isDesktop(): boolean {
	return (
		typeof window !== "undefined" &&
		"__TAURI_INTERNALS__" in (window as unknown as Record<string, unknown>)
	);
}

/**
 * Initiates the desktop OAuth flow for a given provider.
 *
 * Flow:
 *   1. Call authClient.signIn.social({ provider, disableRedirect: true }) to get
 *      the provider authorization URL without navigating the webview.
 *   2. Open the URL in the system browser via the Tauri opener plugin.
 *   3. Listen for the `atlas://auth-callback` Tauri event (emitted by lib.rs
 *      when the deep-link is received).
 *   4. Extract `code` and `state` from the event payload.
 *   5. POST to /api/auth/desktop/exchange with { code, state }.
 *   6. On success: navigate to /auth/complete.
 *   7. On failure: navigate to the originating auth route with ?error=desktop_auth_failed.
 *
 * The deep-link orchestration (listener + timeout + browser-open + cleanup) is
 * delegated to awaitDeepLinkCallback in desktop_deeplink.ts, which handles the
 * Tauri dynamic imports (externalized in vite.config.ts) and the race-free
 * listen-before-open sequencing. Type declarations are in src/tauri.d.ts.
 */
export async function startDesktopAuth(
	provider: string,
	originRoute: string,
	redirect?: string,
): Promise<void> {
	try {
		// Step 1: Get the provider authorization URL without redirecting
		const result = await (
			authClient.signIn.social as (
				opts: Record<string, unknown>,
			) => Promise<unknown>
		)({
			provider,
			disableRedirect: true,
		});

		// The result should contain the redirect URL
		const authUrl = (result as { data?: { url?: string } } | null)?.data?.url;
		if (!authUrl) {
			throw new Error("No authorization URL returned from provider");
		}

		// Steps 2–4: Open the browser and wait for the deep-link callback. The
		// callback handler extracts code/state and exchanges them for a session.
		await awaitDeepLinkCallback<{ url: string }, void>({
			eventName: "atlas://auth-callback",
			authUrl,
			onCallback: async (payload) => {
				// Step 4: Extract code and state from the event payload URL
				const callbackUrl = new URL(payload.url);
				const code = callbackUrl.searchParams.get("code");
				const state = callbackUrl.searchParams.get("state");

				if (!code || !state) {
					throw new Error("Missing code or state in callback URL");
				}

				// Step 5: Exchange the one-time code for a session
				const exchangeRes = await fetch(apiUrl("/api/auth/desktop/exchange"), {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({ code, state }),
				});

				if (!exchangeRes.ok) {
					throw new Error(`Exchange failed: ${exchangeRes.status}`);
				}

				// Step 6: Navigate to /auth/complete on success, preserving redirect
				const dest = redirect
					? `/auth/complete?redirect=${encodeURIComponent(redirect)}`
					: "/auth/complete";
				window.location.href = dest;
			},
		});
	} catch {
		// Step 7: Navigate to originating route with error on failure
		window.location.href = `${originRoute}?error=desktop_auth_failed`;
	}
}
