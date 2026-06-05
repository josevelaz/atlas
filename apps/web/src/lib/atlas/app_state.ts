// Atlas — app state contracts & pure derivation helpers
//
// Typed port of the interaction model in `docs/prototype/app.jsx` and the
// onboarding fixtures in `docs/prototype/onboarding.jsx`. This module is
// framework-free: it defines the initial-state factory, pure derivation
// helpers (active lists, screener pending, current thread, nav items), the
// keyboard-shortcut map, and the onboarding step data. The Solid layer wires
// these into signals / stores. No runtime imports from `docs/prototype/**`.

import { SAMPLE } from "./sample_data";
import type {
	AiCategory,
	AtlasState,
	MailItem,
	NavItem,
	OnboardingStep,
	Screen,
	ScreenerDecisions,
	ScreenerItem,
	SelectionState,
	Thread,
} from "./types";

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

/**
 * Build the initial Atlas interaction state, matching the prototype's defaults:
 * onboarding shown first, inbox view, `i1` selected, no screener decisions, no
 * overlays open, empty toggle sets.
 */
export function createInitialState(): AtlasState {
	return {
		onboarded: false,
		onbStep: 0,
		view: "inbox",
		selected: { inbox: "i1", feed: null, paper: null },
		screener: { accepted: {}, rejected: {} },
		overlay: { composeOpen: false, assistantOpen: false },
		setAside: {},
		replyLater: {},
	};
}

// ---------------------------------------------------------------------------
// Screener derivation
// ---------------------------------------------------------------------------

/** Screener items not yet accepted or rejected. */
export function pendingScreener(decisions: ScreenerDecisions): ScreenerItem[] {
	return SAMPLE.screener.filter(
		(i) => !decisions.accepted[i.id] && !decisions.rejected[i.id],
	);
}

/** Convert an accepted screener item into a synthetic mail row for a list. */
function screenerToMail(item: ScreenerItem, category: AiCategory): MailItem {
	const base: MailItem = {
		id: `ns-${item.id}`,
		from: item.from,
		addr: item.addr,
		subject: item.subject,
		preview: item.preview,
		time: item.time,
	};
	if (category === "inbox") {
		return { ...base, unread: true, priority: 2 };
	}
	if (category === "feed") {
		return { ...base, unread: true };
	}
	return base;
}

/** Synthetic rows produced by screener items accepted into `category`. */
function acceptedExtras(
	decisions: ScreenerDecisions,
	category: AiCategory,
): MailItem[] {
	const extras: MailItem[] = [];
	for (const [id, cat] of Object.entries(decisions.accepted)) {
		if (cat !== category) continue;
		const item = SAMPLE.screener.find((x) => x.id === id);
		if (item) extras.push(screenerToMail(item, category));
	}
	return extras;
}

// ---------------------------------------------------------------------------
// Active category lists (base sample + accepted screener items prepended)
// ---------------------------------------------------------------------------

export function inboxList(decisions: ScreenerDecisions): MailItem[] {
	return [...acceptedExtras(decisions, "inbox"), ...SAMPLE.inbox];
}

export function feedList(decisions: ScreenerDecisions): MailItem[] {
	return [...acceptedExtras(decisions, "feed"), ...SAMPLE.feed];
}

export function paperList(decisions: ScreenerDecisions): MailItem[] {
	return [...acceptedExtras(decisions, "paper"), ...SAMPLE.paper];
}

/** The active category list for a given screen, `[]` for non-list screens. */
export function listForView(
	view: Screen,
	decisions: ScreenerDecisions,
): MailItem[] {
	if (view === "inbox") return inboxList(decisions);
	if (view === "feed") return feedList(decisions);
	if (view === "paper") return paperList(decisions);
	return [];
}

/** The selected mail id for a category screen, or `null`. */
export function selectedIdForView(
	view: Screen,
	selected: SelectionState,
): string | null {
	if (view === "inbox") return selected.inbox;
	if (view === "feed") return selected.feed;
	if (view === "paper") return selected.paper;
	return null;
}

/** Resolve the currently open thread (mail row merged with its body), or null. */
export function currentThread(
	view: Screen,
	selected: SelectionState,
	decisions: ScreenerDecisions,
): Thread | null {
	const list = listForView(view, decisions);
	const selId = selectedIdForView(view, selected);
	if (!selId) return null;
	const mail = list.find((m) => m.id === selId);
	if (!mail) return null;
	return { ...mail, body: SAMPLE.threadBody[mail.id] ?? null };
}

