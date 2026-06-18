import { describe, expect, it } from "bun:test";

import {
	createGmailClient,
	type FetchLike,
	type GmailClientOptions,
	GmailAuthError,
	GmailRequestError,
	GmailRetryableError,
	HistoryGapError,
} from "./client.ts";

const ACCOUNT_ID = "auth-account-1";

interface RecordedCall {
	url: string;
	init?: RequestInit;
}

const json = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});

const errorResponse = (status: number): Response =>
	new Response(JSON.stringify({ error: { code: status } }), { status });

/** Queue-based fetch stub: responses consumed in order; records every call. */
const makeQueueFetch = (responses: Array<Response | (() => Response)>) => {
	const calls: RecordedCall[] = [];
	const queue = [...responses];
	const fetchStub: FetchLike = async (url, init) => {
		calls.push({ url, init });
		const next = queue.shift();
		if (!next) {
			throw new Error(`fetch stub exhausted (call ${calls.length}: ${url})`);
		}
		return typeof next === "function" ? next() : next;
	};
	return { fetchStub, calls };
};

/** URL-routed fetch stub for concurrent (order-independent) requests. */
const makeRoutedFetch = (
	route: (url: string) => Response | Promise<Response>,
) => {
	const calls: RecordedCall[] = [];
	const fetchStub: FetchLike = async (url, init) => {
		calls.push({ url, init });
		return route(url);
	};
	return { fetchStub, calls };
};

/** Token provider stub returning a sequence of tokens (last one repeats). */
const makeTokenProvider = (...tokens: string[]) => {
	let callCount = 0;
	const provider = async (accountId: string): Promise<string> => {
		expect(accountId).toBe(ACCOUNT_ID);
		const token = tokens[Math.min(callCount, tokens.length - 1)];
		callCount += 1;
		return token ?? "token";
	};
	return {
		provider,
		get callCount() {
			return callCount;
		},
	};
};

const makeClient = (
	fetchStub: FetchLike,
	options: Partial<GmailClientOptions> = {},
) =>
	createGmailClient(ACCOUNT_ID, {
		fetch: fetchStub,
		getAccessToken: options.getAccessToken ?? makeTokenProvider("t1").provider,
		...options,
	});

const authHeader = (call: RecordedCall): string | undefined =>
	(call.init?.headers as Record<string, string> | undefined)?.Authorization;

describe("getProfile", () => {
	it("fetches the profile with a bearer token and parses the response", async () => {
		const { fetchStub, calls } = makeQueueFetch([
			json({
				emailAddress: "alice@gmail.com",
				messagesTotal: 10,
				threadsTotal: 4,
				historyId: "1000",
			}),
		]);
		const client = makeClient(fetchStub);

		const profile = await client.getProfile();

		expect(profile.emailAddress).toBe("alice@gmail.com");
		expect(profile.historyId).toBe("1000");
		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe(
			"https://gmail.googleapis.com/gmail/v1/users/me/profile",
		);
		expect(authHeader(calls[0] as RecordedCall)).toBe("Bearer t1");
	});
});

describe("historyList", () => {
	it("requests messageAdded history from the start cursor", async () => {
		const { fetchStub, calls } = makeQueueFetch([
			json({ history: [], historyId: "2000" }),
		]);
		const client = makeClient(fetchStub);

		const page = await client.historyList({ startHistoryId: "1000" });

		expect(page.historyId).toBe("2000");
		const url = new URL(calls[0]?.url ?? "");
		expect(url.pathname).toBe("/gmail/v1/users/me/history");
		expect(url.searchParams.get("startHistoryId")).toBe("1000");
		expect(url.searchParams.get("historyTypes")).toBe("messageAdded");
		expect(url.searchParams.has("pageToken")).toBe(false);
	});

	it("forwards pageToken and maxResults", async () => {
		const { fetchStub, calls } = makeQueueFetch([json({ history: [] })]);
		const client = makeClient(fetchStub);

		await client.historyList({
			startHistoryId: "1000",
			pageToken: "page-2",
			maxResults: 50,
		});

		const url = new URL(calls[0]?.url ?? "");
		expect(url.searchParams.get("pageToken")).toBe("page-2");
		expect(url.searchParams.get("maxResults")).toBe("50");
	});

	it("maps a 404 to HistoryGapError carrying the stale cursor", async () => {
		const { fetchStub } = makeQueueFetch([errorResponse(404)]);
		const client = makeClient(fetchStub);

		const error = await client
			.historyList({ startHistoryId: "1000" })
			.catch((e: unknown) => e);

		expect(error).toBeInstanceOf(HistoryGapError);
		expect((error as HistoryGapError).message).toContain("1000");
		expect((error as HistoryGapError).retryable).toBe(false);
		expect((error as HistoryGapError).status).toBe(404);
	});
});

