import type { Job as JobifyJob } from "jobify";

import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";

import { connectedAccount } from "../db/schema.ts";
import {
	type ConnectJobPayload,
	GMAIL_CATCH_UP_QUEUE,
	GMAIL_WATCH_SETUP_QUEUE,
} from "../services/ingestion/connect.ts";
import type { GmailHistorySyncPayload } from "./gmail_history_sync.ts";

/**
 * Gmail polling-fallback + repair-sweep + watch-renewal jobs.
 *
 * Two repeating sweeps live here (scheduled by `jobs/scheduler.ts`,
 * gated entirely on `GMAIL_INGESTION_ENABLED`):
 *
 *   - `gmail-poll` queue ({@link runGmailPoll}) — one job, two modes:
 *       - `poll` (tight interval, `GMAIL_POLL_INTERVAL_SECONDS`): enqueue a
 *         history sync for every ACTIVE account in `polling` or `degraded`
 *         sync state. This is the only delivery mechanism for accounts
 *         without a live push watch.
 *       - `repair` (slow safety net, every 30 min): enqueue a history sync
 *         for every ACTIVE account in `watching` state, so a dropped or
 *         delayed Pub/Sub push can never permanently stall a mailbox.
 *
 *   - `gmail-watch-renewal` queue ({@link runGmailWatchRenewal}, daily-ish):
 *     re-enqueue the `gmail-watch-setup` job for ACTIVE `watching` accounts
 *     whose `watch_expiration` falls within the next
 *     {@link GMAIL_WATCH_RENEWAL_WINDOW_HOURS}. Degrade-on-failure semantics
 *     come from the watch-setup job itself (`jobs/gmail_watch.ts`): retryable
 *     failures mark the account `degraded` and back off, exhausted/fatal
 *     failures fall back to `polling` — which the `poll` sweep then covers.
 *
 * Disconnected accounts (`connected_account.status = "disconnected"`, the
 * authoritative kill switch) are excluded by EVERY query here — no sweep ever
 * schedules work for them.
 *
 * Enqueue policy: sweep enqueues deliberately carry NO `jobId`. BullMQ keeps
 * completed jobs around (`removeOnComplete` is count-based), and an existing
 * completed job with the same id silently swallows re-adds — id-deduped
 * recurring enqueues would starve low-traffic accounts. Duplicate syncs are
 * already harmless: the history-sync job holds a per-account Verrou lock and
 * skips with `already_running`.
 *
 * Testability: no db/config/redis work at import time — db, enqueue seams,
 * the feature flag, and "now" are injectable and resolved lazily otherwise.
 */

/** Queue for the recurring poll/repair sweep. */
export const GMAIL_POLL_QUEUE = "gmail-poll";

/** Queue for the recurring watch-renewal sweep. */
export const GMAIL_WATCH_RENEWAL_QUEUE = "gmail-watch-renewal";

/**
 * Renew watches expiring within this window. Gmail watches last ~7 days and
 * the renewal sweep runs roughly daily, so 48h gives at least one full extra
 * sweep of slack before a watch can lapse.
 */
export const GMAIL_WATCH_RENEWAL_WINDOW_HOURS = 48;

type Db = typeof import("../db/index.ts")["db"];

let defaultDb: Db | undefined;

const getDb = async (): Promise<Db> => {
	if (!defaultDb) {
		({ db: defaultDb } = await import("../db/index.ts"));
	}
	return defaultDb;
};

const getDefaultIngestionEnabled = async (): Promise<boolean> => {
	const { config } = await import("../config.ts");
	return config.GMAIL_INGESTION_ENABLED;
};

/** `poll` = polling/degraded accounts; `repair` = watching safety net. */
export type GmailPollMode = "poll" | "repair";

/** Payload of one sweep run — carried by the repeatable job. */
export interface GmailPollPayload {
	mode: GmailPollMode;
}

/** Injectable history-sync enqueue seam (defaults to `gmail-catch-up`). */
export interface PollSweepJobs {
	enqueueHistorySync: (payload: GmailHistorySyncPayload) => Promise<void>;
}

let defaultPollJobsPromise: Promise<PollSweepJobs> | undefined;