// ---------------------------------------------------------------------------
// Selection / decision transitions (pure — return next-state fragments)
// ---------------------------------------------------------------------------

/** Next selection state after selecting `id` within `view`. */
export function selectInView(
	view: Screen,
	selected: SelectionState,
	id: string,
): SelectionState {
	if (view === "inbox") return { ...selected, inbox: id };
	if (view === "feed") return { ...selected, feed: id };
	if (view === "paper") return { ...selected, paper: id };
	return selected;
}

/** Next decisions after accepting screener item `sid` into `category`. */
export function acceptScreener(
	decisions: ScreenerDecisions,
	sid: string,
	category: AiCategory,
): ScreenerDecisions {
	return {
		...decisions,
		accepted: { ...decisions.accepted, [sid]: category },
	};
}

/** Next decisions after rejecting screener item `sid`. */
export function rejectScreener(
	decisions: ScreenerDecisions,
	sid: string,
): ScreenerDecisions {
	return {
		...decisions,
		rejected: { ...decisions.rejected, [sid]: true },
	};
}

// ---------------------------------------------------------------------------
// Decisions ⇄ search-param serialization (SSR-proof links)
//
// Client hydration is disabled by a pre-existing TanStack Start/Solid error, so
// screener accept/reject is driven by links that carry the cumulative decision
// set in a `?d=` search param. Encoding: `accepted` items as `id:category`,
// rejected items as `id:x`, joined by commas — e.g. `s1:inbox,s2:feed,s3:x`.
// ---------------------------------------------------------------------------

const REJECT_TOKEN = "x";

function isAiCategory(value: string): value is AiCategory {
	return value === "inbox" || value === "feed" || value === "paper";
}

/** Parse a `?d=` token string into {@link ScreenerDecisions}. */
export function decodeDecisions(raw: string | undefined): ScreenerDecisions {
	const decisions: ScreenerDecisions = { accepted: {}, rejected: {} };
	if (!raw) return decisions;
	for (const part of raw.split(",")) {
		const [id, value] = part.split(":");
		if (!id || !value) continue;
		// Only honor tokens for known screener ids.
		if (!SAMPLE.screener.some((s) => s.id === id)) continue;
		if (value === REJECT_TOKEN) {
			decisions.rejected[id] = true;
		} else if (isAiCategory(value)) {
			decisions.accepted[id] = value;
		}
	}
	return decisions;
}

/** Serialize {@link ScreenerDecisions} back into a `?d=` token string. */
export function encodeDecisions(decisions: ScreenerDecisions): string {
	const parts: string[] = [];
	for (const item of SAMPLE.screener) {
		const cat = decisions.accepted[item.id];
		if (cat) {
			parts.push(`${item.id}:${cat}`);
		} else if (decisions.rejected[item.id]) {
			parts.push(`${item.id}:${REJECT_TOKEN}`);
		}
	}
	return parts.join(",");
}

