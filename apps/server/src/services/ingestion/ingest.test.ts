import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "../../db/schema.ts";
import type { GmailMessage } from "../gmail/client.ts";
import { type IngestAccount, ingestMessages } from "./ingest.ts";

const MIGRATIONS_FOLDER = join(import.meta.dir, "../../../drizzle");

const USER_ID = "user-1";
const AUTH_ACCOUNT_ID = "auth-acc-1";
const CONNECTED_ACCOUNT_ID = "ca-1";

const ACCOUNT: IngestAccount = {
	id: CONNECTED_ACCOUNT_ID,
	userId: USER_ID,
};

/**
 * Real libsql db (temp file) with the actual migrations applied. A file —
 * not `:memory:` — because the libsql client drops its connection after
 * every `transaction()` call, which would discard an in-memory database.
 */
const TEST_DB_DIR = mkdtempSync(join(tmpdir(), "atlas-ingest-test-"));
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
	await db.insert(schema.connectedAccount).values({
		id: CONNECTED_ACCOUNT_ID,
		userId: USER_ID,
		authAccountId: AUTH_ACCOUNT_ID,
		provider: "gmail",
		emailAddress: "alice@gmail.com",
		status: "active",
		syncState: "pending",
	});

	return db;
};

type TestDb = Awaited<ReturnType<typeof makeDb>>;

interface MessageFixture {
	id: string;
	threadId: string;
	from?: string;
	to?: string;
	subject?: string;
	snippet?: string;
	labelIds?: string[];
	internalDate?: string;
	messageIdHeader?: string;
	inReplyTo?: string;
	payloadExtras?: Partial<NonNullable<GmailMessage["payload"]>>;
}

const gmailMessage = (fixture: MessageFixture): GmailMessage => {
	const headers = [
		{ name: "From", value: fixture.from ?? "Bob Sender <bob@example.com>" },
		{ name: "To", value: fixture.to ?? "Alice <alice@gmail.com>" },
		{ name: "Subject", value: fixture.subject ?? "Hello" },
		{ name: "Date", value: "Thu, 11 Jun 2026 10:00:00 +0000" },
		{
			name: "Message-ID",
			value: fixture.messageIdHeader ?? `<${fixture.id}@mail.example.com>`,
		},
		...(fixture.inReplyTo
			? [{ name: "In-Reply-To", value: fixture.inReplyTo }]
			: []),
	];
	return {
		id: fixture.id,
		threadId: fixture.threadId,
		labelIds: fixture.labelIds ?? ["INBOX"],
		snippet: fixture.snippet ?? `snippet of ${fixture.id}`,
		internalDate: fixture.internalDate ?? "1781000000000",
		payload: { headers, ...fixture.payloadExtras },
	};
};

const listThreads = (db: TestDb) => db.select().from(schema.thread);
const listMessages = (db: TestDb) => db.select().from(schema.message);
const listAttachments = (db: TestDb) => db.select().from(schema.attachment);
const listSenders = (db: TestDb) => db.select().from(schema.sender);

const getSender = async (db: TestDb, email: string) => {
	const rows = await db
		.select()
		.from(schema.sender)
		.where(
			and(
				eq(schema.sender.userId, USER_ID),
				eq(schema.sender.emailAddress, email),
			),
		);
	return rows[0] ?? null;
};

