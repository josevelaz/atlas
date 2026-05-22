import { html } from "@elysiajs/html";
import { serverTiming } from "@elysiajs/server-timing";
import { staticPlugin } from "@elysiajs/static";
import { swagger } from "@elysiajs/swagger";
import { Elysia } from "elysia";
import { autoload } from "elysia-autoload";

import { auth } from "./auth.ts";
import { config } from "./config.ts";
import { authSessionPlugin, requireAuth } from "./plugins/auth-session.ts";

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
	// Protected smoke route — returns the current user & session
	.use(requireAuth)
	.get("/me", ({ authUser, authSession }) => ({
		user: authUser,
		session: authSession,
	}));

export type ElysiaApp = typeof app;
