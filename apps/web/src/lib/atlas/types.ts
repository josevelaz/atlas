// Atlas — domain & state-contract types
//
// Ported from the self-contained React prototype (`docs/prototype/data.jsx`,
// `screens.jsx`, `app.jsx`, `onboarding.jsx`) into typed, framework-agnostic
// contracts. No runtime imports from `docs/prototype/**`.

import type { IconName } from "../../components/atlas/atlas_icon";

// ---------------------------------------------------------------------------
// Categories & priorities
// ---------------------------------------------------------------------------

/** The four mail categories Atlas routes into. */
export type MailCategory = "inbox" | "feed" | "paper";

/** A category the AI can suggest for a screener item. */
export type AiCategory = MailCategory;

/** Priority band on an inbox thread. 1 = P1 (urgent) … 3 = P3 (low). */
export type Priority = 1 | 2 | 3;

/**
 * Tags shown on a mail row / thread.
 * Interaction tags (`reply-later`, `set-aside`) toggle from the thread view;
 * the rest are descriptive paper-trail document kinds.
 */
export type MailTag =
	| "reply-later"
	| "set-aside"
	| "receipt"
	| "confirmation"
	| "shipping"
	| "statement"
	| "bill";

// ---------------------------------------------------------------------------
// Mail items
// ---------------------------------------------------------------------------

/** A first-time sender awaiting a screen decision. */
export interface ScreenerItem {
	id: string;
	from: string;
	addr: string;
	subject: string;
	preview: string;
	time: string;
	/** Plain-language AI recommendation shown on the screener card. */
	aiHint: string;
	/** Category the AI recommends routing this sender into. */
	aiCategory: AiCategory;
}

/** A row in any of the category mail lists (inbox / feed / paper trail). */
export interface MailItem {
	id: string;
	from: string;
	addr: string;
	subject: string;
	preview: string;
	time: string;
	unread?: boolean;
	/** Marks the row the prototype opens by default. */
	selected?: boolean;
	priority?: Priority;
	tags?: MailTag[];
}

// ---------------------------------------------------------------------------
// Thread body (expanded conversation + AI extraction)
// ---------------------------------------------------------------------------

/** A single message inside a thread conversation. */
export interface ThreadMessage {
	from: string;
	addr: string;
	/** Avatar initials override used by the prototype. */
	initial: string;
	time: string;
	/** Body paragraphs, one entry per `<p>`. */
	body: string[];
}

/** Kind discriminator for an AI-extracted action. */
export type ExtractedKind = "task" | "date";

/** An AI-extracted task or calendar date. */
export interface ExtractedItem {
	kind: ExtractedKind;
	label: string;
	/** Human-readable due descriptor (e.g. "Before 1:1", "Tomorrow, 9:00 AM"). */
	due: string;
}

/** Expanded thread content keyed by mail id in {@link SampleData.threadBody}. */
export interface ThreadBody {
	from: string;
	addr: string;
	time: string;
	messages: ThreadMessage[];
	aiSummary: string;
	tasks: ExtractedItem[];
	dates: ExtractedItem[];
}

/** A {@link MailItem} merged with its optional expanded {@link ThreadBody}. */
export interface Thread extends MailItem {
	body: ThreadBody | null;
}

// ---------------------------------------------------------------------------
// Tasks & Dates screen
// ---------------------------------------------------------------------------

/** A row in the Tasks column of the Tasks & Dates screen. */
export interface TaskEntry {
	label: string;
	due: string;
	/** Provenance descriptor (e.g. "Priya Ramanathan · Q3 hiring plan"). */
	source: string;
	/** Mail id the entry was extracted from. */
	id: string;
}

/** A row in the Dates column of the Tasks & Dates screen. */
export interface DateEntry {
	label: string;
	due: string;
	source: string;
	id: string;
}

// ---------------------------------------------------------------------------
// Aggregate sample-data shape
// ---------------------------------------------------------------------------

export interface SampleData {
	screener: ScreenerItem[];
	inbox: MailItem[];
	feed: MailItem[];
	paper: MailItem[];
	tasks: TaskEntry[];
	dates: DateEntry[];
	/** Expanded thread bodies keyed by mail id. */
	threadBody: Record<string, ThreadBody>;
}

