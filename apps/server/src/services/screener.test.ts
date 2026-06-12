import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "../db/schema.ts";
import type { GmailMessage } from "./gmail/client.ts";
import { ingestMessages } from "./ingestion/ingest.ts";
import { listThreads, ThreadNotFoundError } from "./mail_queries.ts";
import {
	acceptSender,
	listRejectedSenders,
	overrideThreadCategory,
	recoverSender,
	RejectedSenderNotFoundError,
	rejectSender,
} from "./screener.ts";

const MIGRATIONS_FOLDER = join(import.meta.dir, "../../drizzle");

const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";
const ACCOUNT_A = "ca-a"; // user-1, alice@gmail.com
const ACCOUNT_B = "ca-b"; // user-1, alice.work@gmail.com
const ACCOUNT_OTHER = "ca-other"; // user-2's account

const BOB = "bob@example.com";
const CAROL = "carol@example.com";

/**
 * Real libsql db (temp file) with the actual migrations applied — same
 * pattern as `services/mail_queries.test.ts` (a file, not `:memory:`,
 * because libsql drops the connection between transactions).
 */
const TEST_DB_DIR = mkdtempSync(join(tmpdir(), "atlas-screener-test-"));
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

	await db.insert(schema.user).values([
		{ id: USER_ID, name: "Alice", email: "alice@example.com" },
		{ id: OTHER_USER_ID, name: "Mallory", email: "mallory@example.com" },
	]);
	await db.insert(schema.account).values([
		{
			id: "auth-a",
			accountId: "google-sub-a",
			providerId: "google",
			userId: USER_ID,
		},
		{
			id: "auth-b",
			accountId: "google-sub-b",
			providerId: "google",
			userId: USER_ID,
		},
		{
			id: "auth-other",
			accountId: "google-sub-other",
			providerId: "google",
			userId: OTHER_USER_ID,
		},
	]);
	await db.insert(schema.connectedAccount).values([
		{
			id: ACCOUNT_A,
			userId: USER_ID,
			authAccountId: "auth-a",
			emailAddress: "alice@gmail.com",
		},
		{
			id: ACCOUNT_B,
			userId: USER_ID,
			authAccountId: "auth-b",
			emailAddress: "alice.work@gmail.com",
		},
		{
			id: ACCOUNT_OTHER,
			userId: OTHER_USER_ID,
			authAccountId: "auth-other",
			emailAddress: "mallory@gmail.com",
		},
	]);

	return db;
};

type TestDb = Awaited<ReturnType<typeof makeDb>>;

let threadCounter = 0;

interface ThreadFixture {
	userId?: string;
	connectedAccountId?: string;
	senderEmail?: string;
	state?: (typeof schema.thread.$inferInsert)["state"];
	category?: (typeof schema.thread.$inferInsert)["category"];
	categoryOverridden?: boolean;
}

const seedThread = async (db: TestDb, fixture: ThreadFixture = {}) => {
	threadCounter += 1;
	const rows = await db
		.insert(schema.thread)
		.values({
			userId: fixture.userId ?? USER_ID,
			connectedAccountId: fixture.connectedAccountId ?? ACCOUNT_A,
			providerThreadId: `pt-${threadCounter}`,
			state: fixture.state ?? "screener",
			category: fixture.category ?? null,
			categoryOverridden: fixture.categoryOverridden ?? false,
			senderEmail: fixture.senderEmail ?? BOB,
			subject: `Thread ${threadCounter}`,
			lastMessageAt: new Date(1781000000000 + threadCounter),
			messageCount: 1,
		})
		.returning({ id: schema.thread.id });
	const row = rows[0];
	if (!row) throw new Error("seedThread: insert returned no row");
	return row.id;
};

const seedSender = async (
	db: TestDb,
	fixture: Partial<typeof schema.sender.$inferInsert> = {},
) => {
	await db.insert(schema.sender).values({
		userId: USER_ID,
		emailAddress: BOB,
		trust: "unscreened",
		...fixture,
	});
};

