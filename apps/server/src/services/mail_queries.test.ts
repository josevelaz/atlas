import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "../db/schema.ts";
import {
	getThreadDetail,
	InvalidCursorError,
	listThreads,
	MailAccountNotFoundError,
	type MailView,
	ThreadNotFoundError,
} from "./mail_queries.ts";

const MIGRATIONS_FOLDER = join(import.meta.dir, "../../drizzle");

const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";
const ACCOUNT_A = "ca-a"; // user-1, alice@gmail.com
const ACCOUNT_B = "ca-b"; // user-1, alice.work@gmail.com (disconnected)
const ACCOUNT_OTHER = "ca-other"; // user-2's account

/**
 * Real libsql db (temp file) with the actual migrations applied — same
 * pattern as `services/ingestion/ingest.test.ts` (a file, not `:memory:`,
 * because libsql drops the connection between transactions).
 */
const TEST_DB_DIR = mkdtempSync(join(tmpdir(), "atlas-mail-queries-test-"));
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
			status: "active",
		},
		{
			id: ACCOUNT_B,
			userId: USER_ID,
			authAccountId: "auth-b",
			emailAddress: "alice.work@gmail.com",
			status: "disconnected",
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
	state?: (typeof schema.thread.$inferInsert)["state"];
	category?: (typeof schema.thread.$inferInsert)["category"];
	lastMessageAt?: number | null;
	archived?: boolean;
	trashed?: boolean;
	subject?: string;
}

const seedThread = async (db: TestDb, fixture: ThreadFixture = {}) => {
	threadCounter += 1;
	const rows = await db
		.insert(schema.thread)
		.values({
			userId: fixture.userId ?? USER_ID,
			connectedAccountId: fixture.connectedAccountId ?? ACCOUNT_A,
			providerThreadId: `pt-${threadCounter}`,
			state: fixture.state ?? "categorized",
			category:
				fixture.category !== undefined
					? fixture.category
					: (fixture.state ?? "categorized") === "categorized"
						? "inbox"
						: null,
			senderEmail: "bob@example.com",
			subject: fixture.subject ?? `Thread ${threadCounter}`,
			preview: `preview ${threadCounter}`,
			lastMessageAt:
				fixture.lastMessageAt === null
					? null
					: new Date(fixture.lastMessageAt ?? 1781000000000 + threadCounter),
			messageCount: 1,
			archived: fixture.archived ?? false,
			trashed: fixture.trashed ?? false,
		})
		.returning({ id: schema.thread.id });
	const row = rows[0];
	if (!row) throw new Error("seedThread: insert returned no row");
	return row.id;
};

const idsForView = async (
	db: TestDb,
	view: MailView,
	accountId?: string,
): Promise<string[]> => {
	const page = await listThreads(USER_ID, { view, accountId }, db);
	return page.threads.map((row) => row.id);
};

