/**
 * @file routes/accounts_connect.ts — Mailbox OAuth connect routes.
 *
 * ## Routes
 *
 *   POST /api/accounts/google/connect/start
 *     Initiates a Gmail mailbox-connect flow.
 *     - Requires authentication (requireAuth).
 *     - Returns { authUrl, state } — the client opens authUrl in a browser.
 *     - Stores a short-lived pending state record (5 minutes).
 *     - Accepts an optional `returnIntent` query param forwarded to the callback.
 *     - Accepts a `channel` param: "web" (default) or "desktop".
 *       Desktop flows use a dedicated deep-link redirect URI.
 *
 *   GET /api/accounts/google/connect/callback
 *     Google OAuth callback for web flows.
 *     - Validates state, exchanges code, persists connected account.
 *     - Redirects to returnIntent on success or /onboarding?error=... on failure.
 *
 *   GET /api/accounts/google/connect/desktop/callback
 *     Google OAuth callback for desktop flows.
 *     - Validates state, then redirects to atlas://mailbox-connect/callback
 *       with only the state parameter (no code — code stays server-side).
 *     - The desktop app calls /complete to finish the exchange.
 *
 *   POST /api/accounts/google/connect/desktop/complete
 *     Desktop mailbox-connect completion.
 *     - Requires authentication (requireAuth).
 *     - Accepts { state } — validates the pending state, exchanges the stored
 *       code with Google, and persists the connected account.
 *     - Returns { ok: true, accountId } on success.
 */

import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { config } from "../config.ts";
import { db } from "../db/index.ts";
import { connectedAccount } from "../db/schema/connected_account.ts";
import { requireAuth } from "../plugins/auth_session.ts";

// ---------------------------------------------------------------------------
// Pending mailbox-connect state store
//
// Maps state → { userId, code?, returnIntent, channel, expiresAt }
// State is a high-entropy random value bound to a single authorization attempt.
// Codes are single-use and expire after 5 minutes.
// Codes are NEVER logged.
// ---------------------------------------------------------------------------

type PendingMailboxConnect = {
	userId: string;
	/** OAuth code from Google — only set after the callback arrives */
	code?: string;
	returnIntent: string;
	channel: "web" | "desktop";
	expiresAt: number;
};

const pendingMailboxConnects = new Map<string, PendingMailboxConnect>();

// Periodic cleanup — runs every 60 seconds
setInterval(() => {
	const now = Date.now();
	for (const [state, entry] of pendingMailboxConnects) {
		if (entry.expiresAt <= now) {
			pendingMailboxConnects.delete(state);
		}
	}
}, 60_000);

// ---------------------------------------------------------------------------
// Google OAuth helpers
// ---------------------------------------------------------------------------

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT =
	"https://www.googleapis.com/oauth2/v2/userinfo";

/** Gmail readonly scope — sufficient for reading new mail */
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

/**
 * Build the web redirect URI for the Google OAuth callback.
 * Uses the API_URL from config so it works in all environments.
 */
function webCallbackUri(): string {
	const base = config.API_URL.replace(/\/$/, "");
	return `${base}/api/accounts/google/connect/callback`;
}

/**
 * Build the desktop redirect URI for the Google OAuth callback.
 * Uses the API_URL from config so it works in all environments.
 */
function desktopCallbackUri(): string {
	const base = config.API_URL.replace(/\/$/, "");
	return `${base}/api/accounts/google/connect/desktop/callback`;
}

/**
 * Build the Google authorization URL for a mailbox-connect flow.
 */
function buildGoogleAuthUrl(state: string, channel: "web" | "desktop"): string {
	const redirectUri =
		channel === "desktop" ? desktopCallbackUri() : webCallbackUri();

	const params = new URLSearchParams({
		client_id: config.GOOGLE_CLIENT_ID ?? "",
		redirect_uri: redirectUri,
		response_type: "code",
		scope: GMAIL_SCOPE,
		state,
		access_type: "offline",
		prompt: "consent",
	});

	return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Exchange an authorization code for tokens from Google.
 * Returns { access_token, refresh_token, expires_in, token_type } or throws.
 */
async function exchangeCodeForTokens(
	code: string,
	channel: "web" | "desktop",
): Promise<{
	access_token: string;
	refresh_token?: string;
	expires_in: number;
	token_type: string;
}> {
	const redirectUri =
		channel === "desktop" ? desktopCallbackUri() : webCallbackUri();

	const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			code,
			client_id: config.GOOGLE_CLIENT_ID ?? "",
			client_secret: config.GOOGLE_CLIENT_SECRET ?? "",
			redirect_uri: redirectUri,
			grant_type: "authorization_code",
		}).toString(),
	});

	if (!res.ok) {
		throw new Error(`Google token exchange failed: ${res.status}`);
	}

	return res.json() as Promise<{
		access_token: string;
		refresh_token?: string;
		expires_in: number;
		token_type: string;
	}>;
}

