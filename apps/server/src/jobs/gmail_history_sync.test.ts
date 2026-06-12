import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Verrou } from "@verrou/core";
import { memoryStore } from "@verrou/core/drivers/memory";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "../db/schema.ts";
import {
	type GmailHistoryPage,
	type GmailMessage,
	GmailRetryableError,
	HistoryGapError,
} from "../services/gmail/client.ts";
import {
	gmailHistorySyncLockKey,
	type HistorySyncGmailClient,
	runGmailHistorySync,
} from "./gmail_history_sync.ts";

const MIGRATIONS_FOLDER = join(import.meta.dir, "../../drizzle");

const USER_ID = "user-1";
const AUTH_ACCOUNT_ID = "auth-acc-1";
const CONNECTED_ACCOUNT_ID = "ca-1";

/** Connect-time checkpoint every test account starts from. */
const CHECKPOINT = "1000";

/**
 * Real libsql db (temp file) with the actual migrations applied — same
 * harness as `jobs/gmail_watch.test.ts` (a file, not `:memory:`, because the
 * libsql client drops its connection between calls).
 */
const TEST_DB_DIR = mkdtempSync(join(tmpdir(), "atlas-history-sync-test-"));
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
		checkpointHistoryId: CHECKPOINT,
		checkpointAt: new Date(),
		...overrides,
	});
};

const getAccountRow = async (db: TestDb) => {
	const rows = await db
		.select()
		.from(schema.connectedAccount)
		.where(eq(schema.connectedAccount.id, CONNECTED_ACCOUNT_ID));
	const row = rows[0];
	if (!row) throw new Error("expected a connected_account row");
	return row;
};

const listMessages = (db: TestDb) => db.select().from(schema.message);
const listSyncGaps = (db: TestDb) => db.select().from(schema.syncGap);

/** Fresh in-memory Verrou per test — real lock semantics, no Redis. */
const makeLocks = () =>
	new Verrou({
		default: "memory",
		stores: { memory: { driver: memoryStore() } },
	});

/** Gmail `format=metadata` fixture with the headers ingest needs. */
const gmailMessage = (id: string, threadId: string): GmailMessage => ({
	id,
	threadId,
	labelIds: ["INBOX"],
	snippet: `snippet of ${id}`,
	internalDate: "1781000000000",
	payload: {
		headers: [
			{ name: "From", value: `Bob Sender <bob@example.com>` },
			{ name: "To", value: "Alice <alice@gmail.com>" },
			{ name: "Subject", value: `Subject ${id}` },
			{ name: "Date", value: "Thu, 11 Jun 2026 10:00:00 +0000" },
			{ name: "Message-ID", value: `<${id}@mail.example.com>` },
		],
	},
});

/** One history record carrying `messageAdded` events. */
const record = (
	historyRecordId: string,
	...added: Array<{ id: string; threadId: string }>
): NonNullable<GmailHistoryPage["history"]>[number] => ({
	id: historyRecordId,
	messagesAdded: added.map((message) => ({ message })),
});

/** A page step is either a page to yield or an error to throw in its place. */
type PageStep = GmailHistoryPage | Error;

interface GmailStubOptions {
	/** History pagination keyed by `startHistoryId`. */
	pages?: Record<string, PageStep[]>;
	/** Messages servable through `getMessageMetadata`. */
	messages?: GmailMessage[];
	/** `getProfile().historyId` (gap-reset target). */
	profileHistoryId?: string;
}

const makeGmailStub = (options: GmailStubOptions = {}) => {
	const messageById = new Map(
		(options.messages ?? []).map((message) => [message.id, message]),
	);
	const calls = {
		historyPages: 0,
		getProfile: 0,
		metadataBatches: [] as string[][],
	};

	const gmail: HistorySyncGmailClient = {
		getProfile: async () => {
			calls.getProfile += 1;
			return {
				emailAddress: "alice@gmail.com",
				messagesTotal: 0,
				threadsTotal: 0,
				historyId: options.profileHistoryId ?? "0",
			};
		},
		// biome-ignore lint/correctness/useYield: error-only step lists never yield.
		async *historyPages({ startHistoryId }) {
			calls.historyPages += 1;
			const steps = options.pages?.[startHistoryId];
			if (!steps) {
				throw new Error(`unexpected startHistoryId ${startHistoryId}`);
			}
			for (const step of steps) {
				if (step instanceof Error) throw step;
				yield step;
			}
		},
		getMessageMetadata: async (ids) => {
			calls.metadataBatches.push([...ids]);
			return ids.map((id) => {
				const message = messageById.get(id);
				if (!message) throw new Error(`no fixture for message ${id}`);
				return message;
			});
		},
	};

	return { gmail, calls };
};