/** Resolve which screen a citation/thread id belongs to (for deep-linking). */
export function viewForMailId(id: string): Screen | null {
	if (SAMPLE.inbox.some((x) => x.id === id)) return "inbox";
	if (SAMPLE.feed.some((x) => x.id === id)) return "feed";
	if (SAMPLE.paper.some((x) => x.id === id)) return "paper";
	if (SAMPLE.screener.some((x) => x.id === id)) return "screener";
	return null;
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/** Primary "Mail" sidebar entries with live counts derived from decisions. */
export function mailNavItems(decisions: ScreenerDecisions): NavItem[] {
	const inbox = inboxList(decisions);
	const feed = feedList(decisions);
	const paper = paperList(decisions);
	return [
		{
			id: "screener",
			label: "Screener",
			icon: "screener",
			count: pendingScreener(decisions).length,
			color: "var(--color-danger)",
		},
		{
			id: "inbox",
			label: "Inbox",
			icon: "inbox",
			count: inbox.filter((i) => i.unread).length,
			color: "var(--color-main)",
		},
		{
			id: "feed",
			label: "Feed",
			icon: "feed",
			count: feed.filter((i) => i.unread).length,
			color: "var(--color-feed)",
		},
		{
			id: "paper",
			label: "Paper Trail",
			icon: "paper",
			count: paper.length,
			color: "var(--color-paper)",
		},
	];
}

/** Secondary "Assist" sidebar entries. */
export const ASSIST_NAV_ITEMS: NavItem[] = [
	{
		id: "tasks",
		label: "Tasks & Dates",
		icon: "tasks",
		count: 5,
		color: "var(--color-ai)",
	},
	{
		id: "settings",
		label: "Settings",
		icon: "settings",
		count: null,
		color: null,
	},
];

/** The human-readable title for a category mail list. */
export function listTitle(view: Screen): string {
	if (view === "inbox") return "Inbox";
	if (view === "feed") return "The Feed";
	if (view === "paper") return "Paper Trail";
	return "";
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts (declarative map — the Solid layer binds the listener)
// ---------------------------------------------------------------------------

export type KeyboardAction =
	| { kind: "view"; view: Screen }
	| { kind: "compose" }
	| { kind: "assistant" }
	| { kind: "dismiss-overlays" };

/**
 * Resolve a keyboard event to an Atlas action, mirroring the prototype's
 * handler. Returns `null` when the key is not bound or focus is in a text
 * field. ⌘K / Ctrl-K opens the assistant; digits 1–4 switch views; `c`
 * composes; `/` opens the assistant; Escape dismisses overlays.
 */
export function resolveShortcut(e: KeyboardEvent): KeyboardAction | null {
	const target = e.target as HTMLElement | null;
	const tag = target?.tagName;
	if (tag === "INPUT" || tag === "TEXTAREA") return null;

	if (e.metaKey || e.ctrlKey) {
		if (e.key === "k") return { kind: "assistant" };
		return null;
	}

	switch (e.key) {
		case "1":
			return { kind: "view", view: "screener" };
		case "2":
			return { kind: "view", view: "inbox" };
		case "3":
			return { kind: "view", view: "feed" };
		case "4":
			return { kind: "view", view: "paper" };
		case "c":
			return { kind: "compose" };
		case "/":
			return { kind: "assistant" };
		case "Escape":
			return { kind: "dismiss-overlays" };
		default:
			return null;
	}
}

// ---------------------------------------------------------------------------
// Onboarding steps (5 steps, copy & visuals preserved from the prototype)
// ---------------------------------------------------------------------------

export const ONBOARDING_STEPS: OnboardingStep[] = [
	{
		title: "Welcome to Atlas.",
		sub: "A smarter inbox on top of your Gmail or Outlook account. We protect your attention — you keep your address.",
		visual: { kind: "connect" },
	},
	{
		title: "Strangers go to the Screener.",
		sub: "First-time senders never reach your Inbox. You decide once — Accept into a category, or Reject. Atlas routes the rest.",
		visual: {
			kind: "screener-card",
			card: {
				name: "Maya Chen",
				initials: "MC",
				addr: "maya@northstarcap.com",
				subject: "Intro — angel check for your seed round",
				preview:
					"Hi! I was forwarded your deck by Jamie. Quick context — I write $25–100k checks…",
			},
		},
	},
	{
		title: "Three categories. No folders to manage.",
		sub: "Inbox is what demands attention. Feed is for newsletters and browse-later. Paper Trail holds receipts and confirmations.",
		visual: {
			kind: "categories",
			rows: [
				{
					color: "#7A83FF",
					name: "Inbox",
					desc: "Work, replies needed, the things that matter today.",
					icon: "inbox",
				},
				{
					color: "#FACC00",
					name: "Feed",
					desc: "Newsletters, marketing, browse-later content. No notifications.",
					icon: "feed",
				},
				{
					color: "#00D696",
					name: "Paper Trail",
					desc: "Receipts, confirmations, shipping notices. Searchable, quiet.",
					icon: "paper",
				},
			],
		},
	},
	{
		title: "AI helps you triage. You stay in charge.",
		sub: "Atlas suggests categories, summarizes long threads, surfaces tasks and dates, and answers questions about your mail. It never sends or deletes without you.",
		visual: {
			kind: "ai-summary",
			summary:
				"Priya is reviewing the Q3 hiring plan. Two concerns: pod A is one head short of the February projection, and she wants to move the design hire forward by six weeks. She'd like to discuss tomorrow.",
			extracted: [
				{
					color: "#00D696",
					label: "Confirm pod A staffing",
					due: "Before 1:1",
				},
				{
					color: "#FACC00",
					label: "1:1 with Priya — Q3 hiring follow-up",
					due: "Tomorrow, 9:00 AM",
				},
			],
		},
	},
	{
		title: "Atlas organizes new mail. Not old mail.",
		sub: "Your existing mailbox stays where it is. Atlas's Screener and categories begin with whatever lands after you connect. Empty for now — that's the point.",
		visual: {
			kind: "empty-inbox",
			heading: "Your Inbox is empty.",
			body: "That's because everyone is still unscreened. New mail will land in the Screener as it arrives — we'll show you.",
		},
	},
];