const getSender = async (db: TestDb, email: string, userId = USER_ID) => {
	const rows = await db
		.select()
		.from(schema.sender)
		.where(
			and(
				eq(schema.sender.userId, userId),
				eq(schema.sender.emailAddress, email),
			),
		);
	return rows[0] ?? null;
};

const getThread = async (db: TestDb, id: string) => {
	const rows = await db
		.select()
		.from(schema.thread)
		.where(eq(schema.thread.id, id));
	const row = rows[0];
	if (!row) throw new Error(`thread not found: ${id}`);
	return row;
};

let messageCounter = 0;

/** Minimal Gmail metadata message for driving real future-ingest routing. */
const gmailMessage = (from: string): GmailMessage => {
	messageCounter += 1;
	return {
		id: `m-${messageCounter}`,
		threadId: `gt-${messageCounter}`,
		labelIds: ["INBOX"],
		snippet: `snippet ${messageCounter}`,
		internalDate: "1781000000000",
		payload: {
			headers: [
				{ name: "From", value: from },
				{ name: "Subject", value: "Hello" },
			],
		},
	};
};

/** Ingest one FUTURE new thread from `from` and return its thread row. */
const ingestFutureThread = async (
	db: TestDb,
	from: string,
	connectedAccountId = ACCOUNT_A,
) => {
	const results = await ingestMessages(
		{ id: connectedAccountId, userId: USER_ID },
		[gmailMessage(from)],
		{ db },
	);
	const result = results[0];
	if (!result?.threadId) throw new Error("ingest did not create a thread");
	return getThread(db, result.threadId);
};

describe("acceptSender", () => {
	let db: TestDb;

	beforeEach(async () => {
		db = await makeDb();
	});

	it("routes existing screener threads to the category and future new threads at ingest", async () => {
		await seedSender(db);
		const t1 = await seedThread(db, { state: "screener" });
		const t2 = await seedThread(db, { state: "screener" });
		const otherSenderThread = await seedThread(db, {
			state: "screener",
			senderEmail: CAROL,
		});

		const result = await acceptSender(USER_ID, BOB, "feed", db);
		expect(result.movedThreadCount).toBe(2);

		// Rule: user-global sender row updated.
		const rule = await getSender(db, BOB);
		expect(rule?.trust).toBe("accepted");
		expect(rule?.defaultCategory).toBe("feed");
		expect(rule?.decidedAt).not.toBeNull();

		// Existing screener threads moved (not as overrides).
		for (const id of [t1, t2]) {
			const row = await getThread(db, id);
			expect(row.state).toBe("categorized");
			expect(row.category).toBe("feed");
			expect(row.categoryOverridden).toBe(false);
		}

		// Another sender's screener thread is untouched.
		expect((await getThread(db, otherSenderThread)).state).toBe("screener");

		// Future new thread from bob routes straight to the category.
		const future = await ingestFutureThread(db, `Bob <${BOB}>`);
		expect(future.state).toBe("categorized");
		expect(future.category).toBe("feed");
	});

	it("upserts a rule even when no sender row exists yet and normalizes the address", async () => {
		const t1 = await seedThread(db, { state: "screener" });

		await acceptSender(USER_ID, "  Bob@Example.COM ", "inbox", db);

		const rule = await getSender(db, BOB);
		expect(rule?.trust).toBe("accepted");
		expect((await getThread(db, t1)).state).toBe("categorized");
	});

	it("applies across two connected accounts of the same user", async () => {
		await seedSender(db);
		const onA = await seedThread(db, { connectedAccountId: ACCOUNT_A });
		const onB = await seedThread(db, { connectedAccountId: ACCOUNT_B });

		const result = await acceptSender(USER_ID, BOB, "paper_trail", db);
		expect(result.movedThreadCount).toBe(2);

		expect((await getThread(db, onA)).category).toBe("paper_trail");
		expect((await getThread(db, onB)).category).toBe("paper_trail");

		// Future thread arriving on the OTHER account follows the same rule.
		const future = await ingestFutureThread(db, BOB, ACCOUNT_B);
		expect(future.state).toBe("categorized");
		expect(future.category).toBe("paper_trail");
	});

	it("never touches another user's sender rule or threads", async () => {
		await db.insert(schema.sender).values({
			userId: OTHER_USER_ID,
			emailAddress: BOB,
			trust: "unscreened",
		});
		const foreignThread = await seedThread(db, {
			userId: OTHER_USER_ID,
			connectedAccountId: ACCOUNT_OTHER,
		});

		await acceptSender(USER_ID, BOB, "inbox", db);

		expect((await getSender(db, BOB, OTHER_USER_ID))?.trust).toBe("unscreened");
		expect((await getThread(db, foreignThread)).state).toBe("screener");
	});
});

