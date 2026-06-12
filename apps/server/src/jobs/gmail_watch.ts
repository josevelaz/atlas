import type { Job as JobifyJob } from "jobify";
import type { JobsOptions } from "jobify/bullmq";

import { eq } from "drizzle-orm";

import { connectedAccount } from "../db/schema.ts";
import { createGmailClient, GmailApiError } from "../services/gmail/client.ts";
import {
	type ConnectJobPayload,
	GMAIL_WATCH_SETUP_QUEUE,
} from "../services/ingestion/connect.ts";

/**
 * Gmail watch-setup job (`gmail-watch-setup` queue, enqueued by
 * `services/ingestion/connect.ts` right after the connection checkpoint
 * commits).
 *
 * Calls `users.watch` with the configured Pub/Sub topic so the mailbox gets
 * near-real-time push notifications.
 *
 * State machine (account `status` stays `active` THROUGHOUT — watch setup
 * failing must NEVER disconnect an account):
 *
 *   - success            → sync_state `watching`, `watch_expiration` set,
 *                          `watch_failure_count` reset to 0.
 *   - push env unset     → sync_state `polling` (expected local-dev mode, not
 *                          a failure — `watch_failure_count` untouched).
 *   - retryable failure  → sync_state `degraded`, `watch_failure_count`
 *     (retries remain)     incremented, error re-thrown so BullMQ schedules
 *                          the next attempt with exponential backoff.
 *   - retryable failure  → sync_state `polling` (final fallback),
 *     (retries exhausted)  `watch_failure_count` incremented, error swallowed.
 *   - non-retryable      → sync_state `polling` immediately (retrying a 4xx /
 *     failure              auth error is futile), `watch_failure_count`
 *                          incremented, error swallowed.
 *
 * Retry mechanics: BullMQ retry policy is fixed at ENQUEUE time, so
 * {@link GMAIL_WATCH_SETUP_JOB_OPTIONS} is exported for the enqueue site
 * (`connect.ts`) to spread into `queue.add`. The processor decides
 * degraded-vs-final-fallback from the job's `attemptsMade` / `opts.attempts`.
 *
 * Testability: no db/config/redis work at import time. The default db, push
 * config, and Gmail client are resolved lazily; tests inject all three.
 */

/** Max delivery attempts (1 initial + 4 backed-off retries). */
export const GMAIL_WATCH_SETUP_ATTEMPTS = 5;

/** Base delay for BullMQ exponential backoff: 30s, 60s, 120s, 240s. */
export const GMAIL_WATCH_SETUP_BACKOFF_DELAY_MS = 30_000;

/**
 * BullMQ job options the ENQUEUE site must pass to `queue.add` — retry
 * policy lives on the job, not the worker.
 */
export const GMAIL_WATCH_SETUP_JOB_OPTIONS = {
	attempts: GMAIL_WATCH_SETUP_ATTEMPTS,
	backoff: {
		type: "exponential",
		delay: GMAIL_WATCH_SETUP_BACKOFF_DELAY_MS,
	},
} as const satisfies JobsOptions;

type Db = typeof import("../db/index.ts")["db"];

let defaultDb: Db | undefined;

const getDb = async (): Promise<Db> => {
	if (!defaultDb) {
		({ db: defaultDb } = await import("../db/index.ts"));
	}
	return defaultDb;
};

/** Minimal Gmail client surface this job needs. */
export type WatchGmailClient = {
	watch: (params: {
		topicName: string;
	}) => Promise<{ historyId: string; expiration: string }>;
};

/** Push configuration, resolved lazily from `config.ts` unless injected. */
export interface GmailPushConfig {
	/** True only when every Pub/Sub push env var is present. */
	pushEnabled: boolean;
	/** Fully-qualified topic: `projects/<p>/topics/<t>`. */
	topicName?: string;
}

const getDefaultPushConfig = async (): Promise<GmailPushConfig> => {
	const { config } = await import("../config.ts");
	return {
		pushEnabled: config.GMAIL_PUSH_ENABLED,
		topicName: config.GMAIL_PUBSUB_TOPIC,
	};
};

/** Where this execution sits in the BullMQ retry schedule. */
export interface GmailWatchSetupAttempt {
	/** 1-based attempt number (`job.attemptsMade + 1`). */
	attemptNumber: number;
	/** Total attempts configured on the job (`job.opts.attempts ?? 1`). */
	maxAttempts: number;
}

