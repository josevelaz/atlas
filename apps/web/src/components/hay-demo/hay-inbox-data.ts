/**
 * hay-inbox-data.ts — Mock/local sample data for the /dev/hay-inbox demo.
 *
 * All data here is demo-only. No real mailbox, sender, or message data is
 * used. These shapes drive the shell counters, sidebar navigation, and the
 * category mail lists (Inbox / Feed / Paper Trail), plus the Screener queue
 * and the Tasks & Dates screen.
 *
 * Task 2.0 scope: shell + navigation + category layouts. The richer thread
 * bodies and assistant citations land in task 3.0, but the row-level data and
 * counts modeled here are sufficient to render prototype-faithful lists and
 * counters now.
 */

/** Primary navigable surfaces, matching the prototype's left rail. */
export type ScreenId =
	| "screener"
	| "inbox"
	| "feed"
	| "paper"
	| "tasks"
	| "settings";

/** The three category surfaces that render a mail list + reading pane. */
export type CategoryId = "inbox" | "feed" | "paper";

export type NavItem = {
	id: ScreenId;
	label: string;
	/** Accent token name (CSS var suffix) for the leading dot. */
	dot: "inbox" | "feed" | "paper" | "main";
	/** Mock unread/pending count shown in the rail. Undefined = no count. */
	count?: number;
};

export type Tag = {
	label: string;
	/** Optional solid variant for category-colored tags. */
	variant?: "inbox" | "feed" | "paper" | "ai" | "danger" | "main";
};

/** An item extracted from a thread by the AI — a task or a date. */
export type ExtractItem = {
	id: string;
	kind: "task" | "date";
	label: string;
	/** Mono trailing value (due date, time, etc.). */
	meta: string;
};

/** A single message inside a thread (head + body paragraphs). */
export type ThreadMessage = {
	id: string;
	from: string;
	initials: string;
	address: string;
	/** Mono date/time label shown on the message head. */
	date: string;
	/** Body paragraphs (rendered as separate <p> blocks). */
	body: string[];
};

/**
 * Rich thread detail shown in the reading pane when a row is selected.
 * The AI summary + extracted tasks/dates mirror the prototype's
 * `.ai-summary` / `.extracted` / `.extract-item` treatment.
 */
export type ThreadDetail = {
	/** AI-generated one-paragraph summary of the thread. */
	aiSummary: string;
	/** Tasks/dates the AI pulled out of the conversation. */
	extracted: ExtractItem[];
	/** The message stack (newest first), each with sender metadata. */
	messages: ThreadMessage[];
};

export type MailRow = {
	id: string;
	category: CategoryId;
	/** Sender display name. */
	from: string;
	/** Initials shown in the avatar chip. */
	initials: string;
	/** Sender email address shown in the thread head. */
	address: string;
	subject: string;
	preview: string;
	/** Short mono timestamp label, e.g. "9:41a" or "Tue". */
	time: string;
	unread: boolean;
	tags?: Tag[];
	/** Rich thread body shown in the reading pane on selection. */
	thread: ThreadDetail;
};

export type ScreenerItem = {
	id: string;
	from: string;
	initials: string;
	address: string;
	/** Subject used for the row + thread when the sender is accepted. */
	subject: string;
	preview: string;
	/** AI's suggested destination category for an accepted sender. */
	suggested: CategoryId;
	/** Human-readable label for the AI suggestion pill. */
	suggestedLabel: string;
};

export type TaskCard = {
	id: string;
	title: string;
	source: string;
	priority?: "p1" | "p2" | "p3";
};

export type DateCard = {
	id: string;
	title: string;
	when: string;
	source: string;
};

/**
 * SIDEBAR_NAV — primary navigation sections.
 *
 * "Screener" sits above the category triad; "Tasks & Dates" and "Settings"
 * are secondary surfaces in the prototype's lower rail. Counts are mock.
 */
export const PRIMARY_NAV: NavItem[] = [
	{ id: "screener", label: "Screener", dot: "main", count: 3 },
	{ id: "inbox", label: "Inbox", dot: "inbox", count: 4 },
	{ id: "feed", label: "Feed", dot: "feed", count: 9 },
	{ id: "paper", label: "Paper Trail", dot: "paper", count: 2 },
];

export const SECONDARY_NAV: NavItem[] = [
	{ id: "tasks", label: "Tasks & Dates", dot: "main", count: 5 },
	{ id: "settings", label: "Settings", dot: "main" },
];

/** Human-friendly title + meta line for each category list header. */
export const CATEGORY_META: Record<
	CategoryId,
	{ title: string; meta: string }
> = {
	inbox: { title: "Inbox", meta: "Conversations with real people" },
	feed: { title: "Feed", meta: "Newsletters & broadcasts" },
	paper: { title: "Paper Trail", meta: "Receipts & confirmations" },
};

