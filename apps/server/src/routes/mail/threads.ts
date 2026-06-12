import { type Elysia, t } from "elysia";

import { authSessionPlugin } from "../../plugins/auth_session.ts";
import {
	getThreadDetail,
	InvalidCursorError,
	listThreads,
	MailAccountNotFoundError,
	ThreadNotFoundError,
} from "../../services/mail_queries.ts";

/**
 * Mail read endpoints. Autoloaded by `elysia-autoload` (file path = route
 * prefix → `/mail/threads`). Both routes require a valid session — the
 * derived `authUser` comes from `authSessionPlugin`, which validates the
 * server-side session cookie on every request.
 *
 *   - `GET /mail/threads?view=…&accountId?&cursor?&limit?` — one page of
 *     the user's threads for a view, unified across connected accounts by
 *     default. `accountId` (a `connected_account.id`) narrows to one
 *     account; unknown/foreign ids 404. Bad cursors 400. Every row carries
 *     provenance (`connectedAccountId`, `accountEmail`, `accountStatus`).
 *   - `GET /mail/threads/:id` — thread detail with messages (body_state,
 *     attachment metadata) and provenance. Strict ownership: ids owned by
 *     other users 404, indistinguishable from missing ids.
 */
export default (app: Elysia) =>
	app
		.use(authSessionPlugin)
		.get(
			"",
			async ({ authUser, query, set }) => {
				if (!authUser) {
					set.status = 401;
					return { error: "Unauthorized" };
				}
				try {
					return await listThreads(authUser.id, {
						view: query.view,
						accountId: query.accountId,
						cursor: query.cursor,
						limit: query.limit,
					});
				} catch (error) {
					if (error instanceof MailAccountNotFoundError) {
						set.status = 404;
						return { error: "Connected account not found" };
					}
					if (error instanceof InvalidCursorError) {
						set.status = 400;
						return { error: "Invalid cursor" };
					}
					throw error;
				}
			},
			{
				query: t.Object({
					view: t.Union([
						t.Literal("inbox"),
						t.Literal("feed"),
						t.Literal("paper_trail"),
						t.Literal("screener"),
						t.Literal("spam"),
					]),
					accountId: t.Optional(t.String()),
					cursor: t.Optional(t.String()),
					limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
				}),
			},
		)
		.get(
			"/:id",
			async ({ authUser, params, set }) => {
				if (!authUser) {
					set.status = 401;
					return { error: "Unauthorized" };
				}
				try {
					return await getThreadDetail(authUser.id, params.id);
				} catch (error) {
					if (error instanceof ThreadNotFoundError) {
						set.status = 404;
						return { error: "Thread not found" };
					}
					throw error;
				}
			},
			{
				params: t.Object({ id: t.String() }),
			},
		);