export interface GmailWatchSetupDeps {
	/** Injectable db (defaults to the app db, resolved lazily). */
	db?: Db;
	/** Injectable Gmail client (defaults to `createGmailClient(authAccountId)`). */
	gmail?: WatchGmailClient;
	/** Injectable push config (defaults to `config.ts`, resolved lazily). */
	push?: GmailPushConfig;
}

export type GmailWatchSetupOutcome =
	| { outcome: "watching"; watchExpiration: Date }
	| {
			outcome: "polling";
			reason: "push_disabled" | "retries_exhausted" | "non_retryable_error";
	  }
	| { outcome: "skipped"; reason: "account_missing" | "account_disconnected" };

/** Errors without an explicit contract (network, bugs) are presumed transient. */
const isRetryableWatchError = (error: unknown): boolean =>
	error instanceof GmailApiError ? error.retryable : true;

/**
 * Core watch-setup logic — pure of BullMQ except for the {@link attempt}
 * descriptor. Throws ONLY when a BullMQ retry should be scheduled (retryable
 * failure with attempts remaining); every other path resolves.
 */
export const runGmailWatchSetup = async (
	payload: ConnectJobPayload,
	attempt: GmailWatchSetupAttempt,
	deps: GmailWatchSetupDeps = {},
): Promise<GmailWatchSetupOutcome> => {
	const db = deps.db ?? (await getDb());

	const rows = await db
		.select({
			id: connectedAccount.id,
			authAccountId: connectedAccount.authAccountId,
			status: connectedAccount.status,
			watchFailureCount: connectedAccount.watchFailureCount,
		})
		.from(connectedAccount)
		.where(eq(connectedAccount.id, payload.connectedAccountId))
		.limit(1);

	const row = rows[0];
	if (!row) {
		return { outcome: "skipped", reason: "account_missing" };
	}
	if (row.status === "disconnected") {
		return { outcome: "skipped", reason: "account_disconnected" };
	}

	const push = deps.push ?? (await getDefaultPushConfig());
	if (!push.pushEnabled || !push.topicName) {
		// Expected polling-only mode (e.g. local dev) — not a failure.
		await db
			.update(connectedAccount)
			.set({ syncState: "polling" })
			.where(eq(connectedAccount.id, row.id));
		return { outcome: "polling", reason: "push_disabled" };
	}

	const gmail = deps.gmail ?? createGmailClient(row.authAccountId);

	try {
		const response = await gmail.watch({ topicName: push.topicName });
		const watchExpiration = new Date(Number(response.expiration));
		await db
			.update(connectedAccount)
			.set({
				syncState: "watching",
				watchExpiration,
				watchFailureCount: 0,
			})
			.where(eq(connectedAccount.id, row.id));
		return { outcome: "watching", watchExpiration };
	} catch (error) {
		const watchFailureCount = row.watchFailureCount + 1;
		const retryScheduled =
			isRetryableWatchError(error) &&
			attempt.attemptNumber < attempt.maxAttempts;

		if (retryScheduled) {
			// Degraded: a backed-off retry is coming; account stays active.
			await db
				.update(connectedAccount)
				.set({ syncState: "degraded", watchFailureCount })
				.where(eq(connectedAccount.id, row.id));
			throw error;
		}

		// Final fallback: give up on push for now and rely on polling.
		// The account is NEVER disconnected because watch setup failed.
		await db
			.update(connectedAccount)
			.set({ syncState: "polling", watchFailureCount })
			.where(eq(connectedAccount.id, row.id));
		return {
			outcome: "polling",
			reason: isRetryableWatchError(error)
				? "retries_exhausted"
				: "non_retryable_error",
		};
	}
};

type GmailWatchSetupJob = JobifyJob<ConnectJobPayload>;

let registeredJobPromise: Promise<GmailWatchSetupJob> | undefined;

/**
 * Register the BullMQ worker for the watch-setup queue. Lazy and idempotent:
 * `defineJob` opens Redis connections, so this must only be called from boot
 * wiring (scheduler task), never at import time.
 */
export const registerGmailWatchSetupWorker =
	(): Promise<GmailWatchSetupJob> => {
		registeredJobPromise ??= (async () => {
			const { defineJob } = await import("../services/jobify.ts");
			return defineJob(GMAIL_WATCH_SETUP_QUEUE)
				.input<ConnectJobPayload>()
				.options({ concurrency: 5 })
				.action(async (job) =>
					runGmailWatchSetup(job.data, {
						attemptNumber: job.attemptsMade + 1,
						// No attempts on the job ⇒ this is the only attempt; the
						// processor then falls back to polling instead of degraded.
						maxAttempts: job.opts.attempts ?? 1,
					}),
				);
		})();
		return registeredJobPromise;
	};