/** Mock mail rows across the three category surfaces. */
export const MAIL_ROWS: MailRow[] = [
	{
		id: "i1",
		category: "inbox",
		from: "Dana Whitfield",
		initials: "DW",
		address: "dana@northstar.co",
		subject: "Re: Q3 roadmap review",
		preview:
			"Thanks for the notes — I pushed the deck to Friday so legal can take a pass first.",
		time: "9:41a",
		unread: true,
		tags: [{ label: "P1", variant: "danger" }, { label: "Reply" }],
		thread: {
			aiSummary:
				"Dana moved the Q3 roadmap deck review to Friday so Legal can review first. She wants your edits to the pricing slide before then and asks you to confirm the new time works.",
			extracted: [
				{
					id: "i1-t1",
					kind: "task",
					label: "Send pricing-slide edits to Dana",
					meta: "Before Fri",
				},
				{
					id: "i1-d1",
					kind: "date",
					label: "Q3 roadmap review",
					meta: "Fri 2:00p",
				},
			],
			messages: [
				{
					id: "i1-m1",
					from: "Dana Whitfield",
					initials: "DW",
					address: "dana@northstar.co",
					date: "Today, 9:41a",
					body: [
						"Thanks for the notes on the deck — really helpful framing on the pricing section.",
						"I pushed the review to Friday so Legal can take a pass on the contract terms slide first. Can you get me your pricing-slide edits before then?",
						"New time is Friday 2:00p, same room. Let me know if that doesn't work for you.",
					],
				},
				{
					id: "i1-m2",
					from: "You",
					initials: "YO",
					address: "you@hay.app",
					date: "Yesterday, 4:12p",
					body: [
						"Notes attached. The pricing section needs another pass — I'll send edits tomorrow.",
					],
				},
			],
		},
	},
	{
		id: "i2",
		category: "inbox",
		from: "Marcus Lee",
		initials: "ML",
		address: "marcus@brightfold.io",
		subject: "Invoice #4821 — net 30",
		preview:
			"Attached is the signed SOW. Payment terms are net 30; due date is the 27th.",
		time: "8:12a",
		unread: true,
		tags: [{ label: "Invoice", variant: "paper" }],
		thread: {
			aiSummary:
				"Marcus sent the signed SOW for invoice #4821. Payment terms are net 30 with a due date of the 27th. He's asking you to counter-sign and return it.",
			extracted: [
				{
					id: "i2-t1",
					kind: "task",
					label: "Counter-sign and return SOW",
					meta: "Reply",
				},
				{
					id: "i2-d1",
					kind: "date",
					label: "Invoice #4821 due",
					meta: "The 27th",
				},
			],
			messages: [
				{
					id: "i2-m1",
					from: "Marcus Lee",
					initials: "ML",
					address: "marcus@brightfold.io",
					date: "Today, 8:12a",
					body: [
						"Hi — attached is the signed SOW for invoice #4821.",
						"Payment terms are net 30; the due date is the 27th. Could you counter-sign and send it back when you get a moment?",
						"Thanks, looking forward to kicking this off.",
					],
				},
			],
		},
	},
	{
		id: "i3",
		category: "inbox",
		from: "Priya Nair",
		initials: "PN",
		address: "priya@nair.me",
		subject: "Lunch Thursday?",
		preview: "Free around 12:30 if you want to grab something near the office.",
		time: "Tue",
		unread: false,
		thread: {
			aiSummary:
				"Priya is suggesting lunch on Thursday around 12:30 near the office and wants to know if you're free.",
			extracted: [
				{
					id: "i3-d1",
					kind: "date",
					label: "Lunch with Priya",
					meta: "Thu 12:30p",
				},
			],
			messages: [
				{
					id: "i3-m1",
					from: "Priya Nair",
					initials: "PN",
					address: "priya@nair.me",
					date: "Tue, 11:02a",
					body: [
						"Hey! It's been a while — want to grab lunch Thursday?",
						"I'm free around 12:30 if you want to meet somewhere near the office. No worries if you're slammed.",
					],
				},
			],
		},
	},
	{
		id: "i4",
		category: "inbox",
		from: "Acme Support",
		initials: "AS",
		address: "support@acme.com",
		subject: "Ticket #209 resolved",
		preview: "We've closed your ticket. Let us know if anything resurfaces.",
		time: "Mon",
		unread: false,
		tags: [{ label: "Support" }],
		thread: {
			aiSummary:
				"Acme Support closed ticket #209 (sync failures on the staging connector). They've deployed a fix and ask you to reopen the ticket if the issue resurfaces.",
			extracted: [],
			messages: [
				{
					id: "i4-m1",
					from: "Acme Support",
					initials: "AS",
					address: "support@acme.com",
					date: "Mon, 3:30p",
					body: [
						"Good news — we've resolved ticket #209 regarding the staging connector sync failures.",
						"A fix has been deployed. We've closed the ticket, but please reply here to reopen it if anything resurfaces.",
					],
				},
			],
		},
	},
	{
		id: "f1",
		category: "feed",
		from: "Stratechery",
		initials: "ST",
		address: "ben@stratechery.com",
		subject: "The aggregation endgame",
		preview:
			"This week: why distribution is eating differentiation, and what it means for tooling.",
		time: "7:00a",
		unread: true,
		tags: [{ label: "Newsletter", variant: "feed" }],
		thread: {
			aiSummary:
				"This week's Stratechery argues distribution is increasingly the moat over product differentiation, and walks through what that means for developer-tooling startups competing against platform incumbents.",
			extracted: [],
			messages: [
				{
					id: "f1-m1",
					from: "Stratechery",
					initials: "ST",
					address: "ben@stratechery.com",
					date: "Today, 7:00a",
					body: [
						"This week: why distribution is eating differentiation, and what it means for tooling.",
						"The core argument: as the underlying models commoditize, the winners are the players who already own the distribution surface. For tooling startups, that reframes the build-vs-wedge decision.",
						"Read the full piece on the web →",
					],
				},
			],
		},
	},
	{
		id: "f2",
		category: "feed",
		from: "Lenny's Newsletter",
		initials: "LN",
		address: "lenny@substack.com",
		subject: "How the best PMs run discovery",
		preview:
			"Five teardown frameworks from operators at Figma, Linear, and Notion.",
		time: "6:30a",
		unread: true,
		tags: [{ label: "Newsletter", variant: "feed" }],
		thread: {
			aiSummary:
				"Lenny shares five product-discovery frameworks used by operators at Figma, Linear, and Notion, with teardown notes on when each fits and the failure modes to watch.",
			extracted: [],
			messages: [
				{
					id: "f2-m1",
					from: "Lenny's Newsletter",
					initials: "LN",
					address: "lenny@substack.com",
					date: "Today, 6:30a",
					body: [
						"Five teardown frameworks from operators at Figma, Linear, and Notion.",
						"Today we break down how each team scopes discovery before committing engineering time — and the one anti-pattern that quietly kills momentum.",
					],
				},
			],
		},
	},
	{
		id: "f3",
		category: "feed",
		from: "GitHub",
		initials: "GH",
		address: "noreply@github.com",
		subject: "Your weekly digest",
		preview:
			"12 repos you watch had releases this week, including solidjs/solid.",
		time: "Wed",
		unread: false,
		tags: [{ label: "Digest" }],
		thread: {
			aiSummary:
				"Your weekly GitHub digest: 12 watched repos shipped releases, headlined by a new solidjs/solid minor with reactivity fixes relevant to your project.",
			extracted: [],
			messages: [
				{
					id: "f3-m1",
					from: "GitHub",
					initials: "GH",
					address: "noreply@github.com",
					date: "Wed, 8:00a",
					body: [
						"12 repos you watch had releases this week.",
						"Highlights: solidjs/solid 1.9.x (reactivity fixes), tanstack/router 1.17.x, and biomejs/biome 2.x. Open the digest to see the full changelog.",
					],
				},
			],
		},
	},
	{
		id: "p1",
		category: "paper",
		from: "Stripe",
		initials: "SP",
		address: "receipts@stripe.com",
		subject: "Receipt for your payment",
		preview: "$49.00 to Vercel · Visa ending 4242 · Paid May 1.",
		time: "May 1",
		unread: false,
		tags: [{ label: "Receipt", variant: "paper" }],
		thread: {
			aiSummary:
				"Stripe receipt for a $49.00 payment to Vercel on May 1, charged to the Visa ending 4242. No action needed — filed for your records.",
			extracted: [
				{
					id: "p1-d1",
					kind: "date",
					label: "Vercel charge",
					meta: "Paid May 1",
				},
			],
			messages: [
				{
					id: "p1-m1",
					from: "Stripe",
					initials: "SP",
					address: "receipts@stripe.com",
					date: "May 1, 2:14a",
					body: [
						"Receipt for your payment.",
						"$49.00 paid to Vercel · Visa ending 4242 · May 1, 2026.",
						"This receipt is for your records. Manage your subscription from the billing portal.",
					],
				},
			],
		},
	},
	{
		id: "p2",
		category: "paper",
		from: "Delta",
		initials: "DL",
		address: "confirmation@delta.com",
		subject: "Your trip confirmation — SFO → JFK",
		preview: "Confirmation HAY42Q · Departs Jun 14, 8:05a · Seat 14C.",
		time: "Apr 28",
		unread: true,
		tags: [{ label: "Travel", variant: "feed" }],
		thread: {
			aiSummary:
				"Delta trip confirmation HAY42Q for a SFO → JFK flight departing June 14 at 8:05a, seat 14C. Check-in opens 24 hours before departure.",
			extracted: [
				{
					id: "p2-d1",
					kind: "date",
					label: "Flight SFO → JFK",
					meta: "Jun 14, 8:05a",
				},
				{
					id: "p2-t1",
					kind: "task",
					label: "Check in for flight",
					meta: "Jun 13",
				},
			],
			messages: [
				{
					id: "p2-m1",
					from: "Delta",
					initials: "DL",
					address: "confirmation@delta.com",
					date: "Apr 28, 9:50a",
					body: [
						"Your trip is confirmed.",
						"Confirmation HAY42Q · SFO → JFK · Departs Jun 14, 8:05a · Seat 14C.",
						"Check-in opens 24 hours before departure. Manage your trip in the Delta app.",
					],
				},
			],
		},
	},
];

