import { html } from "@elysiajs/html";
import { serverTiming } from "@elysiajs/server-timing";
import { staticPlugin } from "@elysiajs/static";
import { swagger } from "@elysiajs/swagger";
import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { autoload } from "elysia-autoload";

import { auth } from "./auth.ts";
import { config } from "./config.ts";
import { db } from "./db/index.ts";
import { connectedAccount } from "./db/schema/connected_account.ts";
import { authSessionPlugin, requireAuth } from "./plugins/auth_session.ts";

const CORS_METHODS = "GET, POST, PUT, DELETE, OPTIONS";
const CORS_HEADERS = "Content-Type, Authorization";

const allowedOriginsSet = new Set(config.CORS_ALLOWED_ORIGINS);

/**
 * Strict CORS plugin: only echoes back Access-Control-Allow-Origin and
 * Access-Control-Allow-Credentials when the request Origin is in the
 * explicit allowlist. Disallowed origins receive no ACAO header and no
 * credentials header — browsers will block the cross-origin response.
 */
const strictCors = new Elysia({ name: "strict-cors" }).onRequest(
	({ set, request }) => {
		const origin = request.headers.get("Origin");
		set.headers.Vary = "Origin";
		set.headers["Access-Control-Allow-Methods"] = CORS_METHODS;
		set.headers["Access-Control-Allow-Headers"] = CORS_HEADERS;

		if (origin && allowedOriginsSet.has(origin)) {
			set.headers["Access-Control-Allow-Origin"] = origin;
			set.headers["Access-Control-Allow-Credentials"] = "true";
		}

		// Handle preflight
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: set.headers as Record<string, string>,
			});
		}
	},
);

/**
 * Desktop one-time code store.
 *
 * Maps a random code → { userId, state, expiresAt }.
 * Codes are single-use and expire after 60 seconds.
 * Codes are NEVER logged — only the userId and expiry are stored.
 *
 * In-memory store is sufficient for single-instance deployments.
 * For multi-instance deployments, replace with a Redis-backed store.
 */
type PendingCode = {
	userId: string;
	state: string;
	expiresAt: number;
};

const pendingDesktopCodes = new Map<string, PendingCode>();

// Periodically clean up expired codes to prevent memory leaks.
// Runs every 60 seconds; codes older than 60s are already invalid.
setInterval(() => {
	const now = Date.now();
	for (const [code, entry] of pendingDesktopCodes) {
		if (entry.expiresAt <= now) {
			pendingDesktopCodes.delete(code);
		}
	}
}, 60_000);

