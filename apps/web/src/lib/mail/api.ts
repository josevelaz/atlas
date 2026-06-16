/**
 * Mail / screener API fetchers.
 *
 * All requests target the API server via `apiUrl()` and send session cookies
 * with `credentials: "include"` (the API may live on another origin; CORS on
 * the server echoes credentials for allowed origins).
 *
 * Error policy: every non-2xx throws (callers gate on a signed-in session).
 *
 * This module is independent of `lib/atlas/**` by design.
 */

import { apiFetch } from "../api";
import type {
	AcceptSenderResult,
	MailView,
	OverrideThreadCategoryResult,
	RecoverSenderResult,
	RejectedSendersResponse,
	RejectSenderResult,
	ServerMailCategory,
	ThreadDetailDto,
	ThreadListPage,
} from "./types";

/** Build an Error from a failed response, including any server message. */
async function responseError(
	response: Response,
	context: string,
): Promise<Error> {
	let detail = "";
	try {
		const body = (await response.json()) as { error?: unknown };
		if (typeof body.error === "string") {
			detail = `: ${body.error}`;
		}
	} catch {
		// Non-JSON body — status alone is enough.
	}
	return new Error(`${context} failed (${response.status})${detail}`);
}

export interface FetchThreadsParams {
	view: MailView;
	/** Narrow to one connected account; unified across accounts when omitted. */
	accountId?: string;
	cursor?: string;
	limit?: number;
}

/** Fetch one page of threads for a view. Throws on any non-2xx. */
export async function fetchThreads(
	params: FetchThreadsParams,
): Promise<ThreadListPage> {
	const search = new URLSearchParams({ view: params.view });
	if (params.accountId) search.set("accountId", params.accountId);
	if (params.cursor) search.set("cursor", params.cursor);
	if (params.limit != null) search.set("limit", String(params.limit));

	const response = await apiFetch(`/mail/threads?${search.toString()}`);

	if (!response.ok) {
		throw await responseError(response, "GET /mail/threads");
	}

	return (await response.json()) as ThreadListPage;
}

/** Fetch thread detail (messages + provenance) by id. Throws on any non-2xx. */
export async function fetchThreadDetail(
	threadId: string,
): Promise<ThreadDetailDto> {
	const response = await apiFetch(
		`/mail/threads/${encodeURIComponent(threadId)}`,
	);

	if (!response.ok) {
		throw await responseError(response, "GET /mail/threads/:id");
	}

	return (await response.json()) as ThreadDetailDto;
}

/**
 * Accept a sender into `category` (user-global). The sender's existing
 * screener threads move to `categorized`. Throws on any non-2xx.
 */
export async function postAcceptSender(
	email: string,
	category: ServerMailCategory,
): Promise<AcceptSenderResult> {
	const response = await apiFetch(
		`/screener/senders/${encodeURIComponent(email)}/accept`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ category }),
		},
	);

	if (!response.ok) {
		throw await responseError(response, "POST /screener/senders/:email/accept");
	}

	return (await response.json()) as AcceptSenderResult;
}

/**
 * Reject a sender (user-global). The sender's current screener threads and
 * future new threads become `hidden` (recoverable). Throws on any non-2xx.
 */
export async function postRejectSender(
	email: string,
): Promise<RejectSenderResult> {
	const response = await apiFetch(
		`/screener/senders/${encodeURIComponent(email)}/reject`,
		{
			method: "POST",
		},
	);

	if (!response.ok) {
		throw await responseError(response, "POST /screener/senders/:email/reject");
	}

	return (await response.json()) as RejectSenderResult;
}

/** List the user's rejected senders (recovery UI). Throws on any non-2xx. */
export async function fetchRejectedSenders(): Promise<RejectedSendersResponse> {
	const response = await apiFetch("/screener/rejected");

	if (!response.ok) {
		throw await responseError(response, "GET /screener/rejected");
	}

	return (await response.json()) as RejectedSendersResponse;
}

export interface RecoverSenderBody {
	category: ServerMailCategory;
	/** Also move the sender's hidden threads back to `categorized`. */
	restoreHidden?: boolean;
}

/**
 * Recover a previously rejected sender (re-accept with a category, optionally
 * restoring hidden threads). 404s when the sender is not currently rejected.
 */
export async function postRecoverSender(
	email: string,
	body: RecoverSenderBody,
): Promise<RecoverSenderResult> {
	const response = await apiFetch(
		`/screener/senders/${encodeURIComponent(email)}/recover`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		},
	);

	if (!response.ok) {
		throw await responseError(
			response,
			"POST /screener/senders/:email/recover",
		);
	}

	return (await response.json()) as RecoverSenderResult;
}

export interface OverrideThreadCategoryBody {
	category: ServerMailCategory;
	/** Also update the sender's user-global routing rule. */
	promote?: boolean;
}

/** Per-thread category override (sets `category_overridden`). Throws on non-2xx. */
export async function postThreadCategory(
	threadId: string,
	body: OverrideThreadCategoryBody,
): Promise<OverrideThreadCategoryResult> {
	const response = await apiFetch(
		`/mail/threads/${encodeURIComponent(threadId)}/category`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		},
	);

	if (!response.ok) {
		throw await responseError(response, "POST /mail/threads/:id/category");
	}

	return (await response.json()) as OverrideThreadCategoryResult;
}
