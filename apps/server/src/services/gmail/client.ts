/**
 * Gmail REST client.
 *
 * Thin fetch-based wrapper over the Gmail v1 REST API — deliberately NO
 * `googleapis` dependency. Every method targets `users/me` because the
 * access token is already scoped to a single mailbox (one client instance
 * per connected account).
 *
 * Token custody: access tokens are acquired through Better Auth via
 * `auth.api.getAccessToken({ providerId: "google", accountId })`, which
 * transparently refreshes expired tokens. This client never sees or stores
 * refresh tokens.
 *
 * Error contract:
 *   - 401 → token re-acquired once and the request retried; a second 401
 *     surfaces as {@link GmailAuthError} (non-retryable — needs re-consent).
 *   - 404 on `users.history.list` → {@link HistoryGapError} (the documented
 *     "historyId too old" gap signal; caller must reset its checkpoint
 *     forward — never backfill).
 *   - 429 / 5xx → {@link GmailRetryableError} (`retryable: true`) so job
 *     infrastructure can back off and retry.
 *   - Other 4xx → {@link GmailRequestError} (non-retryable).
 *
 * Testability: this module performs NO auth/config work at import time. The
 * default token provider lazily imports `../../auth.ts` (importing eagerly
 * would trigger `config.ts` env validation). Both `fetch` and the token
 * provider are injectable.
 */

const GMAIL_BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me";

const GOOGLE_PROVIDER_ID = "google";

/**
 * Headers fetched with `format=metadata` message requests — everything the
 * ingest pipeline needs for thread-first, metadata+preview-only persistence.
 */
const DEFAULT_METADATA_HEADERS = [
	"From",
	"To",
	"Cc",
	"Subject",
	"Date",
	"Message-ID",
	"In-Reply-To",
	"References",
] as const;

/** How many message-metadata fetches run concurrently per batch chunk. */
const DEFAULT_BATCH_CONCURRENCY = 10;

// ─────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────

/** Base class for all Gmail API failures. */
export class GmailApiError extends Error {
	readonly status: number;
	/** True when the caller may safely retry (with backoff). */
	readonly retryable: boolean = false;

	constructor(message: string, status: number) {
		super(message);
		this.name = "GmailApiError";
		this.status = status;
	}
}

/** 401 persisted after a one-shot token refresh — re-consent required. */
export class GmailAuthError extends GmailApiError {
	readonly code = "GMAIL_AUTH";

	constructor(message: string) {
		super(message, 401);
		this.name = "GmailAuthError";
	}
}

/**
 * 404 from `users.history.list` — the stored historyId is too old and the
 * incremental feed has a gap. Per ADR 0011 the caller resets its checkpoint
 * forward to the current profile historyId; it never backfills.
 */
export class HistoryGapError extends GmailApiError {
	readonly code = "GMAIL_HISTORY_GAP";

	constructor(startHistoryId: string) {
		super(
			`Gmail history gap: startHistoryId ${startHistoryId} is no longer available`,
			404,
		);
		this.name = "HistoryGapError";
	}
}

/** 429 or 5xx — transient; safe to retry with backoff. */
export class GmailRetryableError extends GmailApiError {
	readonly code = "GMAIL_RETRYABLE";
	override readonly retryable = true;

	constructor(message: string, status: number) {
		super(message, status);
		this.name = "GmailRetryableError";
	}
}

/** Any other non-retryable 4xx (bad request, not found, forbidden, …). */
export class GmailRequestError extends GmailApiError {
	readonly code = "GMAIL_REQUEST";

	constructor(message: string, status: number) {
		super(message, status);
		this.name = "GmailRequestError";
	}
}

// ─────────────────────────────────────────────
// Response types (subset of the Gmail v1 surface we consume)
// ─────────────────────────────────────────────

export interface GmailProfile {
	emailAddress: string;
	messagesTotal: number;
	threadsTotal: number;
	historyId: string;
}

export interface GmailHistoryMessage {
	id: string;
	threadId: string;
	labelIds?: string[];
}

export interface GmailHistoryRecord {
	id: string;
	messages?: GmailHistoryMessage[];
	messagesAdded?: Array<{ message: GmailHistoryMessage }>;
}

export interface GmailHistoryPage {
	history?: GmailHistoryRecord[];
	nextPageToken?: string;
	/** The mailbox's current historyId as of this response. */
	historyId?: string;
}

