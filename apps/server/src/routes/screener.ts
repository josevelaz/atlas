import { type Elysia, t } from "elysia";

import { authSessionPlugin } from "../plugins/auth_session.ts";
import {
	acceptSender,
	listRejectedSenders,
	recoverSender,
	RejectedSenderNotFoundError,
	rejectSender,
} from "../services/screener.ts";

const categorySchema = t.Union([
	t.Literal("inbox"),
	t.Literal("feed"),
	t.Literal("paper_trail"),
]);

/**
 * Sender path params arrive percent-encoded (`bob%40example.com`). Elysia
 * may or may not have decoded them depending on version/encoding, so decode
 * once iff an escape sequence is still present — never twice.
 */
const senderEmailParam = (raw: string): string => {
	if (!raw.includes("%")) return raw;
	try {
		return decodeURIComponent(raw);
	} catch {
		return raw;
	}
};

/**
 * Screener decision endpoints. Autoloaded by `elysia-autoload` (file path =
 * route prefix → `/screener`). All routes require a valid session.
 *
 * Decisions are USER-GLOBAL across connected accounts (the sender trust row
 * is keyed on user + email, not on a mailbox):
 *
 *   - `POST /screener/senders/:email/accept {category}` — trust `accepted`
 *     + default_category; the sender's screener threads move to
 *     `categorized`. Future new threads route to the category at ingest.
 *   - `POST /screener/senders/:email/reject` — trust `rejected`; current
 *     screener threads and future new threads become `hidden`
 *     (recoverable).
 *   - `GET /screener/rejected` — rejected senders with hidden-thread
 *     counts, for the recovery UI.
 *   - `POST /screener/senders/:email/recover {category, restoreHidden?}` —
 *     re-accept a rejected sender; optionally restore hidden threads. 404s
 *     when the sender is not currently rejected.
 *
 * Per-thread overrides live on the thread resource:
 * `POST /mail/threads/:id/category` (see `routes/mail/threads.ts`).
 */
export default (app: Elysia) =>
	app
		.use(authSessionPlugin)
		.post(
			"/senders/:email/accept",
			async ({ authUser, params, body, set }) => {
				if (!authUser) {
					set.status = 401;
					return { error: "Unauthorized" };
				}
				return await acceptSender(
					authUser.id,
					senderEmailParam(params.email),
					body.category,
				);
			},
			{
				params: t.Object({ email: t.String() }),
				body: t.Object({ category: categorySchema }),
			},
		)
		.post(
			"/senders/:email/reject",
			async ({ authUser, params, set }) => {
				if (!authUser) {
					set.status = 401;
					return { error: "Unauthorized" };
				}
				return await rejectSender(authUser.id, senderEmailParam(params.email));
			},
			{
				params: t.Object({ email: t.String() }),
			},
		)
		.get("/rejected", async ({ authUser, set }) => {
			if (!authUser) {
				set.status = 401;
				return { error: "Unauthorized" };
			}
			return { senders: await listRejectedSenders(authUser.id) };
		})
		.post(
			"/senders/:email/recover",
			async ({ authUser, params, body, set }) => {
				if (!authUser) {
					set.status = 401;
					return { error: "Unauthorized" };
				}
				try {
					return await recoverSender(
						authUser.id,
						senderEmailParam(params.email),
						{ category: body.category, restoreHidden: body.restoreHidden },
					);
				} catch (error) {
					if (error instanceof RejectedSenderNotFoundError) {
						set.status = 404;
						return { error: "Rejected sender not found" };
					}
					throw error;
				}
			},
			{
				params: t.Object({ email: t.String() }),
				body: t.Object({
					category: categorySchema,
					restoreHidden: t.Optional(t.Boolean()),
				}),
			},
		);