describe("historyPages pagination", () => {
	it("follows nextPageToken until exhausted, yielding every page", async () => {
		const pages = [
			json({
				history: [
					{
						id: "h1",
						messagesAdded: [{ message: { id: "m1", threadId: "t1" } }],
					},
				],
				nextPageToken: "p2",
			}),
			json({
				history: [
					{
						id: "h2",
						messagesAdded: [{ message: { id: "m2", threadId: "t1" } }],
					},
				],
				nextPageToken: "p3",
			}),
			json({
				history: [
					{
						id: "h3",
						messagesAdded: [{ message: { id: "m3", threadId: "t2" } }],
					},
				],
				historyId: "3000",
			}),
		];
		const { fetchStub, calls } = makeQueueFetch(pages);
		const client = makeClient(fetchStub);

		const seen: string[][] = [];
		for await (const page of client.historyPages({ startHistoryId: "1000" })) {
			seen.push(
				(page.history ?? []).flatMap((record) =>
					(record.messagesAdded ?? []).map((added) => added.message.id),
				),
			);
		}

		expect(seen).toEqual([["m1"], ["m2"], ["m3"]]);
		expect(calls).toHaveLength(3);
		const tokens = calls.map((call) =>
			new URL(call.url).searchParams.get("pageToken"),
		);
		expect(tokens).toEqual([null, "p2", "p3"]);
		// Every page keeps the same forward-only start cursor.
		for (const call of calls) {
			expect(new URL(call.url).searchParams.get("startHistoryId")).toBe("1000");
		}
	});

	it("stops after a single page when there is no nextPageToken", async () => {
		const { fetchStub, calls } = makeQueueFetch([json({ history: [] })]);
		const client = makeClient(fetchStub);

		const pages: unknown[] = [];
		for await (const page of client.historyPages({ startHistoryId: "1" })) {
			pages.push(page);
		}

		expect(pages).toHaveLength(1);
		expect(calls).toHaveLength(1);
	});

	it("surfaces HistoryGapError raised mid-pagination", async () => {
		const { fetchStub } = makeQueueFetch([
			json({ history: [], nextPageToken: "p2" }),
			errorResponse(404),
		]);
		const client = makeClient(fetchStub);

		const consume = async () => {
			for await (const _page of client.historyPages({ startHistoryId: "1" })) {
				// consume
			}
		};

		await expect(consume()).rejects.toThrow(HistoryGapError);
	});
});

