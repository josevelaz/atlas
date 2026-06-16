import { html } from "@elysiajs/html";
import { serverTiming } from "@elysiajs/server-timing";
import { staticPlugin } from "@elysiajs/static";
import { swagger } from "@elysiajs/swagger";
import { Elysia, t } from "elysia";
import { autoload } from "elysia-autoload";

import { auth } from "./auth.ts";
import { config } from "./config.ts";
import { authSessionPlugin, requireAuth } from "./plugins/auth_session.ts";
import { CSRF_HEADER } from "./plugins/csrf_guard.ts";
import {
	ConnectedAccountForbiddenError,
	ConnectedAccountNotFoundError,
	disconnectConnectedAccount,
	listConnectedAccounts,
	setPrimaryConnectedAccount,
} from "./services/connected_accounts.ts";

const CORS_METHODS = "GET, POST, PUT, DELETE, OPTIONS";
const CORS_HEADERS = ["Content-Type", "Authorization", CSRF_HEADER].join(", ");

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
	// Identity endpoints — all guarded by requireAuth (401 when no session)
	.use(requireAuth)
	.get("/me", ({ authUser, set }) => {
		if (!authUser) {
			set.status = 401;
			return { error: "Unauthorized" };
		}
		return {
			user: {
				id: authUser.id,
				name: authUser.name,
				email: authUser.email,
				image: authUser.image ?? null,
				createdAt: authUser.createdAt.toISOString(),
			},
		};
	})
	.get("/me/connected-accounts", async ({ authUser, set }) => {
		if (!authUser) {
			set.status = 401;
			return { error: "Unauthorized" };
		}
		const accounts = await listConnectedAccounts(authUser.id);
		return {
			accounts,
			// Effective primary id; empty string when the user has no
			// connected OAuth accounts (credential-only users).
			primaryConnectedAccountId:
				accounts.find((row) => row.isPrimary)?.id ?? "",
		};
	})
	.put(
		"/me/primary-connected-account",
		async ({ authUser, body, set }) => {
			if (!authUser) {
				set.status = 401;
				return { error: "Unauthorized" };
			}
			try {
				await setPrimaryConnectedAccount(authUser.id, body.accountId);
			} catch (error) {
				if (error instanceof ConnectedAccountNotFoundError) {
					set.status = 404;
					return { error: "Connected account not found" };
				}
				if (error instanceof ConnectedAccountForbiddenError) {
					set.status = 403;
					return { error: "Account is not a connected OAuth account" };
				}
				throw error;
			}
			set.status = 204;
		},
		{
			body: t.Object({ accountId: t.String() }),
		},
	)
	.post(
		"/me/connected-accounts/:id/disconnect",
		async ({ authUser, params, set }) => {
			if (!authUser) {
				set.status = 401;
				return { error: "Unauthorized" };
			}
			try {
				// Best-effort watch stop happens inside; threads are retained.
				await disconnectConnectedAccount(authUser.id, params.id);
			} catch (error) {
				// Not-found also covers other users' account ids — ownership is
				// checked in the service and deliberately indistinguishable.
				if (error instanceof ConnectedAccountNotFoundError) {
					set.status = 404;
					return { error: "Connected account not found" };
				}
				if (error instanceof ConnectedAccountForbiddenError) {
					set.status = 403;
					return { error: "Account is not a connected OAuth account" };
				}
				throw error;
			}
			set.status = 204;
		},
		{
			params: t.Object({ id: t.String() }),
		},
	);

export type ElysiaApp = typeof app;
