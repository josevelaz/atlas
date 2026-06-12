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
 * The `Secure` flag is REQUIRED when SameSite=None is set — browsers reject
 * SameSite=None cookies without it.
 *
 * TRADEOFF — local development (HTTP):
 *   `Secure` cookies are not sent over plain HTTP. In local dev the API
 *   runs on http://localhost:3000, so `Secure` cookies will be silently
 *   dropped by the browser.
 *
 *   To make local web dev testing viable we relax to SameSite=Lax (no
 *   Secure flag) when NODE_ENV=development. This is safe because:
 *     - SameSite=Lax is the browser default and is appropriate for
 *       same-site requests (web app and API both on localhost).
 *     - The Tauri desktop dev build still works because Tauri's webview
 *       ignores the SameSite attribute for its custom-protocol origins.
 *     - Production always uses SameSite=None; Secure (HTTPS required).
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

/**
 * Cookie attributes per environment:
 *
 *   production  → SameSite=None; Secure  (required for Tauri cross-origin)
 *   development → SameSite=Lax           (allows plain HTTP localhost testing)
 *
 * SameSite=None without Secure is rejected by all modern browsers, so we
 * must drop the Secure flag in dev to avoid cookies being silently dropped
 * over HTTP.
 */
const defaultCookieAttributes = isProduction
	? { sameSite: "none" as const, secure: true, httpOnly: true }
	: { sameSite: "lax" as const, secure: false, httpOnly: true };

export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: "sqlite" }),
	basePath: "/api/auth",
	baseURL: config.BETTER_AUTH_URL,
	secret: config.BETTER_AUTH_SECRET,
	trustedOrigins: config.CORS_ALLOWED_ORIGINS,

	socialProviders: {
		...(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET
			? {
					google: {
						clientId: config.GOOGLE_CLIENT_ID,
						clientSecret: config.GOOGLE_CLIENT_SECRET,
					},
				}
			: {}),
	},

	databaseHooks: {
		account: {
			create: {
				/**
				 * Gmail connection checkpoint on Google OAuth completion.
				 *
				 * Fires once the OAuth `account` row is committed — for both
				 * first sign-in creation AND the `linkSocial` linking path
				 * (both go through Better Auth's internal `createAccount`).
				 *
				 * The handler persists a `connected_account` row (with the
				 * Gmail profile checkpoint) in one transaction and enqueues
				 * catch-up + watch-setup jobs after commit. On failure the
				 * error propagates to the OAuth callback; the linked auth
				 * account row stays intact (after-hooks run post-commit), so
				 * re-running connect can recover. Re-runs are idempotent via
				 * the connected_account unique constraint.
				 *
				 * Lazily imported so auth.ts never touches Redis/jobify at
				 * module load.
				 */
				after: async (account) => {
					const { handleAccountCreated } = await import(
						"./services/ingestion/connect.ts"
					);
					await handleAccountCreated(account);
				},
			},
		},
	},

	advanced: {
		// Force the __Secure- cookie prefix in production.
		// Better Auth auto-detects this from baseURL protocol, but we make it
		// explicit so the intent is clear and auditable.
		useSecureCookies: isProduction,

		// Apply environment-appropriate cookie attributes.
		// See the comment block above for the full rationale.
		defaultCookieAttributes,
	},
});
