/**
 * desktop_deeplink.ts — canonical Tauri deep-link OAuth-callback orchestration.
 *
 * The desktop OAuth flows (auth sign-in and mailbox connect) share the same
 * "open the system browser, then wait for a one-shot deep-link callback event"
 * dance:
 *
 *   1. Register a Tauri event listener for the callback BEFORE opening the
 *      browser — this eliminates the race where a fast callback arrives before
 *      listen() is registered.
 *   2. Arm a timeout that rejects if no callback arrives.
 *   3. Open the authorization URL in the system browser via the Tauri opener
 *      plugin once the listener is ready.
 *   4. On the first callback event: clear the timeout, unlisten, and resolve
 *      with the event payload (caller does the exchange/validation).
 *   5. On timeout or browser-open failure: unlisten and reject.
 *
 * Both `@tauri-apps/api/event` and `@tauri-apps/plugin-opener` are externalized
 * in vite.config.ts (and excluded from optimizeDeps), so a plain dynamic import
 * by static specifier is the canonical, tree-shake-safe strategy — the web
 * build never bundles them and the isDesktop() guard in callers ensures this is
 * never reached in the browser.
 */

/** Default time to wait for a deep-link callback before giving up. */
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Opens `authUrl` in the system browser and resolves with the payload of the
 * first `eventName` deep-link callback event. Rejects on timeout, on a
 * browser-open failure, or if the caller's `onCallback` handler throws.
 *
 * @param eventName  The Tauri event the lib.rs bridge emits for this flow's
 *                   deep-link (e.g. "atlas://auth-callback").
 * @param authUrl    The provider authorization URL to open in the browser.
 * @param onCallback Validates/processes the callback payload. Whatever it
 *                   returns becomes the resolved value; if it throws, the
 *                   orchestration rejects with that error.
 * @param timeoutMs  Optional override for the no-callback timeout.
 */
export async function awaitDeepLinkCallback<TPayload, TResult>(opts: {
	eventName: string;
	authUrl: string;
	onCallback: (payload: TPayload) => TResult | Promise<TResult>;
	timeoutMs?: number;
}): Promise<TResult> {
	const {
		eventName,
		authUrl,
		onCallback,
		timeoutMs = DEFAULT_TIMEOUT_MS,
	} = opts;

	const { listen } = await import("@tauri-apps/api/event");

	return new Promise<TResult>((resolve, reject) => {
		let unlisten: (() => void) | null = null;

		const timeout = setTimeout(() => {
			unlisten?.();
			reject(new Error(`Desktop deep-link timeout — no ${eventName} callback`));
		}, timeoutMs);

		// Register the listener first, then open the browser once it's ready.
		listen<TPayload>(eventName, async (event) => {
			clearTimeout(timeout);
			unlisten?.();
			try {
				resolve(await onCallback(event.payload));
			} catch (err) {
				reject(err);
			}
		})
			.then((fn) => {
				unlisten = fn;
				// Open the authorization URL only after the listener is armed.
				return import("@tauri-apps/plugin-opener").then(({ open }) =>
					open(authUrl),
				);
			})
			.catch((err) => {
				clearTimeout(timeout);
				unlisten?.();
				reject(err);
			});
	});
}
