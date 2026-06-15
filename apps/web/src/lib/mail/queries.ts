/**
 * Mail query layer — solid-query options, hooks, mutations, and DTO→view
 * mappers.
 *
 * Consumes the fetchers in `./api` and the shared `queryClient` mounted by
 * `routes/__root.tsx`. Keys live under the `['mail', …]` namespace so the
 * whole slice can be invalidated at once (see `invalidateMail`).
 *
 * SSR / prerender safety: every query is gated with `enabled: !isServer`, so
 * prerendering the SPA shell never executes a fetch — queries resolve only in
 * the browser.
 *
 * Mapping: the UI's view components consume the existing `lib/atlas/types`
 * shapes (`MailItem`, `ScreenerItem`, `Thread`). The mappers here translate
 * server DTOs onto those shapes so the components stay framework-faithful to
 * the prototype while reading live data.
 *
 * This module is the only seam between `lib/mail/**` (server DTOs) and
 * `lib/atlas/**` (UI view shapes).
 */

import {
	type QueryClient,
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/solid-query";
import { type Accessor, createMemo } from "solid-js";
import { isServer } from "solid-js/web";

import type {
	AiCategory,
	ExtractedItem,
	MailItem,
	MailProvenance,
	NavItem,
	Priority,
	Screen,
	ScreenerItem,
	Thread,
	ThreadBody,
	ThreadMessage,
} from "../atlas/types";
import {
	fetchRejectedSenders,
	fetchThreadDetail,
	fetchThreads,
	postAcceptSender,
	postRecoverSender,
	postRejectSender,
	postThreadCategory,
} from "./api";
import type {
	MailView,
	MessageDto,
	ServerMailCategory,
	ThreadDetailDto,
	ThreadListItemDto,
} from "./types";

// ---------------------------------------------------------------------------
// View ↔ server-category mapping
// ---------------------------------------------------------------------------

/** Map a UI mail screen to the server's `MailView` query value. */
export function viewToMailView(view: Screen): MailView | null {
	switch (view) {
		case "inbox":
			return "inbox";
		case "feed":
			return "feed";
		case "paper":
			return "paper_trail";
		case "screener":
			return "screener";
		case "spam":
			return "spam";
		default:
			return null;
	}
}

/** Map a UI `AiCategory` to the server's category literal. */
export function categoryToServer(category: AiCategory): ServerMailCategory {
	return category === "paper" ? "paper_trail" : category;
}

/** Map a server category literal back to the UI `AiCategory`. */
export function categoryFromServer(
	category: ServerMailCategory | null,
): AiCategory | null {
	if (category === "paper_trail") return "paper";
	if (category === "inbox" || category === "feed") return category;
	return null;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

/** Query-key namespace for the mail slice. */
export const mailKeys = {
	all: ["mail"] as const,
	threads: (view: MailView, accountId?: string) =>
		["mail", "threads", view, accountId ?? "all"] as const,
	thread: (id: string) => ["mail", "thread", id] as const,
	rejected: ["mail", "rejected"] as const,
};

// ---------------------------------------------------------------------------
// DTO → view-shape mappers
// ---------------------------------------------------------------------------

/** Derive a readable display name from an email address local-part. */
export function displayNameFromEmail(email: string): string {
	const local = email.split("@")[0] ?? email;
	const words = local
		.split(/[._-]+/)
		.filter(Boolean)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1));
	return words.length > 0 ? words.join(" ") : email;
}

/**
 * Format an ISO timestamp into the prototype's compact time string:
 *   - today        → "9:14"
 *   - this week    → "Wed"
 *   - older        → "May 3"
 * Returns "" when no timestamp is present.
 */
