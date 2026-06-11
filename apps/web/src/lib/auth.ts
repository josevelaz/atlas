/**
 * Better Auth client for the web app.
 *
 * Uses `better-auth/solid` for Solid-native reactive session hooks.
 * Configured to talk to the API server at VITE_API_BASE_URL (falls back to
 * the same origin when the variable is unset, which works when the API is
 * proxied through the dev server).
 *
 * The client is created lazily (only in the browser) to avoid SSR issues —
 * `createAuthClient` accesses browser globals at init time.
 *
 * Import `getAuthClient` wherever you need to trigger auth flows:
 *
 *   import { getAuthClient } from "~/lib/auth";
 *   getAuthClient().signIn.social({ provider: "google", callbackURL: "/inbox" });
 */
import { createAuthClient } from "better-auth/solid";

import { API_BASE_URL } from "./api";

// Lazily initialised — only created in the browser to avoid SSR crashes.
// `createAuthClient` accesses `Request.prototype` and other browser globals
// at module init time, which throws during server-side rendering.
let _client: ReturnType<typeof createAuthClient> | null = null;

export function getAuthClient(): ReturnType<typeof createAuthClient> {
	if (!_client) {
		_client = createAuthClient({
			/**
			 * The base URL of the Better Auth server.
			 * Must match `basePath` on the server (default: /api/auth).
			 * Falls back to the current origin when API_BASE_URL is empty
			 * (same-origin proxy setup in local dev).
			 */
			baseURL: API_BASE_URL || undefined,
		});
	}
	return _client;
}
