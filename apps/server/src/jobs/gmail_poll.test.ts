import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "../db/schema.ts";
import type { ConnectJobPayload } from "../services/ingestion/connect.ts";
import type { GmailHistorySyncPayload } from "./gmail_history_sync.ts";
import {
	GMAIL_WATCH_RENEWAL_WINDOW_HOURS,
	type PollSweepJobs,
	runGmailPoll,
	runGmailWatchRenewal,
	type WatchRenewalJobs,
} from "./gmail_poll.ts";
import {
	buildGmailSchedule,
	GMAIL_POLL_REPEAT_KEY,
	GMAIL_REPAIR_REPEAT_KEY,
	GMAIL_REPAIR_SWEEP_INTERVAL_MS,
	GMAIL_WATCH_RENEWAL_REPEAT_KEY,
	type GmailScheduleRequest,
	startGmailIngestionScheduler,
} from "./scheduler.ts";

const MIGRATIONS_FOLDER = join(import.meta.dir, "../../drizzle");

const USER_ID = "user-1";
const AUTH_ACCOUNT_ID = "auth-acc-1";

const NOW = new Date("2026-06-12T12:00:00.000Z");
const HOUR_MS = 3_600_000;

/**
 * Real libsql db (temp file) with the actual migrations applied — same
 * harness as `jobs/gmail_watch.test.ts`.
 */
const TEST_DB_DIR = mkdtempSync(join(tmpdir(), "atlas-gmail-poll-test-"));
let dbCounter = 0;

afterAll(() => {
	rmSync(TEST_DB_DIR, { recursive: true, force: true });
});

const makeDb = async () => {
	dbCounter += 1;
	const db = drizzle({
		connection: { url: `file:${join(TEST_DB_DIR, `db-${dbCounter}.sqlite`)}` },
		schema,
		casing: "snake_case",
	});
	await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

	await db.insert(schema.user).values({
		id: USER_ID,
		name: "Alice",
		email: "alice@example.com",
	});
	await db.insert(schema.account).values({
		id: AUTH_ACCOUNT_ID,
		accountId: "google-sub-1",
		providerId: "google",
		userId: USER_ID,
	});

	return db;
};

type TestDb = Awaited<ReturnType<typeof makeDb>>;

let accountCounter = 0;

const insertAccount = async (
	db: TestDb,
	overrides: Partial<typeof schema.connectedAccount.$inferInsert> = {},
): Promise<string> => {
	accountCounter += 1;
	const id = overrides.id ?? `ca-${accountCounter}`;
	await db.insert(schema.connectedAccount).values({
		id,
		userId: USER_ID,
		authAccountId: AUTH_ACCOUNT_ID,
		provider: "gmail",
		emailAddress: `mailbox-${accountCounter}@gmail.com`,
		status: "active",
		syncState: "pending",
		checkpointHistoryId: "100",
		checkpointAt: NOW,
		...overrides,
	});
	return id;
};

const makePollJobs = () => {
	const enqueued: string[] = [];
	const jobs: PollSweepJobs = {
		enqueueHistorySync: async (payload: GmailHistorySyncPayload) => {
			enqueued.push(payload.connectedAccountId);
		},
	};
	return { jobs, enqueued };
};

const makeRenewalJobs = () => {
	const enqueued: string[] = [];
	const jobs: WatchRenewalJobs = {
		enqueueWatchSetup: async (payload: ConnectJobPayload) => {
			enqueued.push(payload.connectedAccountId);
		},
	};
	return { jobs, enqueued };
};

