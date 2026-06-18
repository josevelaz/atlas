import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "../db/schema.ts";
import {
	GmailAuthError,
	GmailRetryableError,
} from "../services/gmail/client.ts";
import {
	GMAIL_WATCH_SETUP_ATTEMPTS,
	GMAIL_WATCH_SETUP_JOB_OPTIONS,
	type GmailPushConfig,
	type GmailWatchSetupAttempt,
	runGmailWatchSetup,
	type WatchGmailClient,
} from "./gmail_watch.ts";

const MIGRATIONS_FOLDER = join(import.meta.dir, "../../drizzle");

const USER_ID = "user-1";
const AUTH_ACCOUNT_ID = "auth-acc-1";
const CONNECTED_ACCOUNT_ID = "ca-1";

const TOPIC = "projects/atlas-test/topics/gmail-push";

const PUSH_ENABLED: GmailPushConfig = {
	pushEnabled: true,
	topicName: TOPIC,
};

const FIRST_ATTEMPT: GmailWatchSetupAttempt = {
	attemptNumber: 1,
	maxAttempts: GMAIL_WATCH_SETUP_ATTEMPTS,
};

const FINAL_ATTEMPT: GmailWatchSetupAttempt = {
	attemptNumber: GMAIL_WATCH_SETUP_ATTEMPTS,
	maxAttempts: GMAIL_WATCH_SETUP_ATTEMPTS,
};

/**
 * Real libsql db (temp file) with the actual migrations applied — same
 * harness as `services/ingestion/connect.test.ts` (a file, not `:memory:`,
 * because the libsql client drops its connection between calls).
 */
const TEST_DB_DIR = mkdtempSync(join(tmpdir(), "atlas-gmail-watch-test-"));
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

const insertConnectedAccount = async (
	db: TestDb,
	overrides: Partial<typeof schema.connectedAccount.$inferInsert> = {},
) => {
	await db.insert(schema.connectedAccount).values({
		id: CONNECTED_ACCOUNT_ID,
		userId: USER_ID,
		authAccountId: AUTH_ACCOUNT_ID,
		provider: "gmail",
		emailAddress: "alice@gmail.com",
		status: "active",
		syncState: "pending",
		checkpointHistoryId: "987654",
		checkpointAt: new Date(),
		...overrides,
	});
};

const getRow = async (db: TestDb) => {
	const rows = await db
		.select()
		.from(schema.connectedAccount)
		.where(eq(schema.connectedAccount.id, CONNECTED_ACCOUNT_ID));
	const row = rows[0];
	if (!row) throw new Error("expected a connected_account row");
	return row;
};

const makeWatchStub = (
	impl: () => Promise<{ historyId: string; expiration: string }>,
) => {
	let calls = 0;
	const gmail: WatchGmailClient = {
		watch: (params) => {
			calls += 1;
			expect(params.topicName).toBe(TOPIC);
			return impl();
		},
	};
	return { gmail, watchCalls: () => calls };
};

