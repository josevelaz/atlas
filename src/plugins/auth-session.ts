import { Elysia } from "elysia";

import { auth } from "../auth.ts";

/**
 * Derives `authSession` and `authUser` from the incoming request cookies.
 * Validates the server-side session on every request — never trusts
 * client-provided user IDs, bearer tokens, or decoded cookies.
 *
 * Mount this plugin before any routes that need session context.
 */
export const authSessionPlugin = new Elysia({ name: "auth-session" }).derive(
	{ as: "global" },
	async ({ request }) => {
		const sessionData = await auth.api
			.getSession({ headers: request.headers })
			.catch(() => null);

		return {
			authSession: sessionData?.session ?? null,
			authUser: sessionData?.user ?? null,
		};
	},
);

/**
 * Guard that rejects unauthenticated requests with a 401 JSON response.
 * Composes `authSessionPlugin` so the derived context is always available.
 *
 * Usage:
 * ```ts
 * app
 *   .use(requireAuth)
 *   .get("/me", ({ authUser, authSession }) => ({ user: authUser, session: authSession }))
 * ```
 */
export const requireAuth = new Elysia({ name: "require-auth" })
	.use(authSessionPlugin)
	.onBeforeHandle({ as: "global" }, ({ authSession, set }) => {
		if (!authSession) {
			set.status = 401;
			return { error: "Unauthorized" };
		}
	});