describe("runGmailPoll", () => {
	let db: TestDb;

	beforeEach(async () => {
		db = await makeDb();
	});

	it("poll mode enqueues history syncs for polling AND degraded accounts at the tight interval", async () => {
		const pollingId = await insertAccount(db, { syncState: "polling" });
		const degradedId = await insertAccount(db, { syncState: "degraded" });
		await insertAccount(db, { syncState: "watching" });
		await insertAccount(db, { syncState: "pending" });
		const { jobs, enqueued } = makePollJobs();

		const result = await runGmailPoll(
			{ mode: "poll" },
			{ db, jobs, ingestionEnabled: true },
		);

		expect(result).toEqual({
			outcome: "swept",
			mode: "poll",
			accountsEnqueued: 2,
		});
		expect(enqueued.sort()).toEqual([degradedId, pollingId].sort());
	});

	it("repair mode sweeps only watching accounts (slow safety net)", async () => {
		await insertAccount(db, { syncState: "polling" });
		await insertAccount(db, { syncState: "degraded" });
		await insertAccount(db, { syncState: "pending" });
		const watchingId = await insertAccount(db, { syncState: "watching" });
		const { jobs, enqueued } = makePollJobs();

		const result = await runGmailPoll(
			{ mode: "repair" },
			{ db, jobs, ingestionEnabled: true },
		);

		expect(result).toEqual({
			outcome: "swept",
			mode: "repair",
			accountsEnqueued: 1,
		});
		expect(enqueued).toEqual([watchingId]);
	});

	it("never schedules disconnected accounts in either mode", async () => {
		await insertAccount(db, {
			status: "disconnected",
			syncState: "polling",
			disconnectedAt: NOW,
		});
		await insertAccount(db, {
			status: "disconnected",
			syncState: "degraded",
			disconnectedAt: NOW,
		});
		await insertAccount(db, {
			status: "disconnected",
			syncState: "watching",
			disconnectedAt: NOW,
		});
		const { jobs, enqueued } = makePollJobs();

		const poll = await runGmailPoll(
			{ mode: "poll" },
			{ db, jobs, ingestionEnabled: true },
		);
		const repair = await runGmailPoll(
			{ mode: "repair" },
			{ db, jobs, ingestionEnabled: true },
		);

		expect(poll).toEqual({
			outcome: "swept",
			mode: "poll",
			accountsEnqueued: 0,
		});
		expect(repair).toEqual({
			outcome: "swept",
			mode: "repair",
			accountsEnqueued: 0,
		});
		expect(enqueued).toEqual([]);
	});

	it("skips entirely when GMAIL_INGESTION_ENABLED is off", async () => {
		await insertAccount(db, { syncState: "polling" });
		const jobs: PollSweepJobs = {
			enqueueHistorySync: async () => {
				throw new Error("must not enqueue when ingestion is disabled");
			},
		};

		const result = await runGmailPoll(
			{ mode: "poll" },
			{ db, jobs, ingestionEnabled: false },
		);

		expect(result).toEqual({
			outcome: "skipped",
			reason: "ingestion_disabled",
		});
	});

	it("attempts every account even when one enqueue fails, then surfaces the failure", async () => {
		const a = await insertAccount(db, { syncState: "polling" });
		const b = await insertAccount(db, { syncState: "degraded" });
		const attempted: string[] = [];
		const jobs: PollSweepJobs = {
			enqueueHistorySync: async (payload) => {
				attempted.push(payload.connectedAccountId);
				if (payload.connectedAccountId === a) {
					throw new Error("redis hiccup");
				}
			},
		};

		await expect(
			runGmailPoll({ mode: "poll" }, { db, jobs, ingestionEnabled: true }),
		).rejects.toBeInstanceOf(AggregateError);

		expect(attempted.sort()).toEqual([a, b].sort());
	});
});