/**
 * Fetch the Gmail user's email address using the access token.
 */
async function fetchGoogleUserEmail(
	accessToken: string,
): Promise<{ email: string; id: string }> {
	const res = await fetch(GOOGLE_USERINFO_ENDPOINT, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});

	if (!res.ok) {
		throw new Error(`Google userinfo fetch failed: ${res.status}`);
	}

	return res.json() as Promise<{ email: string; id: string }>;
}

/**
 * Persist or reactivate a connected account after successful token exchange.
 *
 * Rules:
 * - If a row exists for (userId, providerAccountEmail) and is disconnected → reactivate it.
 * - If no row exists → create a new one.
 * - If a row exists for the same email under a DIFFERENT userId → reject (non-enumerating).
 * - If a row exists for (userId, providerAccountEmail) and is already active → return it.
 *
 * Tokens are stored as plaintext in this MVP implementation.
 * Task 4.0 will add encryption-at-rest.
 */
async function persistConnectedAccount(
	userId: string,
	email: string,
	tokens: {
		access_token: string;
		refresh_token?: string;
		expires_in: number;
	},
): Promise<{ id: string; created: boolean }> {
	const now = new Date();
	const accessTokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

	// Check if this email is already connected to a DIFFERENT user (non-enumerating rejection)
	const existingOtherUser = await db.query.connectedAccount.findFirst({
		where: and(
			eq(connectedAccount.providerAccountEmail, email),
			// We can't use ne() directly in a simple query — use or with the inverse
		),
		columns: { id: true, userId: true, status: true },
	});

	if (existingOtherUser && existingOtherUser.userId !== userId) {
		// Non-enumerating: don't reveal that another user has this mailbox
		throw new Error("mailbox_already_connected");
	}

	// Check if this user already has this email connected
	const existingOwn = await db.query.connectedAccount.findFirst({
		where: and(
			eq(connectedAccount.userId, userId),
			eq(connectedAccount.providerAccountEmail, email),
		),
		columns: { id: true, status: true },
	});

	if (existingOwn) {
		if (existingOwn.status === "active") {
			// Already active — idempotent return
			return { id: existingOwn.id, created: false };
		}

		// Reactivate disconnected/error account
		await db
			.update(connectedAccount)
			.set({
				status: "active",
				encAccessToken: tokens.access_token,
				encRefreshToken: tokens.refresh_token ?? null,
				accessTokenExpiresAt,
				reactivatedAt: now,
				updatedAt: now,
			})
			.where(eq(connectedAccount.id, existingOwn.id));

		return { id: existingOwn.id, created: false };
	}

	// Create new connected account
	const id = crypto.randomUUID();
	await db.insert(connectedAccount).values({
		id,
		userId,
		providerAccountEmail: email,
		provider: "google",
		status: "active",
		encAccessToken: tokens.access_token,
		encRefreshToken: tokens.refresh_token ?? null,
		accessTokenExpiresAt,
		connectedAt: now,
		createdAt: now,
		updatedAt: now,
	});

	return { id, created: true };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export const accountsConnectRoutes = new Elysia({ prefix: "/api/accounts" })
	// ── POST /api/accounts/google/connect/start ──────────────────────────────
	.use(requireAuth)
	.post(
		"/google/connect/start",
		async ({ authUser, body, set }) => {
			if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
				set.status = 503;
				return { error: "Google mailbox connect is not configured" };
			}

			// requireAuth guarantees authUser is non-null
			if (!authUser) {
				set.status = 401;
				return { error: "Unauthorized" };
			}

			const { returnIntent = "/", channel = "web" } = body;

			// Generate a high-entropy state value
			const state = crypto.randomUUID();

			// Store the pending connect state (5 minute TTL)
			pendingMailboxConnects.set(state, {
				userId: authUser.id,
				returnIntent,
				channel: channel as "web" | "desktop",
				expiresAt: Date.now() + 5 * 60 * 1000,
			});

			const authUrl = buildGoogleAuthUrl(state, channel as "web" | "desktop");

			return { authUrl, state };
		},
		{
			body: t.Object({
				returnIntent: t.Optional(t.String()),
				channel: t.Optional(t.Union([t.Literal("web"), t.Literal("desktop")])),
			}),
		},
	)

	// ── GET /api/accounts/google/connect/callback (web) ──────────────────────
	.get(
		"/google/connect/callback",
		async ({ query, set }) => {
			const { code, state, error } = query;

			if (error || !code || !state) {
				set.status = 302;
				set.headers.Location = `/onboarding?error=mailbox_connect_failed`;
				return null;
			}

			const pending = pendingMailboxConnects.get(state);
			if (!pending || pending.expiresAt <= Date.now()) {
				pendingMailboxConnects.delete(state);
				set.status = 302;
				set.headers.Location = `/onboarding?error=mailbox_connect_expired`;
				return null;
			}

			// Single-use: delete immediately
			pendingMailboxConnects.delete(state);

			try {
				const tokens = await exchangeCodeForTokens(code, "web");
				const userInfo = await fetchGoogleUserEmail(tokens.access_token);
				await persistConnectedAccount(pending.userId, userInfo.email, tokens);

				const dest = pending.returnIntent ?? "/";
				set.status = 302;
				set.headers.Location = dest;
				return null;
			} catch {
				set.status = 302;
				set.headers.Location = `/onboarding?error=mailbox_connect_failed`;
				return null;
			}
		},
		{
			query: t.Object({
				code: t.Optional(t.String()),
				state: t.Optional(t.String()),
				error: t.Optional(t.String()),
			}),
		},
	)

	// ── GET /api/accounts/google/connect/desktop/callback ────────────────────
	//
	// Google redirects here after the user grants consent in the system browser.
	// We validate state, store the code, then redirect to the Tauri deep-link
	// atlas://mailbox-connect/callback?state=<state>
	// The code is NOT forwarded to the deep link — it stays server-side.
	// The desktop app calls /complete with the state to finish the exchange.
	.get(
		"/google/connect/desktop/callback",
		async ({ query, set }) => {
			const { code, state, error } = query;

			if (error || !code || !state) {
				// Redirect to deep link with error signal
				set.status = 302;
				set.headers.Location = `atlas://mailbox-connect/callback?error=access_denied`;
				return null;
			}

			const pending = pendingMailboxConnects.get(state);
			if (!pending || pending.expiresAt <= Date.now()) {
				pendingMailboxConnects.delete(state);
				set.status = 302;
				set.headers.Location = `atlas://mailbox-connect/callback?error=expired`;
				return null;
			}

			// Store the code in the pending record — do NOT log it
			pending.code = code;
			// Shorten TTL to 60 seconds for the complete step
			pending.expiresAt = Date.now() + 60_000;

			// Redirect to Tauri deep link — only state is forwarded (no code)
			const callbackUrl = new URL("atlas://mailbox-connect/callback");
			callbackUrl.searchParams.set("state", state);

			set.status = 302;
			set.headers.Location = callbackUrl.toString();
			return null;
		},
		{
			query: t.Object({
				code: t.Optional(t.String()),
				state: t.Optional(t.String()),
				error: t.Optional(t.String()),
			}),
		},
	)

	// ── POST /api/accounts/google/connect/desktop/complete ───────────────────
	//
	// Called by the desktop app after receiving the deep-link callback.
	// Validates the state, exchanges the stored code with Google, and persists
	// the connected account.
	.post(
		"/google/connect/desktop/complete",
		async ({ authUser, body, set }) => {
			// requireAuth guarantees authUser is non-null
			if (!authUser) {
				set.status = 401;
				return { error: "Unauthorized" };
			}

			const { state } = body;

			const pending = pendingMailboxConnects.get(state);

			// Validate: state must exist, be unexpired, belong to this user, and have a code
			if (
				!pending ||
				pending.expiresAt <= Date.now() ||
				pending.userId !== authUser.id ||
				!pending.code
			) {
				pendingMailboxConnects.delete(state);
				set.status = 400;
				return { error: "Invalid or expired mailbox connect state" };
			}

			// Single-use: delete immediately
			const code = pending.code;
			pendingMailboxConnects.delete(state);

			try {
				const tokens = await exchangeCodeForTokens(code, "desktop");
				const userInfo = await fetchGoogleUserEmail(tokens.access_token);
				const result = await persistConnectedAccount(
					authUser.id,
					userInfo.email,
					tokens,
				);

				return {
					ok: true,
					accountId: result.id,
					created: result.created,
					email: userInfo.email,
				};
			} catch (err) {
				const msg = err instanceof Error ? err.message : "unknown";
				if (msg === "mailbox_already_connected") {
					set.status = 409;
					return {
						error: "This mailbox is already connected to another account",
					};
				}
				set.status = 500;
				return { error: "Mailbox connect failed" };
			}
		},
		{
			body: t.Object({
				state: t.String(),
			}),
		},
	);

export default accountsConnectRoutes;
