import type { Job as JobifyJob } from "jobify";

import { eq } from "drizzle-orm";

import { connectedAccount, syncGap } from "../db/schema.ts";
import {
	createGmailClient,
	type GmailHistoryPage,
	type GmailMessage,
	type GmailProfile,
	HistoryGapError,
} from "../services/gmail/client.ts";
import { GMAIL_CATCH_UP_QUEUE } from "../services/ingestion/connect.ts";
import {
	type IngestAccount,
	type IngestMessageResult,
	ingestMessages,
} from "../services/ingestion/ingest.ts";

/**
 * Gmail history sync job (`gmail-catch-up` queue).
 *
 * Catch-up and incremental sync are the SAME code path: the post-connect
 * "immediate catch-up" enqueued by `services/ingestion/connect.ts`, push
 * notifications, and the polling scheduler all enqueue this one job keyed by
 * `connected_account.id` — it always syncs from wherever the cursor is.
 *
 * Cursor model (forward-only, per ADR 0011):
 *   - Read cursor = `last_synced_history_id ?? checkpoint_history_id`.
 *   - Page through `users.history.list` (`messageAdded` events only), fetch
 *     metadata for the new message ids, run the idempotent ingest, and
 *     advance `last_synced_history_id` per page — so a crash between pages
 *     resumes from the last committed page, and re-ingesting the boundary
 *     page is a no-op (ingest is idempotent on provider_message_id).
 *   - On {@link HistoryGapError} (stored historyId expired): record a
 *     `sync_gap` row, reset BOTH the cursor and the checkpoint forward to
 *     the current `getProfile().historyId`, and finish. Mail that fell into
 *     the gap is NEVER backfilled.
 *
 * Concurrency: a Verrou lock (`gmail-history-sync:<connectedAccountId>`)
 * guarantees one sync per account. A second job arriving while a sync runs
 * skips immediately (`already_running`) — the running sync already consumes
 * everything up to the current historyId, and the next enqueue re-checks.
 *
 * Kill switches: the job no-ops silently when `GMAIL_INGESTION_ENABLED` is
 * off or the account's status is `disconnected` (the authoritative kill
 * switch from the disconnect flow).
 *
 * Testability: no db/config/redis work at import time — db, Gmail client,
 * ingest, locks, and the feature flag are all injectable and resolved
 * lazily otherwise.
 */

/** Verrou lock key for one account's sync. */
export const gmailHistorySyncLockKey = (connectedAccountId: string): string =>
	`gmail-history-sync:${connectedAccountId}`;

/**
 * Lock TTL — an upper bound on one sync run; the lock auto-expires if the
 * process dies mid-sync so the account is never wedged.
 */
export const GMAIL_HISTORY_SYNC_LOCK_TTL = "10m";

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

/** Minimal Gmail client surface this job needs. */
export type HistorySyncGmailClient = {
	getProfile: () => Promise<GmailProfile>;
	historyPages: (params: {
		startHistoryId: string;
		maxResults?: number;
	}) => AsyncIterable<GmailHistoryPage>;
	getMessageMetadata: (ids: readonly string[]) => Promise<GmailMessage[]>;
};

/** Minimal Verrou surface (`verrou.createLock(...).runImmediately(...)`). */
export type HistorySyncLockProvider = {
	createLock: (
		name: string,
		ttl?: string | number,
	) => {
		runImmediately: <T>(
			callback: () => Promise<T>,
		) => Promise<[true, T] | [false, null]>;
	};
};

const getDefaultLocks = async (): Promise<HistorySyncLockProvider> => {
	const { verrou } = await import("../services/locks.ts");
	return verrou;
};

export interface GmailHistorySyncDeps {
	/** Injectable db (defaults to the app db, resolved lazily). */
	db?: Db;
	/** Injectable Gmail client (defaults to `createGmailClient(authAccountId)`). */
	gmail?: HistorySyncGmailClient;
	/** Injectable ingest (defaults to `ingestMessages` against the same db). */
	ingest?: (
		account: IngestAccount,
		messages: GmailMessage[],
	) => Promise<IngestMessageResult[]>;
	/** Injectable lock provider (defaults to the shared Verrou instance). */
	locks?: HistorySyncLockProvider;
	/** Injectable feature flag (defaults to `config.GMAIL_INGESTION_ENABLED`). */
	ingestionEnabled?: boolean;
}

export type GmailHistorySyncOutcome =
	| {
			outcome: "synced";
			pages: number;
			messagesIngested: number;
			cursor: string;
	  }
	| {
			/** History gap: cursor + checkpoint reset forward, gap recorded. */
			outcome: "gap_reset";
			fromHistoryId: string;
			resetToHistoryId: string;
			/** Messages ingested from pages consumed before the gap surfaced. */
			messagesIngested: number;
	  }
	| {
			outcome: "skipped";
			reason:
				| "ingestion_disabled"
				| "already_running"
				| "account_missing"
				| "account_disconnected"
				| "no_cursor";
	  };

/** Payload — this job is keyed by connected account id. */
export interface GmailHistorySyncPayload {
	connectedAccountId: string;
}

/**
 * Forward-only gap recovery: record the gap, then reset BOTH
 * `last_synced_history_id` and `checkpoint_history_id` to the mailbox's
 * current historyId in one transaction. No backfill — sync resumes from
 * "now" on the next run.
 */