describe("runGmailHistorySync", () => {
	let db: TestDb;

	beforeEach(async () => {
		db = await makeDb();
		await insertConnectedAccount(db);
	});

	const run = (
		deps: Partial<Parameters<typeof runGmailHistorySync>[1]> = {},
		connectedAccountId = CONNECTED_ACCOUNT_ID,
	) =>
		runGmailHistorySync(
			{ connectedAccountId },
			{
				db,
				locks: makeLocks(),
				ingestionEnabled: true,
				...deps,
			},
		);

	it("syncs multiple pages, ingests their messages, and advances the cursor per page", async () => {
		const { gmail } = makeGmailStub({
			pages: {
				[CHECKPOINT]: [
					{
						history: [
							record("1001", { id: "m1", threadId: "t1" }),
							record("1002", { id: "m2", threadId: "t2" }),
						],
						nextPageToken: "page-2",
					},
					{
						history: [record("1003", { id: "m3", threadId: "t1" })],
						historyId: "1010",
					},
				],
			},
			messages: [
				gmailMessage("m1", "t1"),
				gmailMessage("m2", "t2"),
				gmailMessage("m3", "t1"),
			],
		});

		const result = await run({ gmail });

		expect(result).toEqual({
			outcome: "synced",
			pages: 2,
			messagesIngested: 3,
			cursor: "1010",
		});

		const row = await getAccountRow(db);
		expect(row.lastSyncedHistoryId).toBe("1010");
		expect(row.lastSyncedAt).not.toBeNull();
		// A normal sync never moves the connect-time checkpoint.
		expect(row.checkpointHistoryId).toBe(CHECKPOINT);

		const messages = await listMessages(db);
		expect(messages.map((m) => m.providerMessageId).sort()).toEqual([
			"m1",
			"m2",
			"m3",
		]);
		expect(await listSyncGaps(db)).toHaveLength(0);
	});

	it("reads the cursor from last_synced_history_id when set (incremental = same path)", async () => {
		await db
			.update(schema.connectedAccount)
			.set({ lastSyncedHistoryId: "2000" })
			.where(eq(schema.connectedAccount.id, CONNECTED_ACCOUNT_ID));
		// Keyed by startHistoryId: a read from the checkpoint would throw.
		const { gmail } = makeGmailStub({
			pages: { "2000": [{ historyId: "2000" }] },
		});

		const result = await run({ gmail });

		expect(result).toEqual({
			outcome: "synced",
			pages: 1,
			messagesIngested: 0,
			cursor: "2000",
		});
	});

	it("resumes after a crash between pages without duplicating messages", async () => {
		// Run 1: page 1 commits, then the next page fetch dies.
		const crash = new GmailRetryableError("Gmail 503 between pages", 503);
		const firstAttempt = makeGmailStub({
			pages: {
				[CHECKPOINT]: [
					{
						history: [
							record("1001", { id: "m1", threadId: "t1" }),
							record("1002", { id: "m2", threadId: "t2" }),
						],
						nextPageToken: "page-2",
					},
					crash,
				],
			},
			messages: [gmailMessage("m1", "t1"), gmailMessage("m2", "t2")],
		});

		await expect(run({ gmail: firstAttempt.gmail })).rejects.toBe(crash);

		// Page 1 committed: cursor advanced and its messages persisted.
		expect((await getAccountRow(db)).lastSyncedHistoryId).toBe("1002");
		expect(await listMessages(db)).toHaveLength(2);

		// Run 2 (BullMQ retry): resumes from the committed cursor. The boundary
		// message m2 is redelivered — ingest idempotency must skip it.
		const retry = makeGmailStub({
			pages: {
				"1002": [
					{
						history: [
							record(
								"1003",
								{ id: "m2", threadId: "t2" },
								{ id: "m3", threadId: "t1" },
							),
						],
						historyId: "1010",
					},
				],
			},
			messages: [gmailMessage("m2", "t2"), gmailMessage("m3", "t1")],
		});

		const result = await run({ gmail: retry.gmail });

		expect(result).toEqual({
			outcome: "synced",
			pages: 1,
			messagesIngested: 1, // m2 skipped as duplicate, m3 ingested
			cursor: "1010",
		});

		const messages = await listMessages(db);
		expect(messages.map((m) => m.providerMessageId).sort()).toEqual([
			"m1",
			"m2",
			"m3",
		]);
		expect((await getAccountRow(db)).lastSyncedHistoryId).toBe("1010");
	});

	it("records a sync_gap and resets cursor AND checkpoint forward on a history gap", async () => {
		const { gmail, calls } = makeGmailStub({
			pages: { [CHECKPOINT]: [new HistoryGapError(CHECKPOINT)] },
			profileHistoryId: "5000",
		});

		const result = await run({ gmail });

		expect(result).toEqual({
			outcome: "gap_reset",
			fromHistoryId: CHECKPOINT,
			resetToHistoryId: "5000",
			messagesIngested: 0,
		});
		expect(calls.getProfile).toBe(1);

		const row = await getAccountRow(db);
		expect(row.lastSyncedHistoryId).toBe("5000");
		expect(row.checkpointHistoryId).toBe("5000");
		expect(row.checkpointAt).not.toBeNull();
		// Forward-only: the account stays active; nothing is backfilled.
		expect(row.status).toBe("active");

		const gaps = await listSyncGaps(db);
		expect(gaps).toHaveLength(1);
		expect(gaps[0]).toMatchObject({
			connectedAccountId: CONNECTED_ACCOUNT_ID,
			fromHistoryId: CHECKPOINT,
			resetToHistoryId: "5000",
			reason: "history_gap",
		});
	});

	it("keeps pages committed before a mid-pagination gap and records the advanced cursor", async () => {
		const { gmail } = makeGmailStub({
			pages: {
				[CHECKPOINT]: [
					{
						history: [record("1001", { id: "m1", threadId: "t1" })],
						nextPageToken: "page-2",
					},
					new HistoryGapError("1001"),
				],
			},
			messages: [gmailMessage("m1", "t1")],
			profileHistoryId: "5000",
		});

		const result = await run({ gmail });

		expect(result).toEqual({
			outcome: "gap_reset",
			fromHistoryId: "1001",
			resetToHistoryId: "5000",
			messagesIngested: 1,
		});

		// Page 1's ingest survives the gap reset.
		expect(await listMessages(db)).toHaveLength(1);
		const gaps = await listSyncGaps(db);
		expect(gaps[0]?.fromHistoryId).toBe("1001");
	});

	it("is a no-op for disconnected accounts", async () => {
		await db
			.update(schema.connectedAccount)
			.set({ status: "disconnected", disconnectedAt: new Date() })
			.where(eq(schema.connectedAccount.id, CONNECTED_ACCOUNT_ID));
		const { gmail, calls } = makeGmailStub();

		const result = await run({ gmail });

		expect(result).toEqual({
			outcome: "skipped",
			reason: "account_disconnected",
		});
		expect(calls.historyPages).toBe(0);
		expect((await getAccountRow(db)).lastSyncedHistoryId).toBeNull();
	});

	it("is a no-op when the connected account no longer exists", async () => {
		const { gmail, calls } = makeGmailStub();

		const result = await run({ gmail }, "missing");

		expect(result).toEqual({ outcome: "skipped", reason: "account_missing" });
		expect(calls.historyPages).toBe(0);
	});

	it("is a no-op when the ingestion flag is off", async () => {
		const { gmail, calls } = makeGmailStub();

		const result = await run({ gmail, ingestionEnabled: false });

		expect(result).toEqual({
			outcome: "skipped",
			reason: "ingestion_disabled",
		});
		expect(calls.historyPages).toBe(0);
	});

	it("skips when another sync already holds the account lock", async () => {
		const locks = makeLocks();
		const held = locks.createLock(
			gmailHistorySyncLockKey(CONNECTED_ACCOUNT_ID),
		);
		expect(await held.acquireImmediately()).toBe(true);

		const { gmail, calls } = makeGmailStub();
		try {
			const result = await run({ gmail, locks });
			expect(result).toEqual({
				outcome: "skipped",
				reason: "already_running",
			});
			expect(calls.historyPages).toBe(0);
		} finally {
			await held.release();
		}
	});

	it("skips (never invents a cursor) when both cursor fields are null", async () => {
		await db
			.update(schema.connectedAccount)
			.set({ checkpointHistoryId: null, lastSyncedHistoryId: null })
			.where(eq(schema.connectedAccount.id, CONNECTED_ACCOUNT_ID));
		const { gmail, calls } = makeGmailStub();

		const result = await run({ gmail });

		expect(result).toEqual({ outcome: "skipped", reason: "no_cursor" });
		expect(calls.historyPages).toBe(0);
		expect(calls.getProfile).toBe(0);
	});
});
