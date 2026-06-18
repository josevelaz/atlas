/**
 * Read-side mail queries: thread lists per view and thread detail.
 *
 * Thread-first model (see `services/ingestion/ingest.ts`): the unit of
 * listing is always the thread row, never individual messages. Views map
 * onto `thread.state` / `thread.category`:
 *
 *   - `screener`            → state = "screener"
 *   - `spam`                → state = "spam" (its own queue — never mixed
 *                             into the screener)
 *   - `inbox|feed|paper_trail` → state = "categorized" AND category = view
 *
 * `hidden` threads (recoverable rejected-sender path) are NEVER returned by
 * any view — they are only reachable through the dedicated screener
 * recovery endpoints. Trashed and archived threads are likewise excluded
 * from every view.
 *
 * Provenance is always present: every list row and the detail payload carry
 * `connectedAccountId`, the account's `accountEmail`, and the account
 * `status` (so the UI can explain read-only/disconnected sources).
 * Disconnected accounts' threads stay queryable — disconnect retains data
 * read-only by design.
 *
 * Lists are unified across all of the user's connected accounts by default;
 * an optional `accountId` (a `connected_account.id`) narrows to one account
 * and 404s (via {@link MailAccountNotFoundError}) when the account does not
 * exist or belongs to another user — deliberately indistinguishable.
 *
 * Pagination: keyset cursor on (last_message_at DESC, id DESC). The cursor
 * is an opaque base64url token; a null `last_message_at` sorts last
 * (treated as 0). Page size defaults to {@link DEFAULT_PAGE_SIZE}, capped
 * at {@link MAX_PAGE_SIZE}.
 *
 * Testability: no db work at import time — the default client resolves
 * lazily and every query accepts an injectable `dbClient`.
 */

import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";

import { attachment, connectedAccount, message, thread } from "../db/schema.ts";

type Db = typeof import("../db/index.ts")["db"];

let defaultDb: Db | undefined;

const getDb = async (): Promise<Db> => {
	if (!defaultDb) {
		({ db: defaultDb } = await import("../db/index.ts"));
	}
	return defaultDb;
};

/** The five list views. `hidden` is intentionally not a view. */
export const MAIL_VIEWS = [
	"inbox",
	"feed",
	"paper_trail",
	"screener",
	"spam",
] as const;

export type MailView = (typeof MAIL_VIEWS)[number];

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

/** Thread does not exist or belongs to another user (indistinguishable). */
export class ThreadNotFoundError extends Error {
	readonly code = "THREAD_NOT_FOUND";

	constructor(threadId: string) {
		super(`Thread not found: ${threadId}`);
		this.name = "ThreadNotFoundError";
	}
}

/**
 * `accountId` filter does not match a connected account owned by the user
 * (missing and foreign ids are deliberately indistinguishable).
 */
export class MailAccountNotFoundError extends Error {
	readonly code = "MAIL_ACCOUNT_NOT_FOUND";

	constructor(accountId: string) {
		super(`Connected account not found: ${accountId}`);
		this.name = "MailAccountNotFoundError";
	}
}

/** Cursor token is not one this server issued. */
export class InvalidCursorError extends Error {
	readonly code = "INVALID_CURSOR";

	constructor() {
		super("Invalid cursor");
		this.name = "InvalidCursorError";
	}
}

type ThreadState = (typeof thread.$inferSelect)["state"];
type ThreadCategory = NonNullable<(typeof thread.$inferSelect)["category"]>;
type AccountStatus = (typeof connectedAccount.$inferSelect)["status"];
type BodyState = (typeof message.$inferSelect)["bodyState"];
type BytesState = (typeof attachment.$inferSelect)["bytesState"];

export interface ThreadListItemDto {
	id: string;
	state: ThreadState;
	category: ThreadCategory | null;
	categoryOverridden: boolean;
	senderEmail: string;
	subject: string | null;
	preview: string | null;
	/** ISO 8601, or null when no message aggregate landed yet. */
	lastMessageAt: string | null;
	messageCount: number;
	read: boolean;
	/** Provenance — always present. */
	connectedAccountId: string;
	/** Provenance — the connected mailbox address. */
	accountEmail: string;
	/** Provenance — "disconnected" sources are read-only. */
	accountStatus: AccountStatus;
}

export interface ThreadListPage {
	threads: ThreadListItemDto[];
	/** Pass back as `cursor` to fetch the next page; null on the last page. */
	nextCursor: string | null;
}