// ---------------------------------------------------------------------------
// Assistant (Ask Atlas) canned responses
// ---------------------------------------------------------------------------

export type ChatRole = "ai" | "user";

/** A citation chip attached to an assistant reply. */
export interface AssistantCitation {
	num: number;
	from: string;
	subject: string;
	time: string;
	/** Mail id the citation opens when clicked. */
	id: string;
}

/** A message bubble in the Ask Atlas conversation. */
export interface AssistantMessage {
	role: ChatRole;
	text: string;
	cites: AssistantCitation[];
}

/**
 * A canned assistant reply plus the regex that triggers it.
 * The first rule whose pattern matches the query wins; a fallback rule with a
 * catch-all pattern always closes the list.
 */
export interface AssistantRule {
	pattern: RegExp;
	reply: AssistantMessage;
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

/** One walkthrough step. The visual is described declaratively so the data
 *  module stays framework-free — the component layer renders each variant. */
export interface OnboardingStep {
	title: string;
	sub: string;
	visual: OnboardingVisual;
}

/** Tagged-union description of an onboarding step's visual. */
export type OnboardingVisual =
	| { kind: "connect" }
	| { kind: "screener-card"; card: OnboardingScreenerCard }
	| { kind: "categories"; rows: OnboardingCategoryRow[] }
	| { kind: "ai-summary"; summary: string; extracted: OnboardingExtractedRow[] }
	| { kind: "empty-inbox"; heading: string; body: string };

export interface OnboardingScreenerCard {
	name: string;
	initials: string;
	addr: string;
	subject: string;
	preview: string;
}

export interface OnboardingCategoryRow {
	/** CSS color token / literal for the icon tile. */
	color: string;
	name: string;
	desc: string;
	icon: IconName;
}

export interface OnboardingExtractedRow {
	color: string;
	label: string;
	due: string;
}

// ---------------------------------------------------------------------------
// Navigation / routing
// ---------------------------------------------------------------------------

/** The active screen, derived from the route in the Solid app. */
export type Screen =
	| "screener"
	| "inbox"
	| "feed"
	| "paper"
	| "tasks"
	| "settings";

/** A sidebar navigation entry. */
export interface NavItem {
	id: Screen;
	label: string;
	icon: IconName;
	/** Unread / pending count; `null` when the entry has no badge. */
	count: number | null;
	/** CSS color token / literal for the icon tile; `null` for neutral. */
	color: string | null;
}

// ---------------------------------------------------------------------------
// App-state contracts (interaction model)
// ---------------------------------------------------------------------------

/** Selected mail id per category list. `null` = nothing selected. */
export interface SelectionState {
	inbox: string | null;
	feed: string | null;
	paper: string | null;
}

/** Screener decisions: accepted maps id → routed category; rejected is a set. */
export interface ScreenerDecisions {
	/** Accepted screener items keyed by id → the category they were routed into. */
	accepted: Record<string, AiCategory>;
	/** Rejected screener item ids. */
	rejected: Record<string, boolean>;
}

/** Per-mail boolean toggle map (set-aside / reply-later). */
export type ToggleSet = Record<string, boolean>;

/**
 * Compose overlay mode: closed, a blank "New message", or a "Reply" prefilled
 * from the selected thread's sender.
 */
export type ComposeMode = "closed" | "new" | "reply";

/** Visibility of the overlay surfaces. */
export interface OverlayState {
	composeOpen: boolean;
	assistantOpen: boolean;
}

/**
 * The full Atlas interaction model. The Solid app owns these as signals /
 * stores; this interface documents the contract and keeps the shape typed.
 */
export interface AtlasState {
	/** Whether onboarding has been completed/dismissed. */
	onboarded: boolean;
	/** Current onboarding step index (0-based). */
	onbStep: number;
	/** Active screen (route-derived). */
	view: Screen;
	/** Selected mail per category. */
	selected: SelectionState;
	/** Screener accept/reject decisions. */
	screener: ScreenerDecisions;
	/** Overlay visibility. */
	overlay: OverlayState;
	/** Per-mail "set aside" toggles. */
	setAside: ToggleSet;
	/** Per-mail "reply later" toggles. */
	replyLater: ToggleSet;
}
