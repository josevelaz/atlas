/**
 * @file routes/accounts.ts — Sync trigger and status routes for connected accounts.
 *
 * ## Routes
 *
 *   POST /api/accounts/:id/sync
 *     Manually trigger a sync for the given connected account.
 *     - Requires authentication (requireAuth).
 *     - Verifies the account belongs to the authenticated user.
 *     - Rejects accounts with inactive lifecycle states (not "active").
 *     - Idempotent: returns the existing active/queued run if one exists.
 *
 *   GET /api/accounts/:id/sync/status
 *     Return the synthesized sync status for the given connected account.
 *     - Requires authentication (requireAuth).
 *     - Verifies the account belongs to the authenticated user.
 *     - Returns connected_account.status, sync_state, active run, and latest run.
 */

import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { db } from "../db/index.ts";
import { connectedAccount } from "../db/schema/connected_account.ts";
import { requireAuth } from "../plugins/auth_session.ts";
import { enqueueSyncTrigger } from "../services/sync/orchestrator.ts";
import { getSyncStatus } from "../services/sync/status.ts";

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export const accountsRoutes = new Elysia({ prefix: "/api/accounts" })
	.use(requireAuth)

	// ── POST /api/accounts/:id/sync ─────────────────────────────────────────
	.post(
		"/:id/sync",
		async ({ params, authUser, set }) => {
			const { id } = params;

			// ── Ownership check ──────────────────────────────────────────────
			const account = await db.query.connectedAccount.findFirst({
				where: eq(connectedAccount.id, id),
				columns: { id: true, userId: true, status: true },
			});

			if (!account) {
				set.status = 404;
				return { error: "Account not found" };
			}

			// authUser is guaranteed non-null by requireAuth
			if (account.userId !== authUser!.id) {
				set.status = 403;
				return { error: "Forbidden" };
			}

			// ── Lifecycle guard ──────────────────────────────────────────────
			// Only "active" accounts can be manually triggered.
			if (account.status !== "active") {
				set.status = 422;
				return {
					error: "Account is not active",
					status: account.status,
				};
			}

			// ── Idempotent enqueue ───────────────────────────────────────────
			const outcome = await enqueueSyncTrigger({
				connectedAccountId: id,
				triggerSource: "manual",
			});

			switch (outcome.status) {
				case "enqueued":
					set.status = 202;
					return {
						status: "enqueued",
						jobId: outcome.jobId,
					};

				case "skipped_active_db_run":
					// A sync_job row with status="running" already exists.
					set.status = 200;
					return {
						status: "already_running",
						existingSyncJobId: outcome.existingSyncJobId,
					};

				case "skipped_active_queue_job":
					// A BullMQ job is already queued/active for this account.
					set.status = 200;
					return {
						status: "already_queued",
						existingBullMqJobId: outcome.existingBullMqJobId,
					};
			}
		},
		{
			params: t.Object({ id: t.String() }),
		},
	)

	// ── GET /api/accounts/:id/sync/status ───────────────────────────────────
	.get(
		"/:id/sync/status",
		async ({ params, authUser, set }) => {
			const { id } = params;

			// ── Ownership check ──────────────────────────────────────────────
			const account = await db.query.connectedAccount.findFirst({
				where: eq(connectedAccount.id, id),
				columns: { id: true, userId: true, status: true },
			});

			if (!account) {
				set.status = 404;
				return { error: "Account not found" };
			}

			// authUser is guaranteed non-null by requireAuth
			if (account.userId !== authUser!.id) {
				set.status = 403;
				return { error: "Forbidden" };
			}

			// ── Synthesized status ───────────────────────────────────────────
			const syncStatus = await getSyncStatus(id);

			return {
				accountId: id,
				accountStatus: account.status,
				syncState: syncStatus
					? {
							syncMode: syncStatus.syncMode,
							health: syncStatus.health,
							syncCursor: syncStatus.syncCursor,
							lastSyncedAt: syncStatus.lastSyncedAt,
							lastAttemptedAt: syncStatus.lastAttemptedAt,
						}
					: null,
				activeRun:
					syncStatus?.lastJob?.status === "running" ? syncStatus.lastJob : null,
				latestCompletedRun:
					syncStatus?.lastJob && syncStatus.lastJob.status !== "running"
						? syncStatus.lastJob
						: null,
			};
		},
		{
			params: t.Object({ id: t.String() }),
		},
	);