const resetForwardOnGap = async (
	db: Db,
	gmail: HistorySyncGmailClient,
	connectedAccountId: string,
	fromHistoryId: string,
	messagesIngested: number,
): Promise<GmailHistorySyncOutcome> => {
	const profile = await gmail.getProfile();
	const resetToHistoryId = String(profile.historyId);
	const now = new Date();

	await db.transaction(async (tx) => {
		await tx.insert(syncGap).values({
			connectedAccountId,
			fromHistoryId,
			resetToHistoryId,
			reason: "history_gap",
		});
		await tx
			.update(connectedAccount)
			.set({
				lastSyncedHistoryId: resetToHistoryId,
				lastSyncedAt: now,
				checkpointHistoryId: resetToHistoryId,
				checkpointAt: now,
			})
			.where(eq(connectedAccount.id, connectedAccountId));
	});

	return {
		outcome: "gap_reset",
		fromHistoryId,
		resetToHistoryId,
		messagesIngested,
	};
};

/** Unique `messageAdded` message ids of one history page, in event order. */
const pageMessageIds = (page: GmailHistoryPage): string[] => [
	...new Set(
		(page.history ?? []).flatMap((record) =>
			(record.messagesAdded ?? []).map((added) => added.message.id),
		),
	),
];

/** The sync body — runs with the account lock held. */
const syncAccount = async (
	payload: GmailHistorySyncPayload,
	deps: GmailHistorySyncDeps,
): Promise<GmailHistorySyncOutcome> => {
	const db = deps.db ?? (await getDb());

	const rows = await db
		.select({
			id: connectedAccount.id,
			userId: connectedAccount.userId,
			authAccountId: connectedAccount.authAccountId,
			status: connectedAccount.status,
			lastSyncedHistoryId: connectedAccount.lastSyncedHistoryId,
			checkpointHistoryId: connectedAccount.checkpointHistoryId,
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

	// Catch-up and incremental share this read: a first sync starts from the
	// connect-time checkpoint, every later sync from its own high-water mark.
	const startCursor = row.lastSyncedHistoryId ?? row.checkpointHistoryId;
	if (!startCursor) {
		// Anomalous — connect always persists a checkpoint. Never invent a
		// cursor here; skipping keeps forward-only semantics intact.
		return { outcome: "skipped", reason: "no_cursor" };
	}

	const gmail = deps.gmail ?? createGmailClient(row.authAccountId);
	const ingest =
		deps.ingest ??
		((account: IngestAccount, messages: GmailMessage[]) =>
			ingestMessages(account, messages, { db }));
	const account: IngestAccount = { id: row.id, userId: row.userId };

	let cursor = startCursor;
	let pages = 0;
	let messagesIngested = 0;

	try {
		for await (const page of gmail.historyPages({ startHistoryId: cursor })) {
			pages += 1;

			const ids = pageMessageIds(page);
			if (ids.length > 0) {
				const messages = await gmail.getMessageMetadata(ids);
				const results = await ingest(account, messages);
				messagesIngested += results.filter(
					(result) =>
						result.outcome === "ingested_new_thread" ||
						result.outcome === "ingested_into_existing_thread",
				).length;
			}

			// Advance the cursor only after this page's ingest committed. The
			// last history record id is the per-page high-water mark; the final
			// page additionally carries the mailbox's current historyId.
			const lastRecordId = (page.history ?? []).at(-1)?.id;
			const nextCursor = page.nextPageToken
				? (lastRecordId ?? cursor)
				: (page.historyId ?? lastRecordId ?? cursor);
			await db
				.update(connectedAccount)
				.set({ lastSyncedHistoryId: nextCursor, lastSyncedAt: new Date() })
				.where(eq(connectedAccount.id, row.id));
			cursor = nextCursor;
		}
	} catch (error) {
		if (!(error instanceof HistoryGapError)) {
			// Transient/etc. errors propagate: pages already committed stay
			// committed, and the retry resumes from the advanced cursor.
			throw error;
		}
		return resetForwardOnGap(db, gmail, row.id, cursor, messagesIngested);
	}

	return { outcome: "synced", pages, messagesIngested, cursor };
};

/**
 * Core history-sync logic — pure of BullMQ. Resolves on every outcome except
 * non-gap errors mid-sync, which propagate (per-page cursor commits make the
 * retry resume without duplicates).
 */
export const runGmailHistorySync = async (
	payload: GmailHistorySyncPayload,
	deps: GmailHistorySyncDeps = {},
): Promise<GmailHistorySyncOutcome> => {
	const ingestionEnabled =
		deps.ingestionEnabled ?? (await getDefaultIngestionEnabled());
	if (!ingestionEnabled) {
		return { outcome: "skipped", reason: "ingestion_disabled" };
	}

	const locks = deps.locks ?? (await getDefaultLocks());
	const lock = locks.createLock(
		gmailHistorySyncLockKey(payload.connectedAccountId),
		GMAIL_HISTORY_SYNC_LOCK_TTL,
	);

	const [executed, result] = await lock.runImmediately(() =>
		syncAccount(payload, deps),
	);
	if (!executed) {
		// Another sync holds the lock — it is already consuming history up to
		// the current historyId, so this run has nothing left to do.
		return { outcome: "skipped", reason: "already_running" };
	}
	return result;
};

type GmailHistorySyncJob = JobifyJob<GmailHistorySyncPayload>;

let registeredJobPromise: Promise<GmailHistorySyncJob> | undefined;

/**
 * Register the BullMQ worker for the catch-up/incremental sync queue
 * (`gmail-catch-up` — the queue `connect.ts` enqueues post-connect). Lazy
 * and idempotent: `defineJob` opens Redis connections, so this must only be
 * called from boot wiring, never at import time.
 */
export const registerGmailHistorySyncWorker =
	(): Promise<GmailHistorySyncJob> => {
		registeredJobPromise ??= (async () => {
			const { defineJob } = await import("../services/jobify.ts");
			return defineJob(GMAIL_CATCH_UP_QUEUE)
				.input<GmailHistorySyncPayload>()
				.options({ concurrency: 5 })
				.action(async (job) => runGmailHistorySync(job.data));
		})();
		return registeredJobPromise;
	};