export function formatThreadTime(iso: string | null): string {
	if (!iso) return "";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";

	const now = new Date();
	const sameDay =
		date.getFullYear() === now.getFullYear() &&
		date.getMonth() === now.getMonth() &&
		date.getDate() === now.getDate();
	if (sameDay) {
		return date.toLocaleTimeString(undefined, {
			hour: "numeric",
			minute: "2-digit",
		});
	}

	const dayMs = 24 * 60 * 60 * 1000;
	const diffDays = Math.floor((now.getTime() - date.getTime()) / dayMs);
	if (diffDays >= 0 && diffDays < 7) {
		return date.toLocaleDateString(undefined, { weekday: "short" });
	}

	return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Source-account provenance for a thread row (always present server-side). */
function provenanceFor(dto: ThreadListItemDto): MailProvenance {
	return {
		connectedAccountId: dto.connectedAccountId,
		accountEmail: dto.accountEmail,
		accountStatus: dto.accountStatus,
	};
}

/** Map a thread list row to the UI `MailItem` shape. */
export function threadToMailItem(dto: ThreadListItemDto): MailItem {
	return {
		id: dto.id,
		from: displayNameFromEmail(dto.senderEmail),
		addr: dto.senderEmail,
		subject: dto.subject ?? "(no subject)",
		preview: dto.preview ?? "",
		time: formatThreadTime(dto.lastMessageAt),
		unread: !dto.read,
		provenance: provenanceFor(dto),
	};
}

/** Map a thread list row to the UI `ScreenerItem` shape. */
export function threadToScreenerItem(dto: ThreadListItemDto): ScreenerItem {
	const suggested = categoryFromServer(dto.category) ?? "inbox";
	return {
		id: dto.id,
		from: displayNameFromEmail(dto.senderEmail),
		addr: dto.senderEmail,
		subject: dto.subject ?? "(no subject)",
		preview: dto.preview ?? "",
		time: formatThreadTime(dto.lastMessageAt),
		aiHint: `New sender. Recommend ${labelForCategory(suggested)}.`,
		aiCategory: suggested,
	};
}

/** Human label for a category (for the screener AI hint). */
function labelForCategory(category: AiCategory): string {
	if (category === "feed") return "Feed";
	if (category === "paper") return "Paper Trail";
	return "Inbox";
}

/** Priority band from the message count — a stand-in until the server scores. */
function priorityFor(_dto: ThreadDetailDto): Priority | undefined {
	return undefined;
}

/** Map a message DTO to the UI `ThreadMessage` shape. */
function messageToThreadMessage(message: MessageDto): ThreadMessage {
	const from = message.fromName ?? displayNameFromEmail(message.fromEmail);
	const body = message.preview ? [message.preview] : [];
	return {
		from,
		addr: message.fromEmail,
		initial: "",
		time: formatThreadTime(message.sentAt),
		body,
	};
}

/**
 * Map thread detail to the UI `Thread` shape (a `MailItem` merged with an
 * optional `ThreadBody`). The AI summary / extracted tasks/dates seams are
 * kept empty until the server scores threads — the view degrades gracefully.
 */
export function threadDetailToThread(dto: ThreadDetailDto): Thread {
	const item: MailItem = {
		...threadToMailItem(dto),
		priority: priorityFor(dto),
	};

	const tasks: ExtractedItem[] = [];
	const dates: ExtractedItem[] = [];
	const body: ThreadBody = {
		from: item.from,
		addr: item.addr,
		time: item.time,
		messages: dto.messages.map(messageToThreadMessage),
		aiSummary: "",
		tasks,
		dates,
	};

	return { ...item, body };
}

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

/** Options for `GET /mail/threads?view=…`. */
export function threadsQueryOptions(view: MailView, accountId?: string) {
	return queryOptions({
		queryKey: mailKeys.threads(view, accountId),
		queryFn: () => fetchThreads({ view, accountId }),
		retry: false,
		staleTime: 15_000,
	});
}

/** Options for `GET /mail/threads/:id`. */
export function threadDetailQueryOptions(id: string) {
	return queryOptions({
		queryKey: mailKeys.thread(id),
		queryFn: () => fetchThreadDetail(id),
		retry: false,
		staleTime: 15_000,
	});
}

/** Options for `GET /screener/rejected`. */
export function rejectedSendersQueryOptions() {
	return queryOptions({
		queryKey: mailKeys.rejected,
		queryFn: fetchRejectedSenders,
		retry: false,
		staleTime: 15_000,
	});
}

// ---------------------------------------------------------------------------
// Hooks — lists
// ---------------------------------------------------------------------------

/**
 * The thread list for a UI mail screen, mapped to `MailItem[]`. Returns an
 * empty array for non-list screens or while loading. SSR-safe (gated on the
 * browser).
 */
export function useMailList(
	view: Accessor<Screen>,
	accountId?: Accessor<string | undefined>,
): {
	items: Accessor<MailItem[]>;
	isPending: Accessor<boolean>;
	isError: Accessor<boolean>;
} {
	const mailView = createMemo(() => viewToMailView(view()));
	const query = useQuery(() => {
		const mv = mailView();
		const acc = accountId?.();
		return {
			...threadsQueryOptions(mv ?? "inbox", acc),
			enabled: !isServer && mv != null && mv !== "screener",
		};
	});

	const items = createMemo<MailItem[]>(() =>
		(query.data?.threads ?? []).map(threadToMailItem),
	);
	return {
		items,
		isPending: () => query.isPending,
		isError: () => query.isError,
	};
}

/**
 * The pending screener list, mapped to `ScreenerItem[]`. SSR-safe (gated on
 * the browser).
 */
export function useScreenerList(accountId?: Accessor<string | undefined>): {
	items: Accessor<ScreenerItem[]>;
	isPending: Accessor<boolean>;
	isError: Accessor<boolean>;
} {
	const query = useQuery(() => ({
		...threadsQueryOptions("screener", accountId?.()),
		enabled: !isServer,
	}));

	const items = createMemo<ScreenerItem[]>(() =>
		(query.data?.threads ?? []).map(threadToScreenerItem),
	);
	return {
		items,
		isPending: () => query.isPending,
		isError: () => query.isError,
	};
}

/**
 * Thread detail for `id`, mapped to the UI `Thread` shape (or `null` while
 * unresolved). `id` may be `null` (nothing selected) — the query stays
 * disabled. SSR-safe.
 */
export function useThread(
	id: Accessor<string | null>,
): Accessor<Thread | null> {
	const query = useQuery(() => {
		const tid = id();
		return {
			...threadDetailQueryOptions(tid ?? ""),
			enabled: !isServer && tid != null && tid.length > 0,
		};
	});
	return createMemo<Thread | null>(() =>
		query.data ? threadDetailToThread(query.data) : null,
	);
}

/**
 * Whether a thread's full message bodies are still being lazily fetched.
 *
 * The thread list/detail returns message previews plus a per-message
 * `bodyState` (`"none" | "preview" | "full"`). Until a message reaches
 * `"full"`, the body view shows a loading affordance. (The dedicated lazy
 * body-fetch route is owned by task 19; this reads the state already present
 * on the detail DTO so the seam works against current data.)
 */
function isBodyLoading(dto: ThreadDetailDto | undefined): boolean {
	if (!dto || dto.messages.length === 0) return false;
	return dto.messages.every((m) => m.bodyState !== "full");
}

/**
 * Rich thread-detail view for the thread pane: the mapped `Thread`, the query
 * lifecycle (pending/fetching/error), and the lazy-body/disconnect seams.
 *
 * `bodyLoading` drives the body loading state on open. `disconnected` is true
 * when the thread's source account is disconnected — a read-only state where
 * un-fetched bodies cannot be retrieved (a full body fetch would resolve to
 * `account_disconnected`), so the pane shows the preview-only explanation
 * banner instead of an empty body. SSR-safe.
 */
export function useThreadDetail(id: Accessor<string | null>): {
	thread: Accessor<Thread | null>;
	isPending: Accessor<boolean>;
	isError: Accessor<boolean>;
	/** Full message bodies are still loading (lazy body fetch in flight). */
	bodyLoading: Accessor<boolean>;
	/** Source account is disconnected (read-only; un-fetched bodies blocked). */
	disconnected: Accessor<boolean>;
} {
	const query = useQuery(() => {
		const tid = id();
		return {
			...threadDetailQueryOptions(tid ?? ""),
			enabled: !isServer && tid != null && tid.length > 0,
		};
	});

	const thread = createMemo<Thread | null>(() =>
		query.data ? threadDetailToThread(query.data) : null,
	);
	const disconnected = createMemo<boolean>(
		() => query.data?.accountStatus === "disconnected",
	);
	// On a disconnected source the body can never be fetched — never show the
	// spinner; show the preview-only explanation instead.
	const bodyLoading = createMemo<boolean>(
		() => !disconnected() && isBodyLoading(query.data),
	);

	return {
		thread,
		isPending: () => query.isPending && id() != null,
		isError: () => query.isError,
		bodyLoading,
		disconnected,
	};
}

/** The user's rejected senders (recovery UI). SSR-safe. */
export function useRejectedSenders() {
	return useQuery(() => ({
		...rejectedSendersQueryOptions(),
		enabled: !isServer,
	}));
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Accept a sender (by thread) into `category`, then invalidate the mail slice
 * so the screener shrinks and the destination list refetches. The screener
 * card surfaces the sender address from the thread row, so callers pass the
 * sender email — not the thread id — matching the server's user-global model.
 */
export function useAcceptSender() {
	const client = useQueryClient();
	return useMutation(() => ({
		mutationFn: (args: { email: string; category: AiCategory }) =>
			postAcceptSender(args.email, categoryToServer(args.category)),
		onSuccess: () => client.invalidateQueries({ queryKey: mailKeys.all }),
	}));
}

/** Reject a sender (by email), then invalidate the mail slice. */
export function useRejectSender() {
	const client = useQueryClient();
	return useMutation(() => ({
		mutationFn: (email: string) => postRejectSender(email),
		onSuccess: () => client.invalidateQueries({ queryKey: mailKeys.all }),
	}));
}

/** Recover a previously rejected sender, then invalidate the mail slice. */
export function useRecoverSender() {
	const client = useQueryClient();
	return useMutation(() => ({
		mutationFn: (args: {
			email: string;
			category: AiCategory;
			restoreHidden?: boolean;
		}) =>
			postRecoverSender(args.email, {
				category: categoryToServer(args.category),
				restoreHidden: args.restoreHidden,
			}),
		onSuccess: () => client.invalidateQueries({ queryKey: mailKeys.all }),
	}));
}

/**
 * Per-thread category override (optionally promoting the sender), then
 * invalidate the mail slice so both the source and destination lists refetch.
 */
export function useOverrideThreadCategory() {
	const client = useQueryClient();
	return useMutation(() => ({
		mutationFn: (args: {
			threadId: string;
			category: AiCategory;
			promote?: boolean;
		}) =>
			postThreadCategory(args.threadId, {
				category: categoryToServer(args.category),
				promote: args.promote,
			}),
		onSuccess: () => client.invalidateQueries({ queryKey: mailKeys.all }),
	}));
}

// ---------------------------------------------------------------------------
// Sidebar nav counts (server-backed)
// ---------------------------------------------------------------------------

/**
 * The "Mail" sidebar entries with live counts derived from the server views:
 *   - Screener  → pending thread count
 *   - Inbox/Feed → unread thread count (on the fetched page)
 *   - Paper Trail → total thread count (on the fetched page)
 *
 * Counts are page-bounded (the default first page), matching the lists shown.
 * SSR-safe — all underlying queries are gated on the browser.
 */
export function useMailNavItems(): Accessor<NavItem[]> {
	const screener = useQuery(() => ({
		...threadsQueryOptions("screener"),
		enabled: !isServer,
	}));
	const inbox = useQuery(() => ({
		...threadsQueryOptions("inbox"),
		enabled: !isServer,
	}));
	const feed = useQuery(() => ({
		...threadsQueryOptions("feed"),
		enabled: !isServer,
	}));
	const paper = useQuery(() => ({
		...threadsQueryOptions("paper_trail"),
		enabled: !isServer,
	}));
	const spam = useQuery(() => ({
		...threadsQueryOptions("spam"),
		enabled: !isServer,
	}));

	return createMemo<NavItem[]>(() => [
		{
			id: "screener",
			label: "Screener",
			icon: "screener",
			count: screener.data?.threads.length ?? 0,
			color: "var(--color-danger)",
		},
		{
			id: "inbox",
			label: "Inbox",
			icon: "inbox",
			count: (inbox.data?.threads ?? []).filter((t) => !t.read).length,
			color: "var(--color-main)",
		},
		{
			id: "feed",
			label: "Feed",
			icon: "feed",
			count: (feed.data?.threads ?? []).filter((t) => !t.read).length,
			color: "var(--color-feed)",
		},
		{
			id: "paper",
			label: "Paper Trail",
			icon: "paper",
			count: paper.data?.threads.length ?? 0,
			color: "var(--color-paper)",
		},
		{
			// Provider-flagged spam, kept distinct from the Screener (which is
			// first-time senders awaiting a decision). Count is the page-bounded
			// spam-thread total.
			id: "spam",
			label: "Spam",
			icon: "shield",
			count: spam.data?.threads.length ?? 0,
			color: "var(--color-danger)",
		},
	]);
}

/** Invalidate the whole mail slice — call after any decision that moves mail. */
export function invalidateMail(queryClient: QueryClient): Promise<void> {
	return queryClient.invalidateQueries({ queryKey: mailKeys.all });
}