describe("runGmailWatchRenewal", () => {
	let db: TestDb;

	beforeEach(async () => {
		db = await makeDb();
	});

	const withinWindow = new Date(
		NOW.getTime() + (GMAIL_WATCH_RENEWAL_WINDOW_HOURS - 1) * HOUR_MS,
	);
	const beyondWindow = new Date(
		NOW.getTime() + (GMAIL_WATCH_RENEWAL_WINDOW_HOURS + 24) * HOUR_MS,
	);

	it("re-enqueues watch setup for watching accounts expiring within the 48h window", async () => {
		const expiringId = await insertAccount(db, {
			syncState: "watching",
			watchExpiration: withinWindow,
		});
		const alreadyExpiredId = await insertAccount(db, {
			syncState: "watching",
			watchExpiration: new Date(NOW.getTime() - HOUR_MS),
		});
		await insertAccount(db, {
			syncState: "watching",
			watchExpiration: beyondWindow,
		});
		const { jobs, enqueued } = makeRenewalJobs();

		const result = await runGmailWatchRenewal({
			db,
			jobs,
			ingestionEnabled: true,
			now: NOW,
		});

		expect(result).toEqual({ outcome: "swept", accountsEnqueued: 2 });
		expect(enqueued.sort()).toEqual([alreadyExpiredId, expiringId].sort());
	});

	it("ignores non-watching accounts and watching accounts without an expiration", async () => {
		await insertAccount(db, { syncState: "polling" });
		await insertAccount(db, { syncState: "degraded" });
		await insertAccount(db, { syncState: "pending" });
		await insertAccount(db, { syncState: "watching", watchExpiration: null });
		const { jobs, enqueued } = makeRenewalJobs();

		const result = await runGmailWatchRenewal({
			db,
			jobs,
			ingestionEnabled: true,
			now: NOW,
		});

		expect(result).toEqual({ outcome: "swept", accountsEnqueued: 0 });
		expect(enqueued).toEqual([]);
	});

	it("never renews disconnected accounts, even with an imminent expiration", async () => {
		await insertAccount(db, {
			status: "disconnected",
			syncState: "watching",
			watchExpiration: withinWindow,
			disconnectedAt: NOW,
		});
		const { jobs, enqueued } = makeRenewalJobs();

		const result = await runGmailWatchRenewal({
			db,
			jobs,
			ingestionEnabled: true,
			now: NOW,
		});

		expect(result).toEqual({ outcome: "swept", accountsEnqueued: 0 });
		expect(enqueued).toEqual([]);
	});

	it("skips entirely when GMAIL_INGESTION_ENABLED is off", async () => {
		await insertAccount(db, {
			syncState: "watching",
			watchExpiration: withinWindow,
		});
		const jobs: WatchRenewalJobs = {
			enqueueWatchSetup: async () => {
				throw new Error("must not enqueue when ingestion is disabled");
			},
		};

		const result = await runGmailWatchRenewal({
			db,
			jobs,
			ingestionEnabled: false,
			now: NOW,
		});

		expect(result).toEqual({
			outcome: "skipped",
			reason: "ingestion_disabled",
		});
	});
});

describe("startGmailIngestionScheduler", () => {
	const CONFIG = {
		ingestionEnabled: true,
		pollIntervalSeconds: 120,
		watchRenewalHours: 24,
	};

	it("schedules nothing — no workers, no repeatables — when the flag is off", async () => {
		const calls: string[] = [];

		const result = await startGmailIngestionScheduler({
			config: { ...CONFIG, ingestionEnabled: false },
			registerWorkers: async () => {
				calls.push("registerWorkers");
			},
			schedule: async () => {
				calls.push("schedule");
			},
		});

		expect(result).toEqual({ started: false, reason: "ingestion_disabled" });
		expect(calls).toEqual([]);
	});

	it("registers workers first, then installs all three sweeps with the configured intervals", async () => {
		const calls: string[] = [];
		const scheduled: GmailScheduleRequest[] = [];

		const result = await startGmailIngestionScheduler({
			config: CONFIG,
			registerWorkers: async () => {
				calls.push("registerWorkers");
			},
			schedule: async (request) => {
				calls.push(`schedule:${request.repeatKey}`);
				scheduled.push(request);
			},
		});

		expect(result.started).toBe(true);
		expect(calls[0]).toBe("registerWorkers");
		expect(scheduled).toHaveLength(3);

		const byKey = new Map(scheduled.map((req) => [req.repeatKey, req]));
		expect(byKey.get(GMAIL_WATCH_RENEWAL_REPEAT_KEY)).toMatchObject({
			everyMs: 24 * HOUR_MS,
		});
		expect(byKey.get(GMAIL_POLL_REPEAT_KEY)).toMatchObject({
			everyMs: 120_000,
			payload: { mode: "poll" },
		});
		expect(byKey.get(GMAIL_REPAIR_REPEAT_KEY)).toMatchObject({
			everyMs: GMAIL_REPAIR_SWEEP_INTERVAL_MS,
			payload: { mode: "repair" },
		});
	});

	it("polls degraded/polling accounts on a tighter interval than the watching repair sweep", () => {
		const schedules = buildGmailSchedule(CONFIG);
		const poll = schedules.find((s) => s.repeatKey === GMAIL_POLL_REPEAT_KEY);
		const repair = schedules.find(
			(s) => s.repeatKey === GMAIL_REPAIR_REPEAT_KEY,
		);

		expect(poll).toBeDefined();
		expect(repair).toBeDefined();
		// The poll sweep is the only delivery path for degraded/polling
		// accounts — it must run far more often than the watching safety net.
		expect(poll?.everyMs).toBeLessThan(repair?.everyMs ?? 0);
	});
});