/** Senders awaiting Screener triage. */
export const SCREENER_ITEMS: ScreenerItem[] = [
	{
		id: "s1",
		from: "Launch Weekly",
		initials: "LW",
		address: "updates@launch.dev",
		subject: "What shipped this week",
		preview:
			"You signed up for early access. Here's what shipped this week and what's coming next — including the new triage API you asked about.",
		suggested: "feed",
		suggestedLabel: "Route to Feed",
	},
	{
		id: "s2",
		from: "Northwind Accounts",
		initials: "NA",
		address: "billing@northwind.co",
		subject: "Subscription renews on the 30th",
		preview:
			"Your subscription renews on the 30th. The attached receipt confirms your plan and the card on file.",
		suggested: "paper",
		suggestedLabel: "Route to Paper Trail",
	},
	{
		id: "s3",
		from: "Sam Ortega",
		initials: "SO",
		address: "sam@brightfold.io",
		subject: "Following up from the conference",
		preview:
			"Hey — we met at the conference last week. Wanted to follow up on the integration idea we sketched out over coffee.",
		suggested: "inbox",
		suggestedLabel: "Route to Inbox",
	},
];

/**
 * screenerItemToMailRow — synthesize a category mail row from an accepted
 * Screener sender, so accepting routes the sender into their suggested list.
 *
 * The generated thread reuses the sender's preview as the AI summary input
 * and a single message, keeping the demo's reading pane populated for newly
 * routed items.
 */
