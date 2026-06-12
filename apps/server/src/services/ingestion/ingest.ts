/**
 * Idempotent ingest persistence for Gmail message METADATA (headers,
 * snippet/preview, attachment metadata) — never body parts.
 *
 * `ingestMessages(account, messages)` processes each already-fetched
 * `format=metadata` Gmail message in its OWN transaction, so a partially
 * applied batch is always safe to retry: every step is an upsert or a
 * unique-key-guarded insert, and re-running the same batch is a no-op.
 *
 * Per message:
 *  1. Look up an existing thread (connected_account_id, provider_thread_id)
 *     and the sender trust row (user_id, from email), then ask the pure
 *     routing engine ({@link routeIncomingMessage}) where the message goes.
 *     Routing rules live there — this module never re-encodes them.
 *  2. New-thread initiators get a sender row upserted with the `unscreened`
 *     default (insert-if-missing; existing trust rows are never modified).
 *  3. Threads follow the thread-first model: the thread row is created from
 *     the first message seen, unique on (connected_account_id,
 *     provider_thread_id) — a conflicting concurrent insert resolves to the
 *     surviving row and the message simply joins it.
 *  4. The message row is unique on (connected_account_id,
 *     provider_message_id); an insert conflict means the message was already
 *     ingested and the whole step is skipped (no aggregate drift).
 *  5. Attachment METADATA rows (`bytes_state: "metadata_only"`) are inserted
 *     only alongside a newly inserted message, keeping them idempotent
 *     without their own unique key.
 *  6. Thread aggregates (message_count, last_message_at, preview) are
 *     updated only when the message row was actually inserted.
 *
 * Spam/trash policy: Gmail SPAM/TRASH labels are read ONCE here, at initial
 * ingest (`spam_flagged_at_ingest` on the message row). Later label-change
 * history events are ignored by design — there is no re-evaluation path.
 *
 * Storage policy: headers, snippet (as `preview`), and attachment metadata
 * only. `body_state` stays `preview_only` and `body_ref`/`storage_ref` stay
 * null — message bodies and attachment bytes are fetched on demand later.
 */

import { and, eq, sql } from "drizzle-orm";

import { attachment, message, sender, thread } from "../../db/schema.ts";
import type { GmailMessage, GmailMessagePart } from "../gmail/client.ts";
import { routeIncomingMessage } from "./routing.ts";

/** Gmail system labels consulted once, at initial ingest only. */
const SPAM_LABEL = "SPAM";
const TRASH_LABEL = "TRASH";

type Db = typeof import("../../db/index.ts")["db"];
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

let defaultDb: Db | undefined;

const getDb = async (): Promise<Db> => {
	if (!defaultDb) {
		({ db: defaultDb } = await import("../../db/index.ts"));
	}
	return defaultDb;
};

/** The slice of a `connected_account` row ingest needs. */
export interface IngestAccount {
	id: string;
	userId: string;
}

export interface IngestDeps {
	/** Injectable db (defaults to the app db, resolved lazily). */
	db?: Db;
}

/** What happened to one message of the batch. */
export type IngestMessageOutcome =
	/** New thread created (screener / spam / hidden / categorized). */
	| "ingested_new_thread"
	/** Reply joined an already-ingested thread; thread state untouched. */
	| "ingested_into_existing_thread"
	/** provider_message_id already ingested — nothing written. */
	| "skipped_duplicate"
	/** Trashed at initial ingest — never persisted. */
	| "skipped_trashed";

export interface IngestMessageResult {
	providerMessageId: string;
	outcome: IngestMessageOutcome;
	/** Null only for `skipped_trashed`. */
	threadId: string | null;
}

interface ParsedAddress {
	email: string;
	name?: string;
}

/** Parse one RFC 5322 mailbox: `"Name" <a@b>`, `Name <a@b>`, or `a@b`. */
const parseAddress = (raw: string): ParsedAddress | null => {
	const trimmed = raw.trim();
	const angled = trimmed.match(/<([^>]+)>/);
	if (angled?.[1]) {
		const email = angled[1].trim().toLowerCase();
		if (!email) return null;
		const name = trimmed
			.slice(0, angled.index)
			.trim()
			.replace(/^"(.*)"$/, "$1")
			.trim();
		return name ? { email, name } : { email };
	}
	if (trimmed.includes("@")) {
		return { email: trimmed.toLowerCase() };
	}
	return null;
};

