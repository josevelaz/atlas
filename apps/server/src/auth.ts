import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { config } from "./config.ts";
import { db } from "./db/index.ts";

/**
 * Cookie strategy for cross-origin auth flows.
 *
 * The Tauri desktop app uses a custom protocol origin:
 *   - macOS / Linux: tauri://localhost
 *   - Windows:       https://tauri.localhost
 *
 * These origins are cross-origin relative to the API server, which means
 * the browser's default SameSite=Lax policy will block session cookies on
 * cross-site requests (e.g. fetch() from the Tauri webview to the API).
 *
 * To allow cookies to flow across origins we must set:
 *   SameSite=None; Secure
 *
 * The `Secure` flag is REQUIRED when SameSite=None — browsers reject
 * SameSite=None cookies without it.
 *
 * TRADEOFF — local development (HTTP):
 *   `Secure` cookies are not sent over plain HTTP. In local dev the API
 *   runs on http://localhost:3000, so `Secure` cookies will be silently
 *   dropped by the browser. Options for local dev:
 *     1. Use a local HTTPS proxy (e.g. mkcert + caddy/nginx).
 *     2. Accept that cookie-based auth won't work in the Tauri dev build
 *        and test auth flows against a staging HTTPS environment.
 *     3. Override BETTER_AUTH_URL to an https:// URL in local dev if you
 *        have a local TLS setup.
 *
 * CSRF / session-fixation notes:
 *   - Better Auth performs origin-check CSRF protection by default
 *     (see `advanced.disableCSRFCheck` — we leave it enabled).
 *   - `trustedOrigins` is the allowlist for that check; only origins in
 *     that list can make credentialed requests to the auth endpoints.
 *   - SameSite=None does NOT disable CSRF protection — it only allows the
 *     cookie to be sent cross-origin. The origin check still applies.
 *   - Session fixation is mitigated by Better Auth rotating the session
 *     token on sign-in.
 *
 * HOST-SCOPED cookies:
 *   We do NOT set a `domain` attribute, which means cookies are scoped to
 *   the exact host of the API server (host-only cookies). This prevents
 *   the session cookie from leaking to sibling subdomains.
 *   Cross-subdomain sharing (if ever needed) must be explicitly opted in
 *   via `advanced.crossSubDomainCookies`.
 */
const isProduction = config.NODE_ENV === "production";

// SameSite=None is required for cross-origin Tauri requests.
// Secure=true is required whenever SameSite=None is set.
// In production the API is always HTTPS so Secure cookies work correctly.
// In development (HTTP) Secure cookies are dropped — see tradeoff note above.
const crossOriginCookieAttributes = {
	sameSite: "none" as const,
	secure: true,
};

export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: "sqlite" }),
	basePath: "/api/auth",
	baseURL: config.BETTER_AUTH_URL,
	secret: config.BETTER_AUTH_SECRET,
	trustedOrigins: config.CORS_ALLOWED_ORIGINS,

	advanced: {
		// Force the __Secure- cookie prefix in production.
		// Better Auth auto-detects this from baseURL protocol, but we make it
		// explicit so the intent is clear and auditable.
		useSecureCookies: isProduction,

		// Apply SameSite=None; Secure to all auth cookies so they are sent on
		// cross-origin requests from the Tauri desktop app.
		// httpOnly is already true by default in Better Auth — we keep it here
		// for explicitness and defence-in-depth.
		defaultCookieAttributes: {
			httpOnly: true,
			...crossOriginCookieAttributes,
		},
	},
});