describe("listThreads", () => {
	let db: TestDb;

	beforeEach(async () => {
		db = await makeDb();
	});

	it("filters every view correctly (matrix: spam not in screener, hidden excluded everywhere)", async () => {
		const screenerId = await seedThread(db, { state: "screener" });
		const spamId = await seedThread(db, { state: "spam" });
		await seedThread(db, { state: "hidden" });
		const inboxId = await seedThread(db, {
			state: "categorized",
			category: "inbox",
		});
		const feedId = await seedThread(db, {
			state: "categorized",
			category: "feed",
		});
		const paperId = await seedThread(db, {
			state: "categorized",
			category: "paper_trail",
		});

		expect(await idsForView(db, "screener")).toEqual([screenerId]);
		expect(await idsForView(db, "spam")).toEqual([spamId]);
		expect(await idsForView(db, "inbox")).toEqual([inboxId]);
		expect(await idsForView(db, "feed")).toEqual([feedId]);
		expect(await idsForView(db, "paper_trail")).toEqual([paperId]);
	});

	it("excludes trashed and archived threads from every view", async () => {
		await seedThread(db, { state: "screener", trashed: true });
		await seedThread(db, { state: "spam", archived: true });
		await seedThread(db, {
			state: "categorized",
			category: "inbox",
			trashed: true,
		});
		await seedThread(db, {
			state: "categorized",
			category: "inbox",
			archived: true,
		});
		const keptId = await seedThread(db, {
			state: "categorized",
			category: "inbox",
		});

		expect(await idsForView(db, "screener")).toEqual([]);
		expect(await idsForView(db, "spam")).toEqual([]);
		expect(await idsForView(db, "inbox")).toEqual([keptId]);
	});

	it("never returns another user's threads", async () => {
		await seedThread(db, {
			userId: OTHER_USER_ID,
			connectedAccountId: ACCOUNT_OTHER,
		});
		const mineId = await seedThread(db);

		expect(await idsForView(db, "inbox")).toEqual([mineId]);
	});

	it("is unified across accounts by default and carries provenance on every row", async () => {
		await seedThread(db, {
			connectedAccountId: ACCOUNT_A,
			lastMessageAt: 1781000002000,
		});
		await seedThread(db, {
			connectedAccountId: ACCOUNT_B,
			lastMessageAt: 1781000001000,
		});

		const page = await listThreads(USER_ID, { view: "inbox" }, db);
		expect(page.threads).toHaveLength(2);
		expect(
			page.threads.map((row) => ({
				connectedAccountId: row.connectedAccountId,
				accountEmail: row.accountEmail,
				accountStatus: row.accountStatus,
			})),
		).toEqual([
			{
				connectedAccountId: ACCOUNT_A,
				accountEmail: "alice@gmail.com",
				accountStatus: "active",
			},
			{
				connectedAccountId: ACCOUNT_B,
				accountEmail: "alice.work@gmail.com",
				accountStatus: "disconnected",
			},
		]);
	});

	it("narrows to one account with accountId", async () => {
		const aId = await seedThread(db, { connectedAccountId: ACCOUNT_A });
		await seedThread(db, { connectedAccountId: ACCOUNT_B });

		expect(await idsForView(db, "inbox", ACCOUNT_A)).toEqual([aId]);
	});

	it("throws MailAccountNotFoundError for an unknown accountId", async () => {
		expect(
			listThreads(USER_ID, { view: "inbox", accountId: "nope" }, db),
		).rejects.toBeInstanceOf(MailAccountNotFoundError);
	});

	it("throws MailAccountNotFoundError for another user's accountId", async () => {
		await seedThread(db, {
			userId: OTHER_USER_ID,
			connectedAccountId: ACCOUNT_OTHER,
		});

		expect(
			listThreads(USER_ID, { view: "inbox", accountId: ACCOUNT_OTHER }, db),
		).rejects.toBeInstanceOf(MailAccountNotFoundError);
	});

	it("orders by last_message_at desc and paginates with a keyset cursor", async () => {
		const ids: string[] = [];
		for (let i = 1; i <= 5; i += 1) {
			ids.push(await seedThread(db, { lastMessageAt: 1781000000000 + i }));
		}
		const newestFirst = [...ids].reverse();

		const page1 = await listThreads(USER_ID, { view: "inbox", limit: 2 }, db);
		expect(page1.threads.map((row) => row.id)).toEqual(newestFirst.slice(0, 2));
		expect(page1.nextCursor).not.toBeNull();

		const page2 = await listThreads(
			USER_ID,
			{ view: "inbox", limit: 2, cursor: page1.nextCursor ?? "" },
			db,
		);
		expect(page2.threads.map((row) => row.id)).toEqual(newestFirst.slice(2, 4));
		expect(page2.nextCursor).not.toBeNull();

		const page3 = await listThreads(
			USER_ID,
			{ view: "inbox", limit: 2, cursor: page2.nextCursor ?? "" },
			db,
		);
		expect(page3.threads.map((row) => row.id)).toEqual(newestFirst.slice(4));
		expect(page3.nextCursor).toBeNull();
	});

	it("paginates stably across a last_message_at tie", async () => {
		for (let i = 0; i < 4; i += 1) {
			await seedThread(db, { lastMessageAt: 1781000000000 });
		}

		const seen: string[] = [];
		let cursor: string | undefined;
		for (;;) {
			const page = await listThreads(
				USER_ID,
				{ view: "inbox", limit: 1, cursor },
				db,
			);
			seen.push(...page.threads.map((row) => row.id));
			if (!page.nextCursor) break;
			cursor = page.nextCursor;
		}

		expect(seen).toHaveLength(4);
		expect(new Set(seen).size).toBe(4);
	});

	it("throws InvalidCursorError for a malformed cursor", async () => {
		expect(
			listThreads(USER_ID, { view: "inbox", cursor: "not-a-cursor" }, db),
		).rejects.toBeInstanceOf(InvalidCursorError);
	});
});