describe("runGmailWatchSetup", () => {
	let db: TestDb;

	beforeEach(async () => {
		db = await makeDb();
		await insertConnectedAccount(db);
	});

	it("transitions to watching on success and stores the watch expiration", async () => {
		const expiration = Date.now() + 7 * 24 * 3600 * 1000;
		const { gmail } = makeWatchStub(() =>
			Promise.resolve({ historyId: "987700", expiration: String(expiration) }),
		);

		const result = await runGmailWatchSetup(
			{ connectedAccountId: CONNECTED_ACCOUNT_ID },
			FIRST_ATTEMPT,
			{ db, gmail, push: PUSH_ENABLED },
		);

		expect(result).toEqual({
			outcome: "watching",
			watchExpiration: new Date(expiration),
		});

		const row = await getRow(db);
		expect(row.status).toBe("active");
		expect(row.syncState).toBe("watching");
		expect(row.watchExpiration).toEqual(new Date(expiration));
		expect(row.watchFailureCount).toBe(0);
	});

	it("resets a previous failure count to 0 on success", async () => {
		await db
			.update(schema.connectedAccount)
			.set({ watchFailureCount: 3, syncState: "degraded" })
			.where(eq(schema.connectedAccount.id, CONNECTED_ACCOUNT_ID));
		const { gmail } = makeWatchStub(() =>
			Promise.resolve({ historyId: "987700", expiration: String(Date.now()) }),
		);

		await runGmailWatchSetup(
			{ connectedAccountId: CONNECTED_ACCOUNT_ID },
			{ attemptNumber: 4, maxAttempts: GMAIL_WATCH_SETUP_ATTEMPTS },
			{ db, gmail, push: PUSH_ENABLED },
		);

		const row = await getRow(db);
		expect(row.syncState).toBe("watching");
		expect(row.watchFailureCount).toBe(0);
	});

	it("leaves the account active in degraded state and schedules a retry on retryable failure", async () => {
		const failure = new GmailRetryableError("Gmail watch 503", 503);
		const { gmail } = makeWatchStub(() => Promise.reject(failure));

		// The rethrow IS the retry schedule: BullMQ retries a thrown job per
		// the attempts/backoff options the enqueue site attached.
		await expect(
			runGmailWatchSetup(
				{ connectedAccountId: CONNECTED_ACCOUNT_ID },
				FIRST_ATTEMPT,
				{ db, gmail, push: PUSH_ENABLED },
			),
		).rejects.toBe(failure);

		const row = await getRow(db);
		expect(row.status).toBe("active");
		expect(row.syncState).toBe("degraded");
		expect(row.watchFailureCount).toBe(1);
		expect(row.disconnectedAt).toBeNull();
	});

	it("enqueue-side job options request exponential-backoff retries", () => {
		// Guards the contract the degraded-state rethrow relies on.
		expect(GMAIL_WATCH_SETUP_JOB_OPTIONS.attempts).toBeGreaterThan(1);
		expect(GMAIL_WATCH_SETUP_JOB_OPTIONS.backoff).toEqual({
			type: "exponential",
			delay: expect.any(Number),
		});
	});

	it("accumulates watch_failure_count across attempts", async () => {
		await db
			.update(schema.connectedAccount)
			.set({ watchFailureCount: 2, syncState: "degraded" })
			.where(eq(schema.connectedAccount.id, CONNECTED_ACCOUNT_ID));
		const { gmail } = makeWatchStub(() =>
			Promise.reject(new GmailRetryableError("Gmail watch 500", 500)),
		);

		await expect(
			runGmailWatchSetup(
				{ connectedAccountId: CONNECTED_ACCOUNT_ID },
				{ attemptNumber: 3, maxAttempts: GMAIL_WATCH_SETUP_ATTEMPTS },
				{ db, gmail, push: PUSH_ENABLED },
			),
		).rejects.toBeInstanceOf(GmailRetryableError);

		expect((await getRow(db)).watchFailureCount).toBe(3);
	});

	it("falls back to polling (still active) when retries are exhausted", async () => {
		await db
			.update(schema.connectedAccount)
			.set({
				watchFailureCount: GMAIL_WATCH_SETUP_ATTEMPTS - 1,
				syncState: "degraded",
			})
			.where(eq(schema.connectedAccount.id, CONNECTED_ACCOUNT_ID));
		const { gmail } = makeWatchStub(() =>
			Promise.reject(new GmailRetryableError("Gmail watch 503", 503)),
		);

		const result = await runGmailWatchSetup(
			{ connectedAccountId: CONNECTED_ACCOUNT_ID },
			FINAL_ATTEMPT,
			{ db, gmail, push: PUSH_ENABLED },
		);

		expect(result).toEqual({ outcome: "polling", reason: "retries_exhausted" });

		const row = await getRow(db);
		expect(row.status).toBe("active");
		expect(row.syncState).toBe("polling");
		expect(row.watchFailureCount).toBe(GMAIL_WATCH_SETUP_ATTEMPTS);
		expect(row.disconnectedAt).toBeNull();
	});

	it("falls back to polling immediately on non-retryable failure", async () => {
		const { gmail } = makeWatchStub(() =>
			Promise.reject(new GmailAuthError("re-consent required")),
		);

		const result = await runGmailWatchSetup(
			{ connectedAccountId: CONNECTED_ACCOUNT_ID },
			FIRST_ATTEMPT,
			{ db, gmail, push: PUSH_ENABLED },
		);

		expect(result).toEqual({
			outcome: "polling",
			reason: "non_retryable_error",
		});

		const row = await getRow(db);
		expect(row.status).toBe("active");
		expect(row.syncState).toBe("polling");
		expect(row.watchFailureCount).toBe(1);
	});

	it("treats unknown errors (e.g. network) as retryable", async () => {
		const { gmail } = makeWatchStub(() =>
			Promise.reject(new Error("ECONNRESET")),
		);

		await expect(
			runGmailWatchSetup(
				{ connectedAccountId: CONNECTED_ACCOUNT_ID },
				FIRST_ATTEMPT,
				{ db, gmail, push: PUSH_ENABLED },
			),
		).rejects.toThrow("ECONNRESET");

		expect((await getRow(db)).syncState).toBe("degraded");
	});

	it("moves straight to polling without calling watch when push env is unset", async () => {
		const { gmail, watchCalls } = makeWatchStub(() =>
			Promise.resolve({ historyId: "1", expiration: "1" }),
		);

		const result = await runGmailWatchSetup(
			{ connectedAccountId: CONNECTED_ACCOUNT_ID },
			FIRST_ATTEMPT,
			{ db, gmail, push: { pushEnabled: false } },
		);

		expect(result).toEqual({ outcome: "polling", reason: "push_disabled" });
		expect(watchCalls()).toBe(0);

		const row = await getRow(db);
		expect(row.status).toBe("active");
		expect(row.syncState).toBe("polling");
		// Missing push config is an expected mode, not a watch failure.
		expect(row.watchFailureCount).toBe(0);
	});

	it("skips when the connected account no longer exists", async () => {
		const { gmail, watchCalls } = makeWatchStub(() =>
			Promise.resolve({ historyId: "1", expiration: "1" }),
		);

		const result = await runGmailWatchSetup(
			{ connectedAccountId: "missing" },
			FIRST_ATTEMPT,
			{ db, gmail, push: PUSH_ENABLED },
		);

		expect(result).toEqual({ outcome: "skipped", reason: "account_missing" });
		expect(watchCalls()).toBe(0);
	});

	it("skips disconnected accounts without touching their state", async () => {
		await db
			.update(schema.connectedAccount)
			.set({ status: "disconnected", disconnectedAt: new Date() })
			.where(eq(schema.connectedAccount.id, CONNECTED_ACCOUNT_ID));
		const { gmail, watchCalls } = makeWatchStub(() =>
			Promise.resolve({ historyId: "1", expiration: "1" }),
		);

		const result = await runGmailWatchSetup(
			{ connectedAccountId: CONNECTED_ACCOUNT_ID },
			FIRST_ATTEMPT,
			{ db, gmail, push: PUSH_ENABLED },
		);

		expect(result).toEqual({
			outcome: "skipped",
			reason: "account_disconnected",
		});
		expect(watchCalls()).toBe(0);
		expect((await getRow(db)).syncState).toBe("pending");
	});

	it("treats a single-attempt job (no retry options) as final and falls back to polling", async () => {
		const { gmail } = makeWatchStub(() =>
			Promise.reject(new GmailRetryableError("Gmail watch 503", 503)),
		);

		const result = await runGmailWatchSetup(
			{ connectedAccountId: CONNECTED_ACCOUNT_ID },
			{ attemptNumber: 1, maxAttempts: 1 },
			{ db, gmail, push: PUSH_ENABLED },
		);

		expect(result).toEqual({ outcome: "polling", reason: "retries_exhausted" });
		expect((await getRow(db)).syncState).toBe("polling");
	});
});
