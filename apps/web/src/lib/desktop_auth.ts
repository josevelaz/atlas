import { authClient } from "./auth";
import { apiUrl } from "./api";

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
 * Dynamic imports for Tauri APIs ensure tree-shaking in web builds — the
 * @tauri-apps/* modules are externalized in vite.config.ts so the web build
 * succeeds. Type declarations are in src/tauri.d.ts.
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

		// Step 2: Set up the deep-link listener BEFORE opening the browser to
		// eliminate the race condition where a fast callback arrives before
		// listen() is registered.
		// The module specifier is built at runtime and marked @vite-ignore so
		// Vite's dev-time import-analysis does not try to resolve this
		// desktop-only dependency in the web build (it is externalized for
		// production in vite.config.ts and never reached when isDesktop() is
		// false).
		const tauriEventModule = "@tauri-apps/api/event";
		const { listen } = (await import(
			/* @vite-ignore */ tauriEventModule
		)) as typeof import("@tauri-apps/api/event");

		await new Promise<void>((resolve, reject) => {
			let unlisten: (() => void) | null = null;

			// Set a timeout to reject if no callback arrives within 5 minutes
			const timeout = setTimeout(
				() => {
					unlisten?.();
					reject(new Error("Desktop auth timeout"));
				},
				5 * 60 * 1000,
			);

			// Register the listener first, then open the browser once it's ready
			listen<{ url: string }>("atlas://auth-callback", async (event) => {
				clearTimeout(timeout);
				unlisten?.();

				try {
					// Step 4: Extract code and state from the event payload URL
					const callbackUrl = new URL(event.payload.url);
					const code = callbackUrl.searchParams.get("code");
					const state = callbackUrl.searchParams.get("state");

					if (!code || !state) {
						throw new Error("Missing code or state in callback URL");
					}

					// Step 5: Exchange the one-time code for a session
					const exchangeRes = await fetch(
						apiUrl("/api/auth/desktop/exchange"),
						{
							method: "POST",
							headers: { "Content-Type": "application/json" },
							credentials: "include",
							body: JSON.stringify({ code, state }),
						},
					);

					if (!exchangeRes.ok) {
						throw new Error(`Exchange failed: ${exchangeRes.status}`);
					}

					// Step 6: Navigate to /auth/complete on success, preserving redirect
					const dest = redirect
						? `/auth/complete?redirect=${encodeURIComponent(redirect)}`
						: "/auth/complete";
					window.location.href = dest;
					resolve();
				} catch (err) {
					reject(err);
				}
			}).then((fn) => {
				unlisten = fn;

				// Step 3: Open the URL in the system browser AFTER listener is ready
				// Externalized in vite.config.ts — only exists at runtime in Tauri.
				// Runtime specifier + @vite-ignore keeps dev import-analysis from
				// resolving this desktop-only dependency in the web build.
				const tauriOpenerModule = "@tauri-apps/plugin-opener";
				(
					import(/* @vite-ignore */ tauriOpenerModule) as Promise<
						typeof import("@tauri-apps/plugin-opener")
					>
				)
					.then(({ open }) => open(authUrl))
					.catch(reject);
			});
		});
	} catch {
		// Step 7: Navigate to originating route with error on failure
		window.location.href = `${originRoute}?error=desktop_auth_failed`;
	}
}