export interface AttachmentDto {
	id: string;
	filename: string | null;
	mimeType: string | null;
	sizeBytes: number | null;
	bytesState: BytesState;
}

export interface MessageDto {
	id: string;
	fromEmail: string;
	fromName: string | null;
	to: Array<{ email: string; name?: string }> | null;
	/** ISO 8601. */
	sentAt: string;
	preview: string | null;
	bodyState: BodyState;
	spamFlaggedAtIngest: boolean;
	attachments: AttachmentDto[];
}

export interface ThreadDetailDto extends ThreadListItemDto {
	archived: boolean;
	trashed: boolean;
	/** Oldest first. */
	messages: MessageDto[];
}

export interface ListThreadsOptions {
	view: MailView;
	/** Narrow to one `connected_account.id`; unified across accounts when omitted. */
	accountId?: string;
	cursor?: string;
	limit?: number;
}

interface CursorPayload {
	/** `last_message_at` of the last row, epoch ms (0 when null). */
	t: number;
	/** Thread id tiebreak. */
	id: string;
}

export const encodeCursor = (lastMessageAtMs: number, id: string): string =>
	Buffer.from(JSON.stringify({ t: lastMessageAtMs, id })).toString("base64url");

export const decodeCursor = (raw: string): CursorPayload => {
	try {
		const parsed: unknown = JSON.parse(
			Buffer.from(raw, "base64url").toString("utf8"),
		);
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			typeof (parsed as CursorPayload).t === "number" &&
			Number.isFinite((parsed as CursorPayload).t) &&
			typeof (parsed as CursorPayload).id === "string" &&
			(parsed as CursorPayload).id.length > 0
		) {
			return {
				t: (parsed as CursorPayload).t,
				id: (parsed as CursorPayload).id,
			};
		}
	} catch {
		// fall through to the typed error below
	}
	throw new InvalidCursorError();
};

/** WHERE fragment for one view (hidden/trashed/archived always excluded). */
const viewCondition = (view: MailView) => {
	if (view === "screener" || view === "spam") {
		return eq(thread.state, view);
	}
	return and(eq(thread.state, "categorized"), eq(thread.category, view));
};

const sortKeyMs = (lastMessageAt: Date | null): number =>
	lastMessageAt ? lastMessageAt.getTime() : 0;

/**
 * List one page of a user's threads for a view, newest activity first.
 *
 * Throws {@link MailAccountNotFoundError} when `accountId` is not one of
 * the user's connected accounts and {@link InvalidCursorError} for a
 * malformed cursor token.
 */
export const listThreads = async (
	userId: string,
	options: ListThreadsOptions,
	dbClient?: Db,
): Promise<ThreadListPage> => {
	const db = dbClient ?? (await getDb());

	if (options.accountId !== undefined) {
		const owned = await db
			.select({ id: connectedAccount.id })
			.from(connectedAccount)
			.where(
				and(
					eq(connectedAccount.id, options.accountId),
					eq(connectedAccount.userId, userId),
				),
			)
			.limit(1);
		if (!owned[0]) {
			throw new MailAccountNotFoundError(options.accountId);
		}
	}

	const limit = Math.min(
		Math.max(Math.trunc(options.limit ?? DEFAULT_PAGE_SIZE), 1),
		MAX_PAGE_SIZE,
	);

	// Keyset sort expression: null last_message_at sorts last under DESC.
	const sortExpr = sql`coalesce(${thread.lastMessageAt}, 0)`;

	const conditions = [
		eq(thread.userId, userId),
		viewCondition(options.view),
		eq(thread.trashed, false),
		eq(thread.archived, false),
	];
	if (options.accountId !== undefined) {
		conditions.push(eq(thread.connectedAccountId, options.accountId));
	}
	if (options.cursor !== undefined) {
		const cursor = decodeCursor(options.cursor);
		conditions.push(
			or(
				sql`${sortExpr} < ${cursor.t}`,
				and(sql`${sortExpr} = ${cursor.t}`, sql`${thread.id} < ${cursor.id}`),
			),
		);
	}

	const rows = await db
		.select({
			id: thread.id,
			state: thread.state,
			category: thread.category,
			categoryOverridden: thread.categoryOverridden,
			senderEmail: thread.senderEmail,
			subject: thread.subject,
			preview: thread.preview,
			lastMessageAt: thread.lastMessageAt,
			messageCount: thread.messageCount,
			read: thread.read,
			connectedAccountId: thread.connectedAccountId,
			accountEmail: connectedAccount.emailAddress,
			accountStatus: connectedAccount.status,
		})
		.from(thread)
		.innerJoin(
			connectedAccount,
			eq(thread.connectedAccountId, connectedAccount.id),
		)
		.where(and(...conditions))
		.orderBy(desc(sortExpr), desc(thread.id))
		.limit(limit + 1);

	const hasMore = rows.length > limit;
	const page = hasMore ? rows.slice(0, limit) : rows;
	const lastRow = page[page.length - 1];

	return {
		threads: page.map((row) => ({
			...row,
			lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
		})),
		nextCursor:
			hasMore && lastRow
				? encodeCursor(sortKeyMs(lastRow.lastMessageAt), lastRow.id)
				: null,
	};
};