/** Split an address-list header on top-level commas (quote/angle aware). */
const splitAddressList = (raw: string): string[] => {
	const parts: string[] = [];
	let current = "";
	let inQuotes = false;
	let inAngle = false;
	for (const ch of raw) {
		if (ch === '"') inQuotes = !inQuotes;
		else if (ch === "<" && !inQuotes) inAngle = true;
		else if (ch === ">" && !inQuotes) inAngle = false;
		if (ch === "," && !inQuotes && !inAngle) {
			parts.push(current);
			current = "";
			continue;
		}
		current += ch;
	}
	parts.push(current);
	return parts.map((part) => part.trim()).filter(Boolean);
};

const getHeader = (msg: GmailMessage, name: string): string | null => {
	const lower = name.toLowerCase();
	const header = msg.payload?.headers?.find(
		(h) => h.name.toLowerCase() === lower,
	);
	return header?.value ?? null;
};

/**
 * When the message was sent: Gmail `internalDate` (epoch ms) first, then the
 * `Date` header, then ingest time as the last resort (`sent_at` is NOT NULL).
 */
const resolveSentAt = (msg: GmailMessage): Date => {
	if (msg.internalDate) {
		const ms = Number(msg.internalDate);
		if (Number.isFinite(ms) && ms > 0) return new Date(ms);
	}
	const dateHeader = getHeader(msg, "Date");
	if (dateHeader) {
		const parsed = new Date(dateHeader);
		if (!Number.isNaN(parsed.getTime())) return parsed;
	}
	return new Date();
};

interface AttachmentMeta {
	providerAttachmentId: string;
	filename: string | null;
	mimeType: string | null;
	sizeBytes: number | null;
}

/** Walk the MIME part tree collecting attachment METADATA (never bytes). */
const collectAttachmentMeta = (
	part: GmailMessagePart | undefined,
	acc: AttachmentMeta[] = [],
): AttachmentMeta[] => {
	if (!part) return acc;
	if (part.body?.attachmentId) {
		acc.push({
			providerAttachmentId: part.body.attachmentId,
			filename: part.filename || null,
			mimeType: part.mimeType ?? null,
			sizeBytes: part.body.size ?? null,
		});
	}
	for (const child of part.parts ?? []) {
		collectAttachmentMeta(child, acc);
	}
	return acc;
};

