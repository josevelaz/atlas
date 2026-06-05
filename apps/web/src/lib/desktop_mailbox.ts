import { apiUrl } from "./api";
import { awaitDeepLinkCallback } from "./desktop_deeplink";

/**
 * Initiates the desktop mailbox-connect OAuth flow for Gmail.
 *
 * Flow:
 *   1. POST /api/accounts/google/connect/start with channel="desktop" to get
 *      the Gmail authorization URL and a state token.
 *   2. Register the deep-link listener for "atlas://mailbox-connect-callback"
 *      BEFORE opening the browser to eliminate the race condition where a fast
 *      callback arrives before listen() is registered.
 *   3. Open the authorization URL in the system browser via the Tauri opener plugin.
 *   4. Wait for the deep-link callback event. The Tauri bridge forwards only
 *      the `state` parameter — the OAuth code stays server-side.
 *   5. POST /api/accounts/google/connect/desktop/complete with { state } to
 *      complete the exchange server-side.
 *   6. On success: call onSuccess({ accountId, email }) so the caller can
 *      refresh account state.
 *   7. On failure: call onError(errorMessage) so the caller can show a clear
 *      failure path.
 *
 * The deep-link orchestration (listener + timeout + browser-open + cleanup) is
 * delegated to awaitDeepLinkCallback in desktop_deeplink.ts, which handles the
 * Tauri dynamic imports (externalized in vite.config.ts) and the race-free
 * listen-before-open sequencing. The isDesktop() guard in the caller ensures
 * this is never called in web builds.
 *
 * Security:
 * - The OAuth code is never forwarded to the webview — it stays server-side.
 * - The Tauri bridge emits only { state, error } from the deep-link URL.
 * - State is validated server-side on /complete.
 */
export async function startDesktopMailboxConnect(opts: {
	returnIntent?: string;
	onSuccess: (result: { accountId: string; email: string }) => void;
	onError: (message: string) => void;
}): Promise<void> {
	const { returnIntent = "/", onSuccess, onError } = opts;

	try {
		// Step 1: Request the Gmail authorization URL from the server
		const startRes = await fetch(apiUrl("/api/accounts/google/connect/start"), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ returnIntent, channel: "desktop" }),
		});

		if (!startRes.ok) {
			const body = (await startRes.json().catch(() => ({}))) as {
				error?: string;
			};
			throw new Error(body.error ?? `Connect start failed: ${startRes.status}`);
		}

		const { authUrl, state } = (await startRes.json()) as {
			authUrl: string;
			state: string;
		};

		if (!authUrl || !state) {
			throw new Error("Invalid connect start response from server");
		}

		// Steps 2–4: Open the browser and wait for the deep-link callback. The
		// Tauri bridge forwards only { state, error } — the OAuth code stays
		// server-side. The callback handler validates state and completes the
		// exchange server-side.
		await awaitDeepLinkCallback<{ state?: string; error?: string }, void>({
			eventName: "atlas://mailbox-connect-callback",
			authUrl,
			onCallback: async (payload) => {
				const { state: callbackState, error: callbackError } = payload;

				if (callbackError) {
					throw new Error(`Mailbox connect denied: ${callbackError}`);
				}

				if (!callbackState || callbackState !== state) {
					throw new Error(
						"Mailbox connect state mismatch — possible replay attack",
					);
				}

				// Step 5: Complete the exchange server-side
				const completeRes = await fetch(
					apiUrl("/api/accounts/google/connect/desktop/complete"),
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						credentials: "include",
						body: JSON.stringify({ state: callbackState }),
					},
				);

				if (!completeRes.ok) {
					const body = (await completeRes.json().catch(() => ({}))) as {
						error?: string;
					};
					throw new Error(
						body.error ?? `Connect complete failed: ${completeRes.status}`,
					);
				}

				const result = (await completeRes.json()) as {
					ok: boolean;
					accountId: string;
					email: string;
				};

				if (!result.ok) {
					throw new Error("Mailbox connect complete returned not-ok");
				}

				// Step 6: Notify caller of success
				onSuccess({ accountId: result.accountId, email: result.email });
			},
		});
	} catch (err) {
		// Step 7: Notify caller of failure
		const message =
			err instanceof Error ? err.message : "Mailbox connect failed";
		onError(message);
	}
}