describe("getThreadDetail", () => {
	let db: TestDb;

	beforeEach(async () => {
		db = await makeDb();
	});

	it("returns the thread with ordered messages, body_state, attachment metadata, and provenance", async () => {
		const threadId = await seedThread(db, { subject: "Invoices" });

		const insertedMessages = await db
			.insert(schema.message)
			.values([
				{
					threadId,
					connectedAccountId: ACCOUNT_A,
					providerMessageId: "m2",
					fromEmail: "bob@example.com",
					fromName: "Bob",
					toJson: [{ email: "alice@gmail.com", name: "Alice" }],
					sentAt: new Date(1781000060000),
					preview: "the reply",
					bodyState: "preview_only",
				},
				{
					threadId,
					connectedAccountId: ACCOUNT_A,
					providerMessageId: "m1",
					fromEmail: "bob@example.com",
					fromName: "Bob",
					sentAt: new Date(1781000000000),
					preview: "the opener",
					bodyState: "fetched",
					bodyRef: "s3://bodies/m1",
					spamFlaggedAtIngest: true,
				},
			])
			.returning({
				id: schema.message.id,
				providerMessageId: schema.message.providerMessageId,
			});
		const m1 = insertedMessages.find((m) => m.providerMessageId === "m1");
		if (!m1) throw new Error("expected m1 row");

		await db.insert(schema.attachment).values({
			messageId: m1.id,
			providerAttachmentId: "att-1",
			filename: "invoice.pdf",
			mimeType: "application/pdf",
			sizeBytes: 52341,
		});

		const detail = await getThreadDetail(USER_ID, threadId, db);

		expect(detail.id).toBe(threadId);
		expect(detail.subject).toBe("Invoices");
		expect(detail.connectedAccountId).toBe(ACCOUNT_A);
		expect(detail.accountEmail).toBe("alice@gmail.com");
		expect(detail.accountStatus).toBe("active");
		expect(detail.archived).toBe(false);
		expect(detail.trashed).toBe(false);

		// Oldest first.
		expect(detail.messages.map((m) => m.preview)).toEqual([
			"the opener",
			"the reply",
		]);

		const opener = detail.messages[0];
		if (!opener) throw new Error("expected opener message");
		expect(opener.bodyState).toBe("fetched");
		expect(opener.spamFlaggedAtIngest).toBe(true);
		expect(opener.sentAt).toBe(new Date(1781000000000).toISOString());
		expect(opener.attachments).toEqual([
			{
				id: expect.any(String),
				filename: "invoice.pdf",
				mimeType: "application/pdf",
				sizeBytes: 52341,
				bytesState: "metadata_only",
			},
		]);

		const reply = detail.messages[1];
		if (!reply) throw new Error("expected reply message");
		expect(reply.bodyState).toBe("preview_only");
		expect(reply.to).toEqual([{ email: "alice@gmail.com", name: "Alice" }]);
		expect(reply.attachments).toEqual([]);
	});

	it("throws ThreadNotFoundError for another user's thread id", async () => {
		const foreignId = await seedThread(db, {
			userId: OTHER_USER_ID,
			connectedAccountId: ACCOUNT_OTHER,
		});

		expect(getThreadDetail(USER_ID, foreignId, db)).rejects.toBeInstanceOf(
			ThreadNotFoundError,
		);
	});

	it("throws ThreadNotFoundError for an unknown thread id", async () => {
		expect(getThreadDetail(USER_ID, "missing", db)).rejects.toBeInstanceOf(
			ThreadNotFoundError,
		);
	});

	it("still resolves hidden threads by id (recovery path needs detail)", async () => {
		const hiddenId = await seedThread(db, { state: "hidden", category: null });

		const detail = await getThreadDetail(USER_ID, hiddenId, db);
		expect(detail.state).toBe("hidden");
	});
});