/** One message, inside its own transaction. */
const ingestOne = async (
	tx: Tx,
	account: IngestAccount,
	msg: GmailMessage,
): Promise<IngestMessageResult> => {
	const labels = msg.labelIds ?? [];
	const spamFlagged = labels.includes(SPAM_LABEL);
	const trashFlagged = labels.includes(TRASH_LABEL);

	const fromHeader = getHeader(msg, "From");
	const from = fromHeader ? parseAddress(fromHeader) : null;
	// Unparseable From falls back to the raw header so the row still has a
	// sender identity; routing treats an unmatched address as unscreened.
	const fromEmail = from?.email ?? fromHeader?.trim().toLowerCase() ?? "";
	const sentAt = resolveSentAt(msg);
	const preview = msg.snippet?.trim() || null;

	const existingThreadRows = await tx
		.select({
			id: thread.id,
			state: thread.state,
			lastMessageAt: thread.lastMessageAt,
		})
		.from(thread)
		.where(
			and(
				eq(thread.connectedAccountId, account.id),
				eq(thread.providerThreadId, msg.threadId),
			),
		)
		.limit(1);
	let existingThread = existingThreadRows[0] ?? null;

	const senderRows = fromEmail
		? await tx
				.select({
					trust: sender.trust,
					defaultCategory: sender.defaultCategory,
				})
				.from(sender)
				.where(
					and(
						eq(sender.userId, account.userId),
						eq(sender.emailAddress, fromEmail),
					),
				)
				.limit(1)
		: [];
	const senderRow = senderRows[0] ?? null;

	const decision = routeIncomingMessage({
		spamFlagged,
		trashFlagged,
		sender: senderRow,
		existingThread: existingThread ? { state: existingThread.state } : null,
	});

	if (decision.action === "skip_ingest") {
		return {
			providerMessageId: msg.id,
			outcome: "skipped_trashed",
			threadId: null,
		};
	}

	let createdThread = false;
	if (decision.action === "ingest_new_thread") {
		// New-thread initiators get a sender row with the unscreened default.
		// insert-if-missing: an existing trust verdict is never modified.
		if (fromEmail) {
			await tx
				.insert(sender)
				.values({ userId: account.userId, emailAddress: fromEmail })
				.onConflictDoNothing({
					target: [sender.userId, sender.emailAddress],
				});
		}

		// Thread-first: create the thread from the first message seen.
		// Aggregates start empty; the shared apply-message step below fills
		// them so new threads and replies take the same idempotent path.
		const insertedThreads = await tx
			.insert(thread)
			.values({
				userId: account.userId,
				connectedAccountId: account.id,
				providerThreadId: msg.threadId,
				state: decision.threadState,
				category: decision.category,
				senderEmail: fromEmail,
				subject: getHeader(msg, "Subject"),
				messageCount: 0,
			})
			.onConflictDoNothing({
				target: [thread.connectedAccountId, thread.providerThreadId],
			})
			.returning({
				id: thread.id,
				state: thread.state,
				lastMessageAt: thread.lastMessageAt,
			});

		const insertedThread = insertedThreads[0];
		if (insertedThread) {
			existingThread = insertedThread;
			createdThread = true;
		} else {
			// Lost a creation race — the thread exists now; join it instead.
			const refetched = await tx
				.select({
					id: thread.id,
					state: thread.state,
					lastMessageAt: thread.lastMessageAt,
				})
				.from(thread)
				.where(
					and(
						eq(thread.connectedAccountId, account.id),
						eq(thread.providerThreadId, msg.threadId),
					),
				)
				.limit(1);
			existingThread = refetched[0] ?? null;
		}
	}

	if (!existingThread) {
		throw new Error(
			`ingest: no thread row for provider thread ${msg.threadId}`,
		);
	}

	// Metadata + preview only: body_state stays preview_only, body_ref null.
	const insertedMessages = await tx
		.insert(message)
		.values({
			threadId: existingThread.id,
			connectedAccountId: account.id,
			providerMessageId: msg.id,
			fromEmail,
			fromName: from?.name ?? null,
			toJson: (() => {
				const toHeader = getHeader(msg, "To");
				if (!toHeader) return null;
				const recipients = splitAddressList(toHeader)
					.map(parseAddress)
					.filter((a): a is ParsedAddress => a !== null);
				return recipients.length > 0 ? recipients : null;
			})(),
			sentAt,
			preview,
			bodyState: "preview_only",
			spamFlaggedAtIngest: spamFlagged,
			rfc822MessageId: getHeader(msg, "Message-ID"),
			inReplyTo: getHeader(msg, "In-Reply-To"),
		})
		.onConflictDoNothing({
			target: [message.connectedAccountId, message.providerMessageId],
		})
		.returning({ id: message.id });

	const insertedMessage = insertedMessages[0];
	if (!insertedMessage) {
		// Already ingested — skip attachments and aggregates entirely so
		// retries of a partially applied batch never double-count.
		return {
			providerMessageId: msg.id,
			outcome: "skipped_duplicate",
			threadId: existingThread.id,
		};
	}

	const attachments = collectAttachmentMeta(msg.payload);
	if (attachments.length > 0) {
		await tx.insert(attachment).values(
			attachments.map((meta) => ({
				messageId: insertedMessage.id,
				...meta,
				bytesState: "metadata_only" as const,
			})),
		);
	}

	// Thread aggregates: count always bumps; last_message_at and preview only
	// move forward (an out-of-order older message never regresses them).
	const isNewest =
		existingThread.lastMessageAt === null ||
		sentAt.getTime() >= existingThread.lastMessageAt.getTime();
	await tx
		.update(thread)
		.set({
			messageCount: sql`${thread.messageCount} + 1`,
			...(isNewest ? { lastMessageAt: sentAt, preview } : {}),
		})
		.where(eq(thread.id, existingThread.id));

	return {
		providerMessageId: msg.id,
		outcome: createdThread
			? "ingested_new_thread"
			: "ingested_into_existing_thread",
		threadId: existingThread.id,
	};
};

/**
 * Persist a batch of already-fetched Gmail message metadata for one
 * connected account. Each message runs in its own transaction; an error on
 * message N leaves messages 1..N-1 committed and the whole batch safe to
 * re-run (every write is idempotent). Returns one result per input message,
 * in input order.
 */
export const ingestMessages = async (
	account: IngestAccount,
	messages: GmailMessage[],
	deps: IngestDeps = {},
): Promise<IngestMessageResult[]> => {
	const db = deps.db ?? (await getDb());

	const results: IngestMessageResult[] = [];
	for (const msg of messages) {
		results.push(await db.transaction((tx) => ingestOne(tx, account, msg)));
	}
	return results;
};