describe("401 refresh-retry", () => {
	it("re-acquires the token once and replays the request", async () => {
		const tokenProvider = makeTokenProvider("stale", "fresh");
		const { fetchStub, calls } = makeQueueFetch([
			errorResponse(401),
			json({
				emailAddress: "alice@gmail.com",
				messagesTotal: 1,
				threadsTotal: 1,
				historyId: "42",
			}),
		]);
		const client = makeClient(fetchStub, {
			getAccessToken: tokenProvider.provider,
		});

		const profile = await client.getProfile();

		expect(profile.historyId).toBe("42");
		expect(calls).toHaveLength(2);
		expect(tokenProvider.callCount).toBe(2);
		expect(authHeader(calls[0] as RecordedCall)).toBe("Bearer stale");
		expect(authHeader(calls[1] as RecordedCall)).toBe("Bearer fresh");
	});

	it("throws GmailAuthError after a second consecutive 401 (single retry only)", async () => {
		const tokenProvider = makeTokenProvider("stale", "still-stale");
		const { fetchStub, calls } = makeQueueFetch([
			errorResponse(401),
			errorResponse(401),
		]);
		const client = makeClient(fetchStub, {
			getAccessToken: tokenProvider.provider,
		});

		await expect(client.getProfile()).rejects.toThrow(GmailAuthError);
		expect(calls).toHaveLength(2);
		expect(tokenProvider.callCount).toBe(2);
	});

	it("propagates token-provider failures without calling fetch", async () => {
		const { fetchStub, calls } = makeQueueFetch([]);
		const client = makeClient(fetchStub, {
			getAccessToken: async () => {
				throw new GmailAuthError("no refresh token");
			},
		});

		await expect(client.getProfile()).rejects.toThrow(GmailAuthError);
		expect(calls).toHaveLength(0);
	});
});

describe("error mapping", () => {
	it("maps 429 to a retryable error", async () => {
		const { fetchStub } = makeQueueFetch([errorResponse(429)]);
		const client = makeClient(fetchStub);

		const error = await client.getProfile().catch((e: unknown) => e);

		expect(error).toBeInstanceOf(GmailRetryableError);
		expect((error as GmailRetryableError).retryable).toBe(true);
		expect((error as GmailRetryableError).status).toBe(429);
	});

	it("maps 5xx to a retryable error", async () => {
		const { fetchStub } = makeQueueFetch([errorResponse(503)]);
		const client = makeClient(fetchStub);

		const error = await client.getProfile().catch((e: unknown) => e);

		expect(error).toBeInstanceOf(GmailRetryableError);
		expect((error as GmailRetryableError).retryable).toBe(true);
		expect((error as GmailRetryableError).status).toBe(503);
	});

	it("maps non-history 404 to a non-retryable request error, not a gap", async () => {
		const { fetchStub } = makeQueueFetch([errorResponse(404)]);
		const client = makeClient(fetchStub);

		const error = await client
			.getMessageFull("m-missing")
			.catch((e: unknown) => e);

		expect(error).toBeInstanceOf(GmailRequestError);
		expect(error).not.toBeInstanceOf(HistoryGapError);
		expect((error as GmailRequestError).retryable).toBe(false);
	});

	it("maps other 4xx to a non-retryable request error", async () => {
		const { fetchStub } = makeQueueFetch([errorResponse(403)]);
		const client = makeClient(fetchStub);

		const error = await client.getProfile().catch((e: unknown) => e);

		expect(error).toBeInstanceOf(GmailRequestError);
		expect((error as GmailRequestError).status).toBe(403);
	});
});

describe("getMessageMetadata", () => {
	const messageFor = (url: string) => {
		const id = new URL(url).pathname.split("/").pop() ?? "";
		return json({ id, threadId: `thread-${id}`, snippet: `snippet ${id}` });
	};

	it("requests format=metadata with the default header allowlist", async () => {
		const { fetchStub, calls } = makeRoutedFetch(messageFor);
		const client = makeClient(fetchStub);

		await client.getMessageMetadata(["m1"]);

		const url = new URL(calls[0]?.url ?? "");
		expect(url.pathname).toBe("/gmail/v1/users/me/messages/m1");
		expect(url.searchParams.get("format")).toBe("metadata");
		expect(url.searchParams.getAll("metadataHeaders")).toEqual([
			"From",
			"To",
			"Cc",
			"Subject",
			"Date",
			"Message-ID",
			"In-Reply-To",
			"References",
		]);
	});

	it("fetches every id and preserves input order", async () => {
		const ids = ["m5", "m1", "m9", "m2", "m7"];
		const { fetchStub, calls } = makeRoutedFetch(messageFor);
		const client = makeClient(fetchStub, { batchConcurrency: 2 });

		const messages = await client.getMessageMetadata(ids);

		expect(messages.map((m) => m.id)).toEqual(ids);
		expect(calls).toHaveLength(ids.length);
	});

	it("bounds in-flight requests to batchConcurrency", async () => {
		let inFlight = 0;
		let maxInFlight = 0;
		const { fetchStub } = makeRoutedFetch(async (url) => {
			inFlight += 1;
			maxInFlight = Math.max(maxInFlight, inFlight);
			await new Promise((resolve) => setTimeout(resolve, 1));
			inFlight -= 1;
			return messageFor(url);
		});
		const client = makeClient(fetchStub, { batchConcurrency: 2 });

		await client.getMessageMetadata(["m1", "m2", "m3", "m4", "m5"]);

		expect(maxInFlight).toBeLessThanOrEqual(2);
		expect(maxInFlight).toBeGreaterThan(1);
	});

	it("returns an empty array for no ids without calling fetch", async () => {
		const { fetchStub, calls } = makeQueueFetch([]);
		const client = makeClient(fetchStub);

		expect(await client.getMessageMetadata([])).toEqual([]);
		expect(calls).toHaveLength(0);
	});
});

