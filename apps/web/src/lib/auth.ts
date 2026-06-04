import { createAuthClient } from "better-auth/client";
import { apiUrl } from "./api";

/**
 * Better Auth client for the web app.
 *
 * This is the single source of truth for all Better Auth client calls in apps/web.
 * The baseURL points to the API server's auth endpoint.
 *
 * SSR note: The auth client requires an absolute URL for the baseURL in SSR context.
 * In SPA mode, all auth calls happen client-side, so we use a fallback absolute URL
 * for SSR that will never actually be called (the SSR guard in beforeLoad prevents it).
 *
 * Usage:
 *   import { authClient } from "~/lib/auth"
 *   await authClient.signIn.social({ provider: "google", callbackURL: "/auth/complete" })
 *   const session = await authClient.getSession()
 *   await authClient.signOut()
 */

/**
 * Better Auth's client requires an ABSOLUTE base URL — constructing the client
 * with a relative path (e.g. "/api/auth") throws "Invalid base URL" at import
 * time, which crashes the entire client bundle and silently breaks hydration
 * app-wide (event handlers never attach). To stay resilient we always resolve
 * to an absolute URL:
 *
 *   - SSR: there is no `window`, so use an absolute localhost fallback. The SSR
 *     guard (import.meta.env.SSR check) in beforeLoad means it is never called.
 *   - Client: prefer the configured API base (VITE_API_BASE_URL via apiUrl()).
 *     If that is unset, `apiUrl()` returns a relative path, so we anchor it to
 *     the current origin to guarantee an absolute URL.
 */
function resolveAuthBaseURL(): string {
	if (import.meta.env.SSR) {
		return "http://localhost:3000/api/auth";
	}
	const resolved = apiUrl("/api/auth");
	// apiUrl() returns a relative path when VITE_API_BASE_URL is empty; anchor it
	// to the current origin so better-auth always receives an absolute URL.
	return resolved.startsWith("http")
		? resolved
		: new URL(resolved, window.location.origin).toString();
}

export const authClient = createAuthClient({
	baseURL: resolveAuthBaseURL(),
});