const getDefaultPollJobs = (): Promise<PollSweepJobs> => {
	defaultPollJobsPromise ??= (async () => {
		const { defineJob } = await import("../services/jobify.ts");
		const catchUp =
			defineJob(GMAIL_CATCH_UP_QUEUE).input<GmailHistorySyncPayload>();
		return {
			enqueueHistorySync: async (payload) => {
				// No jobId on purpose — see the module docblock's enqueue policy.
				await catchUp.add(GMAIL_CATCH_UP_QUEUE, payload);
			},
		};
	})();
	return defaultPollJobsPromise;
};

/** Injectable watch-setup enqueue seam (defaults to `gmail-watch-setup`). */
export interface WatchRenewalJobs {
	enqueueWatchSetup: (payload: ConnectJobPayload) => Promise<void>;
}

let defaultRenewalJobsPromise: Promise<WatchRenewalJobs> | undefined;

const getDefaultRenewalJobs = (): Promise<WatchRenewalJobs> => {
	defaultRenewalJobsPromise ??= (async () => {
		const { defineJob } = await import("../services/jobify.ts");
		const { GMAIL_WATCH_SETUP_JOB_OPTIONS } = await import("./gmail_watch.ts");
		const watchSetup = defineJob(
			GMAIL_WATCH_SETUP_QUEUE,
		).input<ConnectJobPayload>();
		return {
			enqueueWatchSetup: async (payload) => {
				// Renewal failures must degrade (not silently drop), so the
				// retry/backoff options ride along exactly like the connect flow.
				await watchSetup.add(
					GMAIL_WATCH_SETUP_QUEUE,
					payload,
					GMAIL_WATCH_SETUP_JOB_OPTIONS,
				);
			},
		};
	})();
	return defaultRenewalJobsPromise;
};

export interface GmailPollDeps {
	/** Injectable db (defaults to the app db, resolved lazily). */
	db?: Db;
	/** Injectable enqueue seam (defaults to the BullMQ catch-up queue). */
	jobs?: PollSweepJobs;
	/** Injectable feature flag (defaults to `config.GMAIL_INGESTION_ENABLED`). */
	ingestionEnabled?: boolean;
}

export type GmailPollOutcome =
	| { outcome: "swept"; mode: GmailPollMode; accountsEnqueued: number }
	| { outcome: "skipped"; reason: "ingestion_disabled" };

/** Sync states each sweep mode targets — `active` status is always required. */
const SWEEP_SYNC_STATES: Record<
	GmailPollMode,
	(typeof connectedAccount.$inferSelect)["syncState"][]
> = {
	poll: ["polling", "degraded"],
	repair: ["watching"],
};

/**
 * One poll/repair sweep: select the mode's ACTIVE accounts and enqueue a
 * history sync for each. Every account is attempted even when some enqueues
 * fail; failures are then rethrown (as an AggregateError) so the sweep run
 * is marked failed — the next repeat tick fires regardless.
 */
export const runGmailPoll = async (
	payload: GmailPollPayload,
	deps: GmailPollDeps = {},
): Promise<GmailPollOutcome> => {
	const ingestionEnabled =
		deps.ingestionEnabled ?? (await getDefaultIngestionEnabled());
	if (!ingestionEnabled) {
		return { outcome: "skipped", reason: "ingestion_disabled" };
	}

	const db = deps.db ?? (await getDb());
	const rows = await db
		.select({ id: connectedAccount.id })
		.from(connectedAccount)
		.where(
			and(
				// Disconnected is the authoritative kill switch — never sweep it.
				eq(connectedAccount.status, "active"),
				inArray(connectedAccount.syncState, SWEEP_SYNC_STATES[payload.mode]),
			),
		);

	const jobs = deps.jobs ?? (await getDefaultPollJobs());
	const settled = await Promise.allSettled(
		rows.map((row) => jobs.enqueueHistorySync({ connectedAccountId: row.id })),
	);
	const failures = settled.flatMap((outcome) =>
		outcome.status === "rejected" ? [outcome.reason] : [],
	);
	if (failures.length > 0) {
		throw new AggregateError(
			failures,
			`gmail ${payload.mode} sweep failed to enqueue ${failures.length}/${rows.length} history syncs`,
		);
	}

	return {
		outcome: "swept",
		mode: payload.mode,
		accountsEnqueued: rows.length,
	};
};

