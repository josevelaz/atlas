import type { Elysia } from "elysia";

import { config } from "../../config.ts";
import { handleGmailPush } from "../../services/gmail/push_auth.ts";

/**
 * `POST /gmail/push` — Google Cloud Pub/Sub push endpoint for Gmail watch
 * notifications. Autoloaded by `elysia-autoload` (file path = route prefix).
 *
 * Contract:
 *   - 404 when push env is unset (`GMAIL_PUSH_ENABLED` false) — the
 *     endpoint does not exist in polling-only deployments.
 *   - 401 when the OIDC bearer token is missing/malformed.
 *   - 403 when it is forged, expired, or has the wrong issuer / audience /
 *     service-account email claim.
 *   - 204 always on valid auth (fast ack) — including unparsable envelopes
 *     and unknown mailboxes, so Pub/Sub never redelivers garbage.
 *
 * The payload is a HINT only: we look up the active connected_account by
 * `emailAddress` and enqueue the `gmail-catch-up` history-sync job, which
 * syncs from its own persisted forward-only cursor. The payload's
 * `historyId` is never trusted (see `services/gmail/push_auth.ts`).
 *
 * Note: the raw body is read here (not Elysia's parsed `body`) so malformed
 * JSON degrades to a 204 ack instead of a framework 400.
 */
export default (app: Elysia) =>
	app.post("", async ({ request, set }) => {
		if (
			!config.GMAIL_PUSH_ENABLED ||
			!config.GMAIL_PUSH_AUDIENCE ||
			!config.GMAIL_PUSH_SERVICE_ACCOUNT
		) {
			set.status = 404;
			return { error: "Not Found" };
		}

		const outcome = await handleGmailPush(
			{
				authorization: request.headers.get("authorization"),
				rawBody: await request.text(),
			},
			{
				audience: config.GMAIL_PUSH_AUDIENCE,
				serviceAccountEmail: config.GMAIL_PUSH_SERVICE_ACCOUNT,
			},
		).catch((error) => {
			// Lookup/enqueue hiccups must not turn into Pub/Sub redelivery
			// storms — log and ack. Auth failures never reach this path.
			console.error("[gmail/push] failed to process notification", error);
			return { status: 204 as const, enqueuedConnectedAccountIds: [] };
		});

		if (outcome.status !== 204) {
			set.status = outcome.status;
			return { error: "Unauthorized" };
		}

		set.status = 204;
	});