export function screenerItemToMailRow(item: ScreenerItem): MailRow {
	const tagVariant: Tag["variant"] =
		item.suggested === "feed"
			? "feed"
			: item.suggested === "paper"
				? "paper"
				: "inbox";
	const tagLabel =
		item.suggested === "feed"
			? "Newsletter"
			: item.suggested === "paper"
				? "Receipt"
				: "New";
	return {
		id: `accepted-${item.id}`,
		category: item.suggested,
		from: item.from,
		initials: item.initials,
		address: item.address,
		subject: item.subject,
		preview: item.preview,
		time: "now",
		unread: true,
		tags: [{ label: tagLabel, variant: tagVariant }],
		thread: {
			aiSummary: `Newly accepted from the Screener. ${item.preview}`,
			extracted: [],
			messages: [
				{
					id: `accepted-${item.id}-m1`,
					from: item.from,
					initials: item.initials,
					address: item.address,
					date: "Just now",
					body: [item.preview],
				},
			],
		},
	};
}

/** Tasks extracted from mail, shown on the Tasks & Dates screen. */
export const TASK_CARDS: TaskCard[] = [
	{
		id: "t1",
		title: "Send signed SOW back to Marcus",
		source: "Invoice #4821 — net 30",
		priority: "p1",
	},
	{
		id: "t2",
		title: "Review Q3 roadmap deck before Friday",
		source: "Re: Q3 roadmap review",
		priority: "p2",
	},
	{
		id: "t3",
		title: "Reply to Sam about the integration idea",
		source: "Screener — Sam Ortega",
		priority: "p3",
	},
];

/** Dates extracted from mail, shown on the Tasks & Dates screen. */
export const DATE_CARDS: DateCard[] = [
	{
		id: "d1",
		title: "Invoice #4821 due",
		when: "Fri, the 27th",
		source: "Marcus Lee",
	},
	{
		id: "d2",
		title: "Flight SFO → JFK",
		when: "Jun 14, 8:05a",
		source: "Delta confirmation HAY42Q",
	},
];

/** Mock AI usage figures for the sidebar usage card. */
export const AI_USAGE = {
	used: 1840,
	limit: 5000,
	get pct(): number {
		return Math.round((this.used / this.limit) * 100);
	},
};
