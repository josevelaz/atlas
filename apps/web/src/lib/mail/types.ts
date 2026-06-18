/**
 * Mail DTOs — mirror the server's Phase 6 mail/screener endpoints exactly.
 *
 * Server contract (apps/server/src/routes/mail/threads.ts,
 * apps/server/src/routes/screener.ts):
 *   GET  /mail/threads?view=…&accountId?&cursor?&limit?
 *                                       → ThreadListPage
 *   GET  /mail/threads/:id              → ThreadDetailDto
 *   POST /mail/threads/:id/category {category, promote?}
 *                                       → OverrideThreadCategoryResult
 *   POST /screener/senders/:email/accept {category}
 *                                       → AcceptSenderResult
 *   POST /screener/senders/:email/reject
 *                                       → RejectSenderResult
 *   GET  /screener/rejected             → { senders: RejectedSenderDto[] }
 *   POST /screener/senders/:email/recover {category, restoreHidden?}
 *                                       → RecoverSenderResult
 *
 * These mirror the server-side shapes in `apps/server/src/services/*`.
 * This module is independent of `lib/atlas/**` by design — the query layer
 * (`./queries`) maps these DTOs onto the UI's `lib/atlas/types` view shapes.
 */

/** The server's list views. `hidden` is intentionally not a view. */
export type MailView = "inbox" | "feed" | "paper_trail" | "screener" | "spam";

/** The three categories a thread/sender can be routed into. */
export type ServerMailCategory = "inbox" | "feed" | "paper_trail";

/** Persistence state of a thread (mirrors `thread.state` on the server). */
export type ThreadState = "screener" | "categorized" | "hidden" | "spam";

/** Connected-account status — "disconnected" sources are read-only. */
export type AccountStatus = "connected" | "disconnected" | string;

/** Lazy body/attachment fetch state (mirrors `message.bodyState`). */
export type BodyState = "none" | "preview" | "full" | string;

/** Attachment byte-availability state (mirrors `attachment.bytesState`). */
export type BytesState = "none" | "stored" | string;

/** One thread row in any view list. Provenance fields are always present. */
export interface ThreadListItemDto {
	id: string;
	state: ThreadState;
	category: ServerMailCategory | null;
	categoryOverridden: boolean;
	senderEmail: string;
	subject: string | null;
	preview: string | null;
	/** ISO 8601, or null when no message aggregate landed yet. */
	lastMessageAt: string | null;
	messageCount: number;
	read: boolean;
	/** Provenance — owning connected-account id. */
	connectedAccountId: string;
	/** Provenance — the connected mailbox address. */
	accountEmail: string;
	/** Provenance — "disconnected" sources are read-only. */
	accountStatus: AccountStatus;
}

/** One page of threads, with an opaque keyset cursor for the next page. */
export interface ThreadListPage {
	threads: ThreadListItemDto[];
	/** Pass back as `cursor` to fetch the next page; null on the last page. */
	nextCursor: string | null;
}

/** Attachment metadata on a message (bytes fetched lazily). */
export interface AttachmentDto {
	id: string;
	filename: string | null;
	mimeType: string | null;
	sizeBytes: number | null;
	bytesState: BytesState;
}

/** One message inside a thread. Body content is fetched lazily (`bodyState`). */
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

/** Thread detail: the list row plus archived/trashed flags and messages. */
export interface ThreadDetailDto extends ThreadListItemDto {
	archived: boolean;
	trashed: boolean;
	/** Oldest first. */
	messages: MessageDto[];
}

/** Result of `POST /screener/senders/:email/accept`. */
export interface AcceptSenderResult {
	emailAddress: string;
	/** Screener threads moved to `categorized` (across all accounts). */
	movedThreadCount: number;
}

/** Result of `POST /screener/senders/:email/reject`. */
export interface RejectSenderResult {
	emailAddress: string;
	/** Screener threads moved to `hidden` (across all accounts). */
	hiddenThreadCount: number;
}

/** One rejected sender, for the recovery UI. */
export interface RejectedSenderDto {
	emailAddress: string;
	/** ISO 8601, or null for legacy rows without a decision timestamp. */
	decidedAt: string | null;
	/** Currently hidden threads from this sender (across all accounts). */
	hiddenThreadCount: number;
}

/** Response body of `GET /screener/rejected`. */
export interface RejectedSendersResponse {
	senders: RejectedSenderDto[];
}

/** Result of `POST /screener/senders/:email/recover`. */
export interface RecoverSenderResult {
	emailAddress: string;
	/** Hidden threads restored to `categorized` (0 unless `restoreHidden`). */
	restoredThreadCount: number;
}

/** Result of `POST /mail/threads/:id/category`. */
export interface OverrideThreadCategoryResult {
	id: string;
	state: "categorized";
	category: ServerMailCategory;
	categoryOverridden: true;
	/** Whether the sender's user-global routing rule was updated. */
	promotedSender: boolean;
}