export interface GmailWatchRenewalDeps {
	/** Injectable db (defaults to the app db, resolved lazily). */
	db?: Db;
	/** Injectable enqueue seam (defaults to the BullMQ watch-setup queue). */
	jobs?: WatchRenewalJobs;
	/** Injectable feature flag (defaults to `config.GMAIL_INGESTION_ENABLED`). */
	ingestionEnabled?: boolean;
	/** Injectable clock (defaults to `new Date()`). */
	now?: Date;
}

export type GmailWatchRenewalOutcome =
	| { outcome: "swept"; accountsEnqueued: number }
	| { outcome: "skipped"; reason: "ingestion_disabled" };

/**
 * One watch-renewal sweep: re-enqueue `gmail-watch-setup` for every ACTIVE
 * `watching` account whose watch expires within the renewal window. The
 * watch-setup job owns success/degrade/polling transitions (task-10
 * semantics); this sweep only decides WHO needs a renewal attempt.
 */
export const runGmailWatchRenewal = async (
	deps: GmailWatchRenewalDeps = {},
): Promise<GmailWatchRenewalOutcome> => {
	const ingestionEnabled =
		deps.ingestionEnabled ?? (await getDefaultIngestionEnabled());
	if (!ingestionEnabled) {
		return { outcome: "skipped", reason: "ingestion_disabled" };
	}

	const now = deps.now ?? new Date();
	const cutoff = new Date(
		now.getTime() + GMAIL_WATCH_RENEWAL_WINDOW_HOURS * 3_600_000,
	);

	const db = deps.db ?? (await getDb());
	const rows = await db
		.select({ id: connectedAccount.id })
		.from(connectedAccount)
		.where(
			and(
				eq(connectedAccount.status, "active"),
				eq(connectedAccount.syncState, "watching"),
				isNotNull(connectedAccount.watchExpiration),
				lte(connectedAccount.watchExpiration, cutoff),
			),
		);

	const jobs = deps.jobs ?? (await getDefaultRenewalJobs());
	const settled = await Promise.allSettled(
		rows.map((row) => jobs.enqueueWatchSetup({ connectedAccountId: row.id })),
	);
	const failures = settled.flatMap((outcome) =>
		outcome.status === "rejected" ? [outcome.reason] : [],
	);
	if (failures.length > 0) {
		throw new AggregateError(
			failures,
			`gmail watch-renewal sweep failed to enqueue ${failures.length}/${rows.length} watch setups`,
		);
	}

	return { outcome: "swept", accountsEnqueued: rows.length };
};

type GmailPollJob = JobifyJob<GmailPollPayload>;

let registeredPollJobPromise: Promise<GmailPollJob> | undefined;

/**
 * Register the BullMQ worker for the poll/repair sweep queue. Lazy and
 * idempotent: `defineJob` opens Redis connections, so this must only be
 * called from boot wiring (`jobs/scheduler.ts`), never at import time.
 */
export const registerGmailPollWorker = (): Promise<GmailPollJob> => {
	registeredPollJobPromise ??= (async () => {
		const { defineJob } = await import("../services/jobify.ts");
		return defineJob(GMAIL_POLL_QUEUE)
			.input<GmailPollPayload>()
			.options({ concurrency: 1 })
			.action(async (job) => runGmailPoll(job.data));
	})();
	return registeredPollJobPromise;
};

type GmailWatchRenewalJob = JobifyJob<undefined>;

let registeredRenewalJobPromise: Promise<GmailWatchRenewalJob> | undefined;

/**
 * Register the BullMQ worker for the watch-renewal sweep queue. Lazy and
 * idempotent, same as {@link registerGmailPollWorker}.
 */
export const registerGmailWatchRenewalWorker =
	(): Promise<GmailWatchRenewalJob> => {
		registeredRenewalJobPromise ??= (async () => {
			const { defineJob } = await import("../services/jobify.ts");
			return defineJob(GMAIL_WATCH_RENEWAL_QUEUE)
				.input<undefined>()
				.options({ concurrency: 1 })
				.action(async () => runGmailWatchRenewal());
		})();
		return registeredRenewalJobPromise;
	};