describe("rejectSender", () => {
	let db: TestDb;

	beforeEach(async () => {
		db = await makeDb();
	});

	it("hides current screener threads recoverably and future new threads at ingest", async () => {
		await seedSender(db);
		const t1 = await seedThread(db, { state: "screener" });

		const result = await rejectSender(USER_ID, BOB, db);
		expect(result.hiddenThreadCount).toBe(1);

		expect((await getSender(db, BOB))?.trust).toBe("rejected");

		const hidden = await getThread(db, t1);
		expect(hidden.state).toBe("hidden");
		expect(hidden.category).toBeNull();

		// Hidden threads vanish from every view but are NOT deleted —
		// they remain recoverable via the rejected-senders listing.
		expect(
			(await listThreads(USER_ID, { view: "screener" }, db)).threads,
		).toEqual([]);
		const rejected = await listRejectedSenders(USER_ID, db);
		expect(rejected).toEqual([
			{
				emailAddress: BOB,
				decidedAt: expect.any(String),
				hiddenThreadCount: 1,
			},
		]);

		// Future new threads from bob ingest as hidden across accounts.
		const future = await ingestFutureThread(db, BOB, ACCOUNT_B);
		expect(future.state).toBe("hidden");
		expect((await listRejectedSenders(USER_ID, db))[0]?.hiddenThreadCount).toBe(
			2,
		);
	});

	it("leaves already-categorized threads from the sender alone", async () => {
		await seedSender(db, { trust: "accepted", defaultCategory: "inbox" });
		const categorized = await seedThread(db, {
			state: "categorized",
			category: "inbox",
		});

		await rejectSender(USER_ID, BOB, db);

		expect((await getThread(db, categorized)).state).toBe("categorized");
	});
});

describe("recoverSender", () => {
	let db: TestDb;

	beforeEach(async () => {
		db = await makeDb();
	});

	it("re-accepts and restores hidden threads when restoreHidden is set", async () => {
		await seedSender(db);
		const t1 = await seedThread(db, { state: "screener" });
		await rejectSender(USER_ID, BOB, db);

		const result = await recoverSender(
			USER_ID,
			BOB,
			{ category: "feed", restoreHidden: true },
			db,
		);
		expect(result.restoredThreadCount).toBe(1);

		const rule = await getSender(db, BOB);
		expect(rule?.trust).toBe("accepted");
		expect(rule?.defaultCategory).toBe("feed");

		const restored = await getThread(db, t1);
		expect(restored.state).toBe("categorized");
		expect(restored.category).toBe("feed");

		// No longer rejected; future threads categorize.
		expect(await listRejectedSenders(USER_ID, db)).toEqual([]);
		const future = await ingestFutureThread(db, BOB);
		expect(future.state).toBe("categorized");
		expect(future.category).toBe("feed");
	});

	it("re-accepts without touching hidden threads when restoreHidden is omitted", async () => {
		await seedSender(db);
		const t1 = await seedThread(db, { state: "screener" });
		await rejectSender(USER_ID, BOB, db);

		const result = await recoverSender(USER_ID, BOB, { category: "inbox" }, db);
		expect(result.restoredThreadCount).toBe(0);

		expect((await getThread(db, t1)).state).toBe("hidden");
		expect((await getSender(db, BOB))?.trust).toBe("accepted");

		const future = await ingestFutureThread(db, BOB);
		expect(future.state).toBe("categorized");
		expect(future.category).toBe("inbox");
	});

	it("throws RejectedSenderNotFoundError for unknown and non-rejected senders alike", async () => {
		await seedSender(db, { trust: "accepted", defaultCategory: "inbox" });

		expect(
			recoverSender(USER_ID, "nobody@example.com", { category: "inbox" }, db),
		).rejects.toBeInstanceOf(RejectedSenderNotFoundError);
		expect(
			recoverSender(USER_ID, BOB, { category: "inbox" }, db),
		).rejects.toBeInstanceOf(RejectedSenderNotFoundError);
	});
});

