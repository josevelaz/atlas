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

const BETTER_AUTH_BASE_PATH = "/api/auth";

function normaliseAuthOrigin(rawBaseUrl: string): string | undefined {
	if (!rawBaseUrl) return undefined;
	const trimmed = rawBaseUrl.replace(/\/$/, "");
	return trimmed.endsWith(BETTER_AUTH_BASE_PATH)
		? trimmed.slice(0, -BETTER_AUTH_BASE_PATH.length)
		: trimmed;
}

// Lazily initialised — only created in the browser to avoid SSR crashes.
// `createAuthClient` accesses `Request.prototype` and other browser globals
// at module init time, which throws during server-side rendering.
let _client: ReturnType<typeof createAuthClient> | null = null;

export function getAuthClient(): ReturnType<typeof createAuthClient> {
	if (!_client) {
		_client = createAuthClient({
			/**
			 * Better Auth should target the API origin, while `basePath`
			 * pins the mounted auth route explicitly. We also normalize an
			 * accidentally-suffixed `/api/auth` from `VITE_API_BASE_URL` so
			 * local env mistakes do not produce `/api/auth/api/auth/*` or
			 * route misses like `/social`.
			 */
			baseURL: normaliseAuthOrigin(API_BASE_URL),
			basePath: BETTER_AUTH_BASE_PATH,
		});
	}
	return _client;
}