describe("getMessageFull", () => {
	it("requests format=full for a single message", async () => {
		const { fetchStub, calls } = makeQueueFetch([
			json({
				id: "m1",
				threadId: "t1",
				payload: { mimeType: "text/html", body: { size: 12, data: "aGVsbG8" } },
			}),
		]);
		const client = makeClient(fetchStub);

		const message = await client.getMessageFull("m1");

		expect(message.payload?.body?.data).toBe("aGVsbG8");
		const url = new URL(calls[0]?.url ?? "");
		expect(url.pathname).toBe("/gmail/v1/users/me/messages/m1");
		expect(url.searchParams.get("format")).toBe("full");
	});
});

describe("getAttachment", () => {
	it("fetches attachment bytes by message and attachment id", async () => {
		const { fetchStub, calls } = makeQueueFetch([
			json({ size: 3, data: "Zm9v" }),
		]);
		const client = makeClient(fetchStub);

		const attachment = await client.getAttachment("m1", "att-9");

		expect(attachment).toEqual({ size: 3, data: "Zm9v" });
		expect(new URL(calls[0]?.url ?? "").pathname).toBe(
			"/gmail/v1/users/me/messages/m1/attachments/att-9",
		);
	});
});

describe("watch / stop", () => {
	it("POSTs the topic to users.watch and parses the response", async () => {
		const { fetchStub, calls } = makeQueueFetch([
			json({ historyId: "5000", expiration: "1765000000000" }),
		]);
		const client = makeClient(fetchStub);

		const result = await client.watch({
			topicName: "projects/atlas/topics/gmail-push",
		});

		expect(result).toEqual({ historyId: "5000", expiration: "1765000000000" });
		const call = calls[0] as RecordedCall;
		expect(new URL(call.url).pathname).toBe("/gmail/v1/users/me/watch");
		expect(call.init?.method).toBe("POST");
		expect(JSON.parse(String(call.init?.body))).toEqual({
			topicName: "projects/atlas/topics/gmail-push",
		});
	});

	it("includes labelIds in the watch body when provided", async () => {
		const { fetchStub, calls } = makeQueueFetch([
			json({ historyId: "1", expiration: "2" }),
		]);
		const client = makeClient(fetchStub);

		await client.watch({
			topicName: "projects/atlas/topics/gmail-push",
			labelIds: ["INBOX"],
		});

		expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
			topicName: "projects/atlas/topics/gmail-push",
			labelIds: ["INBOX"],
		});
	});

	it("stop POSTs users.stop and tolerates an empty 204 response", async () => {
		const { fetchStub, calls } = makeQueueFetch([
			new Response(null, { status: 204 }),
		]);
		const client = makeClient(fetchStub);

		await expect(client.stop()).resolves.toBeUndefined();
		const call = calls[0] as RecordedCall;
		expect(new URL(call.url).pathname).toBe("/gmail/v1/users/me/stop");
		expect(call.init?.method).toBe("POST");
	});
});
