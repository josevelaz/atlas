// Atlas — app state contracts & pure derivation helpers
//
// Typed port of the interaction model in `docs/prototype/app.jsx` and the
// onboarding fixtures in `docs/prototype/onboarding.jsx`. This module is
// framework-free: it defines the initial-state factory, pure UI-state
// transitions (selection, screener decisions), the keyboard-shortcut map, the
// static "Assist" nav entries, and the onboarding step data. The Solid layer
// wires these into signals / stores.
//
// Mail-list / thread / screener DATA now lives in `lib/mail/**` (server-backed
// via solid-query); the sample fixtures (`SAMPLE`) are confined to the assistant
// citation deep-link resolver (`viewForMailId`) and the `/dev/*` routes. No
// runtime imports from `docs/prototype/**`.

import { SAMPLE } from "./sample_data";
import type {
	AiCategory,
	AtlasState,
	NavItem,
	OnboardingStep,
	Screen,
	ScreenerDecisions,
	SelectionState,
} from "./types";

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

/**
 * Build the initial Atlas interaction state, matching the prototype's defaults:
 * onboarding shown first, inbox view, `i1` selected, no screener decisions, no
 * overlays open, no citation selected, empty toggle sets.
 */
export function createInitialState(): AtlasState {
	return {
		onboarded: false,
		onbStep: 0,
		view: "inbox",
		selected: { inbox: "i1", feed: null, paper: null },
		screener: { accepted: {}, rejected: {} },
		compose: { mode: "closed", replyAddr: "" },
		assistantOpen: false,
		citation: null,
		setAside: {},
		replyLater: {},
	};
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

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

/**
 * Next decisions after accepting screener item `sid` into `category`.
 *
 * Accepting clears any prior rejection for the same `sid`, so accept/reject are
 * mutually exclusive for a screener id — the latest decision always wins.
 */
export function acceptScreener(
	decisions: ScreenerDecisions,
	sid: string,
	category: AiCategory,
): ScreenerDecisions {
	const rejected = { ...decisions.rejected };
	delete rejected[sid];
	return {
		accepted: { ...decisions.accepted, [sid]: category },
		rejected,
	};
}

/**
 * Next decisions after rejecting screener item `sid`.
 *
 * Rejecting clears any prior acceptance for the same `sid`, so accept/reject are
 * mutually exclusive for a screener id — the latest decision always wins.
 */
export function rejectScreener(
	decisions: ScreenerDecisions,
	sid: string,
): ScreenerDecisions {
	const accepted = { ...decisions.accepted };
	delete accepted[sid];
	return {
		accepted,
		rejected: { ...decisions.rejected, [sid]: true },
	};
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
//
// The "Mail" sidebar entries with live counts are now server-backed via
// `useMailNavItems()` in `lib/mail/queries`. The static "Assist" entries stay
// here (no server data yet).
// ---------------------------------------------------------------------------

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
//
// The walkthrough leads (welcome → screener → categories → AI → empty inbox)
// and the connect/consent step is LAST: the user reads how Atlas works before
// being asked to authorize an account. The final step's `connect` visual hosts
// the real CTA (Connect with Google) — there is no "Skip"/"Open Atlas" bypass,
// since un-onboarded users are bounced from gated routes by the route guards.
// ---------------------------------------------------------------------------

export const ONBOARDING_STEPS: OnboardingStep[] = [
	{
		title: "Welcome to Atlas.",
		sub: "A smarter inbox on top of your Gmail or Outlook account. We protect your attention — you keep your address.",
		visual: { kind: "welcome" },
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
	{
		title: "Connect your mailbox.",
		sub: "Atlas works on top of your Gmail or Outlook account. We protect your attention — you keep your address. Authorize Atlas to get started.",
		visual: { kind: "connect" },
	},
];