/**
 * Fetch one thread with its messages (oldest first) and attachment
 * METADATA. Ownership is strict: ids that do not exist and ids owned by
 * other users both throw {@link ThreadNotFoundError}.
 *
 * Deliberate choice: detail-by-id works for ANY owned thread regardless of
 * state — including `hidden`, trashed, and archived — because recovery and
 * trash UIs need it. Views (not detail) are where hidden is excluded.
 */
export const getThreadDetail = async (
	userId: string,
	threadId: string,
	dbClient?: Db,
): Promise<ThreadDetailDto> => {
	const db = dbClient ?? (await getDb());

	const threadRows = await db
		.select({
			id: thread.id,
			userId: thread.userId,
			state: thread.state,
			category: thread.category,
			categoryOverridden: thread.categoryOverridden,
			senderEmail: thread.senderEmail,
			subject: thread.subject,
			preview: thread.preview,
			lastMessageAt: thread.lastMessageAt,
			messageCount: thread.messageCount,
			read: thread.read,
			archived: thread.archived,
			trashed: thread.trashed,
			connectedAccountId: thread.connectedAccountId,
			accountEmail: connectedAccount.emailAddress,
			accountStatus: connectedAccount.status,
		})
		.from(thread)
		.innerJoin(
			connectedAccount,
			eq(thread.connectedAccountId, connectedAccount.id),
		)
		.where(eq(thread.id, threadId))
		.limit(1);

	const threadRow = threadRows[0];
	if (!threadRow || threadRow.userId !== userId) {
		throw new ThreadNotFoundError(threadId);
	}

	const messageRows = await db
		.select({
			id: message.id,
			fromEmail: message.fromEmail,
			fromName: message.fromName,
			toJson: message.toJson,
			sentAt: message.sentAt,
			preview: message.preview,
			bodyState: message.bodyState,
			spamFlaggedAtIngest: message.spamFlaggedAtIngest,
		})
		.from(message)
		.where(eq(message.threadId, threadRow.id))
		.orderBy(asc(message.sentAt), asc(message.id));

	const attachmentRows =
		messageRows.length > 0
			? await db
					.select({
						id: attachment.id,
						messageId: attachment.messageId,
						filename: attachment.filename,
						mimeType: attachment.mimeType,
						sizeBytes: attachment.sizeBytes,
						bytesState: attachment.bytesState,
					})
					.from(attachment)
					.where(
						inArray(
							attachment.messageId,
							messageRows.map((row) => row.id),
						),
					)
					.orderBy(asc(attachment.id))
			: [];

	const attachmentsByMessage = new Map<string, AttachmentDto[]>();
	for (const row of attachmentRows) {
		const list = attachmentsByMessage.get(row.messageId) ?? [];
		list.push({
			id: row.id,
			filename: row.filename,
			mimeType: row.mimeType,
			sizeBytes: row.sizeBytes,
			bytesState: row.bytesState,
		});
		attachmentsByMessage.set(row.messageId, list);
	}

	const { userId: _owner, ...threadDto } = threadRow;

	return {
		...threadDto,
		lastMessageAt: threadRow.lastMessageAt?.toISOString() ?? null,
		messages: messageRows.map((row) => ({
			id: row.id,
			fromEmail: row.fromEmail,
			fromName: row.fromName,
			to: row.toJson,
			sentAt: row.sentAt.toISOString(),
			preview: row.preview,
			bodyState: row.bodyState,
			spamFlaggedAtIngest: row.spamFlaggedAtIngest,
			attachments: attachmentsByMessage.get(row.id) ?? [],
		})),
	};
};