export interface GmailHeader {
	name: string;
	value: string;
}

export interface GmailMessagePartBody {
	attachmentId?: string;
	size: number;
	/** base64url-encoded bytes (absent for attachment stubs). */
	data?: string;
}

export interface GmailMessagePart {
	partId?: string;
	mimeType?: string;
	filename?: string;
	headers?: GmailHeader[];
	body?: GmailMessagePartBody;
	parts?: GmailMessagePart[];
}

export interface GmailMessage {
	id: string;
	threadId: string;
	labelIds?: string[];
	snippet?: string;
	historyId?: string;
	/** Epoch millis as a string. */
	internalDate?: string;
	sizeEstimate?: number;
	payload?: GmailMessagePart;
}

export interface GmailAttachmentBody {
	size: number;
	/** base64url-encoded bytes. */
	data: string;
}

export interface GmailWatchResponse {
	historyId: string;
	/** Epoch millis as a string. */
	expiration: string;
}

// ─────────────────────────────────────────────
// Injectable dependencies
// ─────────────────────────────────────────────

/** Minimal fetch shape so tests can stub without satisfying `typeof fetch`. */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Acquire a (fresh) access token for a connected account. Called again —
 * exactly once — when a request comes back 401.
 */
export type AccessTokenProvider = (accountId: string) => Promise<string>;

/**
 * Default token provider: Better Auth resolves the Google account row and
 * refreshes the access token when expired.
 */
const defaultGetAccessToken: AccessTokenProvider = async (accountId) => {
	const { auth } = await import("../../auth.ts");
	const result = await auth.api.getAccessToken({
		body: { providerId: GOOGLE_PROVIDER_ID, accountId },
	});
	if (!result?.accessToken) {
		throw new GmailAuthError(
			`No Google access token available for account ${accountId}`,
		);
	}
	return result.accessToken;
};

export interface GmailClientOptions {
	/** Injectable fetch for tests. Defaults to the global fetch. */
	fetch?: FetchLike;
	/** Injectable token acquisition. Defaults to Better Auth. */
	getAccessToken?: AccessTokenProvider;
	/** Headers requested with `format=metadata` fetches. */
	metadataHeaders?: readonly string[];
	/** Max concurrent requests inside `getMessageMetadata` batches. */
	batchConcurrency?: number;
}

export interface HistoryListParams {
	startHistoryId: string;
	pageToken?: string;
	maxResults?: number;
}

export interface WatchParams {
	/** Fully-qualified Pub/Sub topic: `projects/<p>/topics/<t>`. */
	topicName: string;
	labelIds?: string[];
}

// ─────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────

/**
 * Create a Gmail client bound to one connected account's auth row.
 *
 * @param accountId Better Auth `account.id` of the Google account.
 */