describe("overrideThreadCategory", () => {
	let db: TestDb;

	beforeEach(async () => {
		db = await makeDb();
	});

	it("overrides one thread without promote and leaves the sender rule untouched", async () => {
		await seedSender(db);
		const t1 = await seedThread(db, { state: "screener" });

		const result = await overrideThreadCategory(
			USER_ID,
			t1,
			"paper_trail",
			{},
			db,
		);
		expect(result).toEqual({
			id: t1,
			state: "categorized",
			category: "paper_trail",
			categoryOverridden: true,
			promotedSender: false,
		});

		const row = await getThread(db, t1);
		expect(row.state).toBe("categorized");
		expect(row.category).toBe("paper_trail");
		expect(row.categoryOverridden).toBe(true);

		// Sender rule untouched — bob's NEXT new thread still hits the
		// screener.
		expect((await getSender(db, BOB))?.trust).toBe("unscreened");
		const future = await ingestFutureThread(db, BOB);
		expect(future.state).toBe("screener");
	});

	it("promote updates the sender's user-global routing rule", async () => {
		await seedSender(db);
		const t1 = await seedThread(db, { state: "screener" });
		const sibling = await seedThread(db, { state: "screener" });

		const result = await overrideThreadCategory(
			USER_ID,
			t1,
			"feed",
			{ promote: true },
			db,
		);
		expect(result.promotedSender).toBe(true);

		const rule = await getSender(db, BOB);
		expect(rule?.trust).toBe("accepted");
		expect(rule?.defaultCategory).toBe("feed");

		// Promote changes the RULE only — sibling screener threads are not
		// swept (the accept endpoint owns that), but future threads follow
		// the new rule across accounts.
		expect((await getThread(db, sibling)).state).toBe("screener");
		const future = await ingestFutureThread(db, BOB, ACCOUNT_B);
		expect(future.state).toBe("categorized");
		expect(future.category).toBe("feed");
	});

	it("re-overriding a categorized thread keeps category_overridden set", async () => {
		const t1 = await seedThread(db, {
			state: "categorized",
			category: "inbox",
			categoryOverridden: true,
		});

		await overrideThreadCategory(USER_ID, t1, "feed", {}, db);

		const row = await getThread(db, t1);
		expect(row.category).toBe("feed");
		expect(row.categoryOverridden).toBe(true);
	});

	it("throws ThreadNotFoundError for unknown ids and other users' ids alike", async () => {
		const foreign = await seedThread(db, {
			userId: OTHER_USER_ID,
			connectedAccountId: ACCOUNT_OTHER,
		});

		expect(
			overrideThreadCategory(USER_ID, "missing", "inbox", {}, db),
		).rejects.toBeInstanceOf(ThreadNotFoundError);
		expect(
			overrideThreadCategory(USER_ID, foreign, "inbox", {}, db),
		).rejects.toBeInstanceOf(ThreadNotFoundError);
	});
});
