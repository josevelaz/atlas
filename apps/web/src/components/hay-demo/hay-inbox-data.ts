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

export type MailRow = {
	id: string;
	category: CategoryId;
	/** Sender display name. */
	from: string;
	/** Initials shown in the avatar chip. */
	initials: string;
	subject: string;
	preview: string;
	/** Short mono timestamp label, e.g. "9:41a" or "Tue". */
	time: string;
	unread: boolean;
	tags?: Tag[];
};

export type ScreenerItem = {
	id: string;
	from: string;
	initials: string;
	address: string;
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
		subject: "Re: Q3 roadmap review",
		preview:
			"Thanks for the notes — I pushed the deck to Friday so legal can take a pass first.",
		time: "9:41a",
		unread: true,
		tags: [{ label: "P1", variant: "danger" }, { label: "Reply" }],
	},
	{
		id: "i2",
		category: "inbox",
		from: "Marcus Lee",
		initials: "ML",
		subject: "Invoice #4821 — net 30",
		preview:
			"Attached is the signed SOW. Payment terms are net 30; due date is the 27th.",
		time: "8:12a",
		unread: true,
		tags: [{ label: "Invoice", variant: "paper" }],
	},
	{
		id: "i3",
		category: "inbox",
		from: "Priya Nair",
		initials: "PN",
		subject: "Lunch Thursday?",
		preview: "Free around 12:30 if you want to grab something near the office.",
		time: "Tue",
		unread: false,
	},
	{
		id: "i4",
		category: "inbox",
		from: "Acme Support",
		initials: "AS",
		subject: "Ticket #209 resolved",
		preview: "We've closed your ticket. Let us know if anything resurfaces.",
		time: "Mon",
		unread: false,
		tags: [{ label: "Support" }],
	},
	{
		id: "f1",
		category: "feed",
		from: "Stratechery",
		initials: "ST",
		subject: "The aggregation endgame",
		preview:
			"This week: why distribution is eating differentiation, and what it means for tooling.",
		time: "7:00a",
		unread: true,
		tags: [{ label: "Newsletter", variant: "feed" }],
	},
	{
		id: "f2",
		category: "feed",
		from: "Lenny's Newsletter",
		initials: "LN",
		subject: "How the best PMs run discovery",
		preview:
			"Five teardown frameworks from operators at Figma, Linear, and Notion.",
		time: "6:30a",
		unread: true,
		tags: [{ label: "Newsletter", variant: "feed" }],
	},
	{
		id: "f3",
		category: "feed",
		from: "GitHub",
		initials: "GH",
		subject: "Your weekly digest",
		preview:
			"12 repos you watch had releases this week, including solidjs/solid.",
		time: "Wed",
		unread: false,
		tags: [{ label: "Digest" }],
	},
	{
		id: "p1",
		category: "paper",
		from: "Stripe",
		initials: "SP",
		subject: "Receipt for your payment",
		preview: "$49.00 to Vercel · Visa ending 4242 · Paid May 1.",
		time: "May 1",
		unread: false,
		tags: [{ label: "Receipt", variant: "paper" }],
	},
	{
		id: "p2",
		category: "paper",
		from: "Delta",
		initials: "DL",
		subject: "Your trip confirmation — SFO → JFK",
		preview: "Confirmation HAY42Q · Departs Jun 14, 8:05a · Seat 14C.",
		time: "Apr 28",
		unread: true,
		tags: [{ label: "Travel", variant: "feed" }],
	},
];

/** Senders awaiting Screener triage. */
export const SCREENER_ITEMS: ScreenerItem[] = [
	{
		id: "s1",
		from: "Launch Weekly",
		initials: "LW",
		address: "updates@launch.dev",
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
		preview:
			"Hey — we met at the conference last week. Wanted to follow up on the integration idea we sketched out over coffee.",
		suggested: "inbox",
		suggestedLabel: "Route to Inbox",
	},
];

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