describe("ingestMessages", () => {
	let db: TestDb;

	beforeEach(async () => {
		db = await makeDb();
	});

	it("lands a new thread from an unscreened sender in the screener and creates the sender row", async () => {
		const results = await ingestMessages(
			ACCOUNT,
			[gmailMessage({ id: "m1", threadId: "t1", subject: "Welcome" })],
			{ db },
		);

		expect(results).toEqual([
			{
				providerMessageId: "m1",
				outcome: "ingested_new_thread",
				threadId: expect.any(String),
			},
		]);

		const threads = await listThreads(db);
		expect(threads).toHaveLength(1);
		const threadRow = threads[0];
		if (!threadRow) throw new Error("expected a thread row");
		expect(threadRow.state).toBe("screener");
		expect(threadRow.category).toBeNull();
		expect(threadRow.providerThreadId).toBe("t1");
		expect(threadRow.senderEmail).toBe("bob@example.com");
		expect(threadRow.subject).toBe("Welcome");
		expect(threadRow.preview).toBe("snippet of m1");
		expect(threadRow.messageCount).toBe(1);
		expect(threadRow.lastMessageAt?.getTime()).toBe(1781000000000);

		const senderRow = await getSender(db, "bob@example.com");
		expect(senderRow?.trust).toBe("unscreened");
		expect(senderRow?.defaultCategory).toBeNull();

		const messages = await listMessages(db);
		expect(messages).toHaveLength(1);
		const messageRow = messages[0];
		if (!messageRow) throw new Error("expected a message row");
		expect(messageRow.threadId).toBe(threadRow.id);
		expect(messageRow.fromEmail).toBe("bob@example.com");
		expect(messageRow.fromName).toBe("Bob Sender");
		expect(messageRow.toJson).toEqual([
			{ email: "alice@gmail.com", name: "Alice" },
		]);
		expect(messageRow.preview).toBe("snippet of m1");
		expect(messageRow.bodyState).toBe("preview_only");
		expect(messageRow.bodyRef).toBeNull();
		expect(messageRow.spamFlaggedAtIngest).toBe(false);
		expect(messageRow.rfc822MessageId).toBe("<m1@mail.example.com>");
	});

	it("re-ingesting the same batch is a no-op", async () => {
		const batch = [
			gmailMessage({ id: "m1", threadId: "t1" }),
			gmailMessage({ id: "m2", threadId: "t1", internalDate: "1781000060000" }),
			gmailMessage({
				id: "m3",
				threadId: "t2",
				from: "Carol <carol@example.com>",
			}),
		];

		const first = await ingestMessages(ACCOUNT, batch, { db });
		expect(first.map((r) => r.outcome)).toEqual([
			"ingested_new_thread",
			"ingested_into_existing_thread",
			"ingested_new_thread",
		]);

		const threadsBefore = await listThreads(db);
		const messagesBefore = await listMessages(db);
		const sendersBefore = await listSenders(db);

		const second = await ingestMessages(ACCOUNT, batch, { db });
		expect(second.map((r) => r.outcome)).toEqual([
			"skipped_duplicate",
			"skipped_duplicate",
			"skipped_duplicate",
		]);

		expect(await listThreads(db)).toEqual(threadsBefore);
		expect(await listMessages(db)).toEqual(messagesBefore);
		expect(await listSenders(db)).toEqual(sendersBefore);
	});

	it("lands a spam-flagged new thread in spam, even from an accepted sender", async () => {
		await db.insert(schema.sender).values({
			userId: USER_ID,
			emailAddress: "bob@example.com",
			trust: "accepted",
			defaultCategory: "inbox",
		});

		const results = await ingestMessages(
			ACCOUNT,
			[gmailMessage({ id: "m1", threadId: "t1", labelIds: ["SPAM"] })],
			{ db },
		);

		expect(results[0]?.outcome).toBe("ingested_new_thread");
		const threads = await listThreads(db);
		expect(threads[0]?.state).toBe("spam");
		expect(threads[0]?.category).toBeNull();
		const messages = await listMessages(db);
		expect(messages[0]?.spamFlaggedAtIngest).toBe(true);
	});

	it("persists a rejected-sender new thread as hidden", async () => {
		await db.insert(schema.sender).values({
			userId: USER_ID,
			emailAddress: "bob@example.com",
			trust: "rejected",
		});

		const results = await ingestMessages(
			ACCOUNT,
			[gmailMessage({ id: "m1", threadId: "t1" })],
			{ db },
		);

		expect(results[0]?.outcome).toBe("ingested_new_thread");
		const threads = await listThreads(db);
		expect(threads).toHaveLength(1);
		expect(threads[0]?.state).toBe("hidden");
		expect(threads[0]?.category).toBeNull();
		// Persisted (retained), not skipped — the message row exists.
		expect(await listMessages(db)).toHaveLength(1);
		// The rejected verdict is untouched by ingest.
		expect((await getSender(db, "bob@example.com"))?.trust).toBe("rejected");
	});

	it("routes an accepted sender's new thread to their default category", async () => {
		await db.insert(schema.sender).values({
			userId: USER_ID,
			emailAddress: "bob@example.com",
			trust: "accepted",
			defaultCategory: "feed",
		});

		await ingestMessages(
			ACCOUNT,
			[gmailMessage({ id: "m1", threadId: "t1" })],
			{ db },
		);

		const threads = await listThreads(db);
		expect(threads[0]?.state).toBe("categorized");
		expect(threads[0]?.category).toBe("feed");
	});

	it("joins a reply into the existing thread without changing its state", async () => {
		await ingestMessages(
			ACCOUNT,
			[
				gmailMessage({
					id: "m1",
					threadId: "t1",
					internalDate: "1781000000000",
				}),
			],
			{ db },
		);

		const replies = await ingestMessages(
			ACCOUNT,
			[
				gmailMessage({
					id: "m2",
					threadId: "t1",
					from: "Dora <dora@example.com>",
					snippet: "the reply",
					internalDate: "1781000060000",
					inReplyTo: "<m1@mail.example.com>",
				}),
			],
			{ db },
		);

		expect(replies[0]?.outcome).toBe("ingested_into_existing_thread");

		const threads = await listThreads(db);
		expect(threads).toHaveLength(1);
		const threadRow = threads[0];
		if (!threadRow) throw new Error("expected a thread row");
		// Still in the screener — a reply never re-routes the thread.
		expect(threadRow.state).toBe("screener");
		expect(threadRow.messageCount).toBe(2);
		expect(threadRow.lastMessageAt?.getTime()).toBe(1781000060000);
		expect(threadRow.preview).toBe("the reply");

		const messages = await listMessages(db);
		expect(messages).toHaveLength(2);
		expect(new Set(messages.map((m) => m.threadId))).toEqual(
			new Set([threadRow.id]),
		);

		// A reply does NOT screen its sender for future new threads.
		expect(await getSender(db, "dora@example.com")).toBeNull();
	});

	it("skips messages trashed at initial ingest entirely", async () => {
		const results = await ingestMessages(
			ACCOUNT,
			[gmailMessage({ id: "m1", threadId: "t1", labelIds: ["TRASH"] })],
			{ db },
		);

		expect(results).toEqual([
			{ providerMessageId: "m1", outcome: "skipped_trashed", threadId: null },
		]);
		expect(await listThreads(db)).toHaveLength(0);
		expect(await listMessages(db)).toHaveLength(0);
		expect(await listSenders(db)).toHaveLength(0);
	});

	it("stores attachment metadata only — no bytes, no body", async () => {
		const results = await ingestMessages(
			ACCOUNT,
			[
				gmailMessage({
					id: "m1",
					threadId: "t1",
					payloadExtras: {
						parts: [
							{ partId: "0", mimeType: "text/plain", body: { size: 120 } },
							{
								partId: "1",
								mimeType: "application/pdf",
								filename: "invoice.pdf",
								body: { attachmentId: "att-1", size: 52341 },
							},
							{
								partId: "2",
								mimeType: "multipart/mixed",
								parts: [
									{
										partId: "2.0",
										mimeType: "image/png",
										filename: "chart.png",
										body: { attachmentId: "att-2", size: 9001 },
									},
								],
							},
						],
					},
				}),
			],
			{ db },
		);

		expect(results[0]?.outcome).toBe("ingested_new_thread");

		const attachments = await listAttachments(db);
		expect(attachments).toHaveLength(2);
		expect(attachments.map((a) => a.providerAttachmentId).sort()).toEqual([
			"att-1",
			"att-2",
		]);
		for (const row of attachments) {
			expect(row.bytesState).toBe("metadata_only");
			expect(row.storageRef).toBeNull();
		}
		const pdf = attachments.find((a) => a.providerAttachmentId === "att-1");
		expect(pdf?.filename).toBe("invoice.pdf");
		expect(pdf?.mimeType).toBe("application/pdf");
		expect(pdf?.sizeBytes).toBe(52341);

		const messages = await listMessages(db);
		expect(messages[0]?.bodyState).toBe("preview_only");
		expect(messages[0]?.bodyRef).toBeNull();

		// Re-ingest: attachments are not duplicated.
		await ingestMessages(
			ACCOUNT,
			[gmailMessage({ id: "m1", threadId: "t1" })],
			{ db },
		);
		expect(await listAttachments(db)).toHaveLength(2);
	});

	it("ingests a spam-flagged reply into its existing thread as-is", async () => {
		await ingestMessages(
			ACCOUNT,
			[gmailMessage({ id: "m1", threadId: "t1" })],
			{ db },
		);

		const results = await ingestMessages(
			ACCOUNT,
			[gmailMessage({ id: "m2", threadId: "t1", labelIds: ["SPAM"] })],
			{ db },
		);

		expect(results[0]?.outcome).toBe("ingested_into_existing_thread");
		const threads = await listThreads(db);
		expect(threads).toHaveLength(1);
		expect(threads[0]?.state).toBe("screener");
		const messages = await listMessages(db);
		expect(messages).toHaveLength(2);
		expect(
			messages.find((m) => m.providerMessageId === "m2")?.spamFlaggedAtIngest,
		).toBe(true);
	});

	it("never regresses thread aggregates on an out-of-order older message", async () => {
		await ingestMessages(
			ACCOUNT,
			[
				gmailMessage({
					id: "m2",
					threadId: "t1",
					snippet: "newest",
					internalDate: "1781000060000",
				}),
			],
			{ db },
		);

		await ingestMessages(
			ACCOUNT,
			[
				gmailMessage({
					id: "m1",
					threadId: "t1",
					snippet: "older",
					internalDate: "1781000000000",
				}),
			],
			{ db },
		);

		const threads = await listThreads(db);
		const threadRow = threads[0];
		expect(threadRow?.messageCount).toBe(2);
		expect(threadRow?.lastMessageAt?.getTime()).toBe(1781000060000);
		expect(threadRow?.preview).toBe("newest");
	});
});