export const app = new Elysia()
	.use(swagger())
	.use(strictCors)
	.use(html())
	.use(serverTiming())
	.use(staticPlugin())
	.get("/health", () => ({ status: "ok" }))
	.all("/api/auth/*", ({ request }) => auth.handler(request))
	// Derive authSession / authUser for every downstream route
	.use(authSessionPlugin)
	.use(autoload({ failGlob: false }))
	.get("/", "Hello World")
	// Protected smoke route — returns the current user, session, and connected account count
	.use(requireAuth)
	.get("/me", async ({ authUser, authSession }) => {
		const accounts = await db
			.select({ id: connectedAccount.id })
			.from(connectedAccount)
			.where(eq(connectedAccount.userId, authUser?.id ?? ""));

		return {
			user: authUser,
			session: authSession,
			connectedAccountCount: accounts.length,
		};
	})
	/**
	 * GET /api/auth/desktop/callback
	 *
	 * Better Auth redirects here after verifying the provider OAuth response.
	 * This endpoint:
	 *   1. Reads the authenticated session from the request cookies
	 *   2. Mints a random one-time code (crypto.randomUUID())
	 *   3. Associates the code with the authenticated user and a state value
	 *   4. Redirects the browser to atlas://auth/callback?code=<code>&state=<state>
	 *
	 * The code is short-lived (60 seconds) and single-use.
	 * Codes are NEVER logged.
	 */
	.get(
		"/api/auth/desktop/callback",
		async ({ request, set, query }) => {
			const sessionData = await auth.api
				.getSession({ headers: request.headers })
				.catch(() => null);

			if (!sessionData?.user) {
				set.status = 401;
				return { error: "Unauthorized" };
			}

			const state = (query.state as string) ?? crypto.randomUUID();
			// Mint a one-time code — never log this value
			const code = crypto.randomUUID();

			pendingDesktopCodes.set(code, {
				userId: sessionData.user.id,
				state,
				expiresAt: Date.now() + 60_000,
			});

			// Redirect to the Tauri deep-link URL
			const callbackUrl = new URL("atlas://auth/callback");
			callbackUrl.searchParams.set("code", code);
			callbackUrl.searchParams.set("state", state);

			set.status = 302;
			set.headers.Location = callbackUrl.toString();
			return null;
		},
		{
			query: t.Object({
				state: t.Optional(t.String()),
			}),
		},
	)
	/**
	 * POST /api/auth/desktop/exchange
	 *
	 * Accepts a one-time code from the Tauri desktop app and exchanges it for
	 * an authenticated session. The code must be:
	 *   - Known (present in the pending codes map)
	 *   - Unexpired (within 60 seconds of issuance)
	 *   - Single-use (deleted from the map on first use)
	 *   - State-matched (state param must match the stored state)
	 *
	 * On success: creates a Better Auth session for the associated user,
	 * sets the auth cookie, and returns { ok: true }.
	 *
	 * Codes are NEVER logged.
	 */
	.post(
		"/api/auth/desktop/exchange",
		async ({ body, set }) => {
			const { code, state } = body;

			const entry = pendingDesktopCodes.get(code);

			// Validate: code must exist, be unexpired, and state must match
			if (!entry || entry.expiresAt <= Date.now() || entry.state !== state) {
				set.status = 400;
				return { error: "Invalid or expired code" };
			}

			// Single-use: delete immediately after validation
			pendingDesktopCodes.delete(code);

			// Create a Better Auth session for the associated user via the internal adapter
			const ctx = await auth.$context;
			const session = await ctx.internalAdapter
				.createSession(entry.userId)
				.catch(() => null);

			if (!session) {
				set.status = 500;
				return { error: "Failed to create session" };
			}

			// Sign the session token and set the Better Auth session cookie.
			// Better Auth uses HMAC-SHA256: signed value = "<token>.<base64(signature)>"
			const token = session.token;
			const secret = ctx.secret;
			const key = await crypto.subtle.importKey(
				"raw",
				new TextEncoder().encode(secret),
				{ name: "HMAC", hash: "SHA-256" },
				false,
				["sign"],
			);
			const sigBuf = await crypto.subtle.sign(
				"HMAC",
				key,
				new TextEncoder().encode(token),
			);
			const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
			const signedToken = `${token}.${sig}`;

			const cookieName = ctx.authCookies.sessionToken.name;
			const attrs = ctx.authCookies.sessionToken.attributes;
			const maxAge = ctx.sessionConfig.expiresIn;

			// Build Set-Cookie header string
			let cookieStr = `${cookieName}=${encodeURIComponent(signedToken)}`;
			if (maxAge) cookieStr += `; Max-Age=${maxAge}`;
			if (attrs.path) cookieStr += `; Path=${attrs.path}`;
			if (attrs.domain) cookieStr += `; Domain=${attrs.domain}`;
			if (attrs.sameSite) cookieStr += `; SameSite=${attrs.sameSite}`;
			if (attrs.secure) cookieStr += "; Secure";
			if (attrs.httpOnly) cookieStr += "; HttpOnly";

			set.headers["Set-Cookie"] = cookieStr;

			return { ok: true };
		},
		{
			body: t.Object({
				code: t.String(),
				state: t.String(),
			}),
		},
	);

export type ElysiaApp = typeof app;