export const createGmailClient = (
	accountId: string,
	options: GmailClientOptions = {},
) => {
	const fetchImpl: FetchLike = options.fetch ?? fetch;
	const getAccessToken = options.getAccessToken ?? defaultGetAccessToken;
	const metadataHeaders = options.metadataHeaders ?? DEFAULT_METADATA_HEADERS;
	const batchConcurrency =
		options.batchConcurrency ?? DEFAULT_BATCH_CONCURRENCY;

	const mapError = (
		response: Response,
		context: { isHistoryList?: boolean; startHistoryId?: string } = {},
	): GmailApiError => {
		const { status } = response;
		if (status === 401) {
			return new GmailAuthError(
				`Gmail request unauthorized after token refresh (account ${accountId})`,
			);
		}
		if (status === 404 && context.isHistoryList) {
			return new HistoryGapError(context.startHistoryId ?? "unknown");
		}
		if (status === 429 || status >= 500) {
			return new GmailRetryableError(
				`Gmail request failed with retryable status ${status}`,
				status,
			);
		}
		return new GmailRequestError(
			`Gmail request failed with status ${status}`,
			status,
		);
	};

	/**
	 * Authenticated request with a single 401 retry: on the first 401 the
	 * token is re-acquired (Better Auth refreshes it) and the request is
	 * replayed exactly once.
	 */
	const request = async <T>(
		path: string,
		init: RequestInit = {},
		context: { isHistoryList?: boolean; startHistoryId?: string } = {},
	): Promise<T> => {
		const doFetch = async (token: string): Promise<Response> =>
			fetchImpl(`${GMAIL_BASE_URL}${path}`, {
				...init,
				headers: {
					...init.headers,
					Authorization: `Bearer ${token}`,
					Accept: "application/json",
				},
			});

		let response = await doFetch(await getAccessToken(accountId));
		if (response.status === 401) {
			response = await doFetch(await getAccessToken(accountId));
		}

		if (!response.ok) {
			throw mapError(response, context);
		}
		if (response.status === 204) {
			return undefined as T;
		}
		const text = await response.text();
		return (text === "" ? undefined : JSON.parse(text)) as T;
	};

	/** `users.getProfile` — `historyId` here is the natural checkpoint. */
	const getProfile = (): Promise<GmailProfile> =>
		request<GmailProfile>("/profile");

	/**
	 * One page of `users.history.list`, restricted to `messageAdded` events
	 * (forward-only ingestion never consumes label/delete history).
	 */
	const historyList = (
		params: HistoryListParams,
	): Promise<GmailHistoryPage> => {
		const search = new URLSearchParams({
			startHistoryId: params.startHistoryId,
			historyTypes: "messageAdded",
		});
		if (params.pageToken) {
			search.set("pageToken", params.pageToken);
		}
		if (params.maxResults !== undefined) {
			search.set("maxResults", String(params.maxResults));
		}
		return request<GmailHistoryPage>(
			`/history?${search}`,
			{},
			{
				isHistoryList: true,
				startHistoryId: params.startHistoryId,
			},
		);
	};

	/**
	 * Iterate every history page from `startHistoryId`, following
	 * `nextPageToken` until exhausted. Yields page-by-page so callers can
	 * advance their sync cursor transactionally per page.
	 */
	async function* historyPages(
		params: Omit<HistoryListParams, "pageToken">,
	): AsyncGenerator<GmailHistoryPage, void, undefined> {
		let pageToken: string | undefined;
		do {
			const page: GmailHistoryPage = await historyList({
				...params,
				pageToken,
			});
			yield page;
			pageToken = page.nextPageToken;
		} while (pageToken);
	}

	/** One message with `format=metadata` — headers + snippet, never bodies. */
	const getOneMessageMetadata = (id: string): Promise<GmailMessage> => {
		const search = new URLSearchParams({ format: "metadata" });
		for (const header of metadataHeaders) {
			search.append("metadataHeaders", header);
		}
		return request<GmailMessage>(
			`/messages/${encodeURIComponent(id)}?${search}`,
		);
	};

	/**
	 * Fetch metadata for many message ids with bounded concurrency
	 * (`batchConcurrency` requests in flight per chunk). Results preserve the
	 * input order.
	 *
	 * Note: this batches via concurrent single-message requests rather than
	 * the multipart `/batch` endpoint — equivalent quota cost, far simpler
	 * error mapping per message.
	 */
	const getMessageMetadata = async (
		ids: readonly string[],
	): Promise<GmailMessage[]> => {
		const results: GmailMessage[] = [];
		for (let i = 0; i < ids.length; i += batchConcurrency) {
			const chunk = ids.slice(i, i + batchConcurrency);
			results.push(
				...(await Promise.all(chunk.map((id) => getOneMessageMetadata(id)))),
			);
		}
		return results;
	};

	/** Full message (`format=full`) — lazy body fetch only, never at ingest. */
	const getMessageFull = (id: string): Promise<GmailMessage> =>
		request<GmailMessage>(`/messages/${encodeURIComponent(id)}?format=full`);

	/** Attachment bytes (base64url) — lazy fetch only. */
	const getAttachment = (
		messageId: string,
		attachmentId: string,
	): Promise<GmailAttachmentBody> =>
		request<GmailAttachmentBody>(
			`/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
		);

	/** `users.watch` — register Pub/Sub push notifications. */
	const watch = (params: WatchParams): Promise<GmailWatchResponse> =>
		request<GmailWatchResponse>("/watch", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				topicName: params.topicName,
				...(params.labelIds ? { labelIds: params.labelIds } : {}),
			}),
		});

	/** `users.stop` — cancel push notifications (best-effort on disconnect). */
	const stop = (): Promise<void> => request<void>("/stop", { method: "POST" });

	return {
		accountId,
		getProfile,
		historyList,
		historyPages,
		getMessageMetadata,
		getMessageFull,
		getAttachment,
		watch,
		stop,
	};
};

export type GmailClient = ReturnType<typeof createGmailClient>;
