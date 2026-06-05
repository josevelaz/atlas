/**
 * hay-inbox-data.ts — Mock/local sample data for the /dev/hay-inbox demo.
 *
 * All data here is demo-only. No real mailbox, sender, or message data is
 * used. The content is ported as closely as feasible from the authoritative
 * prototype (`docs/prototype/hay-inbox-prototype.html`, asset `cc85f047` —
 * `const SAMPLE`, plus the screen components in asset `fa7745fc` and the root
 * app in asset `ea22146a`). Senders, subjects, previews, times, priorities,
 * the Screener queue, the Priya Q3-hiring thread body, the Tasks & Dates
 * cards, Settings rows, AI usage figures, and the Ask Hay canned replies all
 * mirror the prototype's mock content.
 *
 * The prototype computes avatar initials from the sender name; here we keep an
 * explicit `initials` field (consumed by the Solid components) but derive it
 * from the prototype name. The prototype carries per-row `priority` (1/2/3)
 * and string tags (e.g. "reply-later", "set-aside", "receipt"); those map onto
 * the `priority` field and the `Tag` shape below.
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

/** Which lucide-solid icon renders inside a nav item's leading chip. */
export type NavIcon =
	| "screener"
	| "inbox"
	| "feed"
	| "paper"
	| "tasks"
	| "settings";

export type NavItem = {
	id: ScreenId;
	label: string;
	/** lucide-solid icon shown in the leading bordered chip. */
	icon: NavIcon;
	/**
	 * Accent tone for the leading chip background, matching the prototype's
	 * per-item color (`var(--danger|main|feed|paper|ai)`). `null` = no fill
	 * (neutral surface chip), used for Settings.
	 */
	tone: "screener" | "inbox" | "feed" | "paper" | "tasks" | null;
	/** Mock unread/pending count shown in the rail. Undefined = no count. */
	count?: number;
};

export type Tag = {
	label: string;
	/** Optional solid variant for category-colored tags. */
	variant?: "inbox" | "feed" | "paper" | "ai" | "danger" | "main";
};

/** P1/P2/P3 priority, matching the prototype's `priority` field (1/2/3). */
export type Priority = "p1" | "p2" | "p3";

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
	/** Short mono timestamp label, e.g. "10:42" or "Tue". */
	time: string;
	unread: boolean;
	/** Optional P1/P2/P3 priority (prototype `priority` 1/2/3). */
	priority?: Priority;
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
	/** Mono timestamp shown on the screener card. */
	time: string;
	/** AI's suggested destination category for an accepted sender. */
	suggested: CategoryId;
	/** Human-readable AI hint shown in the suggestion pill row. */
	suggestedLabel: string;
};

export type TaskCard = {
	id: string;
	title: string;
	source: string;
	/** Mono "due" label shown under the title, e.g. "Before 1:1". */
	due: string;
	priority?: Priority;
};

export type DateCard = {
	id: string;
	title: string;
	when: string;
	source: string;
};

/** Compute two-letter initials from a name, matching the prototype helper. */
function initialsOf(name: string): string {
	return name
		.split(/\s+/)
		.slice(0, 2)
		.map((s) => s[0])
		.join("")
		.toUpperCase();
}

/** Map a prototype string tag (e.g. "reply-later") onto the Solid Tag shape. */
function tag(label: string, variant?: Tag["variant"]): Tag {
	return { label: label.replace(/-/g, " "), variant };
}

/**
 * PRIMARY_NAV / SECONDARY_NAV — primary navigation sections.
 *
 * Counts mirror the prototype's derived nav counts: Screener = pending count
 * (4), Inbox = unread inbox count (3), Feed = unread feed count (2), Paper
 * Trail = total paper count (7), Tasks & Dates = 5. The shell recomputes these
 * live from the local-state lists; these are the initial/default values.
 */
export const PRIMARY_NAV: NavItem[] = [
	{
		id: "screener",
		label: "Screener",
		icon: "screener",
		tone: "screener",
		count: 4,
	},
	{ id: "inbox", label: "Inbox", icon: "inbox", tone: "inbox", count: 3 },
	{ id: "feed", label: "Feed", icon: "feed", tone: "feed", count: 2 },
	{ id: "paper", label: "Paper Trail", icon: "paper", tone: "paper", count: 7 },
];

export const SECONDARY_NAV: NavItem[] = [
	{
		id: "tasks",
		label: "Tasks & Dates",
		icon: "tasks",
		tone: "tasks",
		count: 5,
	},
	{ id: "settings", label: "Settings", icon: "settings", tone: null },
];

/** Human-friendly title + meta line for each category list header. */
export const CATEGORY_META: Record<
	CategoryId,
	{ title: string; meta: string }
> = {
	inbox: { title: "Inbox", meta: "Conversations with real people" },
	feed: { title: "The Feed", meta: "Newsletters & broadcasts" },
	paper: { title: "Paper Trail", meta: "Receipts & confirmations" },
};

/**
 * singleMessageThread — synthesize a one-message thread from a row's preview,
 * for prototype rows that don't carry a rich `threadBody` entry. The prototype
 * only models a full body for the Priya thread (`i1`); selecting any other row
 * shows a single message whose body is the row's preview text. This keeps the
 * reading pane populated and prototype-faithful without inventing new copy.
 */
function singleMessageThread(opts: {
	id: string;
	from: string;
	address: string;
	date: string;
	body: string;
	aiSummary?: string;
}): ThreadDetail {
	return {
		aiSummary: opts.aiSummary ?? opts.body,
		extracted: [],
		messages: [
			{
				id: `${opts.id}-m1`,
				from: opts.from,
				initials: initialsOf(opts.from),
				address: opts.address,
				date: opts.date,
				body: [opts.body],
			},
		],
	};
}

/* ===================================================================
 * Mail rows — ported verbatim from prototype `SAMPLE.inbox / .feed / .paper`.
 * Inbox: 9 rows; Feed: 7 rows; Paper Trail: 7 rows.
 * Only `i1` (Priya — Q3 hiring) has a rich threadBody in the prototype.
 * =================================================================== */
export const MAIL_ROWS: MailRow[] = [
	/* ===== Inbox ===== */
	{
		id: "i1",
		category: "inbox",
		from: "Priya Ramanathan",
		initials: "PR",
		address: "priya@hay.co",
		subject: "Re: Q3 hiring plan — final review",
		preview:
			"I went through the latest version. Two things stood out. First, the engineering pod size is still off relative to what we projected in February. Second, I think we should move the design hire forward by six weeks given the roadmap.",
		time: "10:42",
		unread: true,
		priority: "p1",
		tags: [tag("reply-later")],
		thread: {
			aiSummary:
				"Priya is reviewing the Q3 hiring plan and has two concerns: (1) pod A is one head short of the February projection — she's asking if it was rolled into pod C, and (2) she wants to move the design hire up by six weeks because the marketing site rebuild will need brand work sooner than expected. She wants to discuss in tomorrow's 1:1.",
			extracted: [
				{
					id: "i1-t1",
					kind: "task",
					label:
						"Confirm pod A staffing — was the seventh req rolled into pod C?",
					meta: "Before 1:1",
				},
				{
					id: "i1-t2",
					kind: "task",
					label: "Decide on moving design hire forward by 6 weeks",
					meta: "Tomorrow",
				},
				{
					id: "i1-d1",
					kind: "date",
					label: "1:1 with Priya — Q3 hiring follow-up",
					meta: "Tomorrow, 9:00 AM",
				},
			],
			messages: [
				{
					id: "i1-m3",
					from: "Priya Ramanathan",
					initials: "PR",
					address: "priya@hay.co",
					date: "Today, 10:42 AM",
					body: [
						"I went through the latest version. Two things stood out.",
						"First, the engineering pod size is still off relative to what we projected in February. We had said pod A would grow to seven by end of Q3 — the new draft has six. Was that intentional, or did one of the reqs get rolled into pod C?",
						"Second, I think we should move the design hire forward by six weeks. The marketing site rebuild is going to need brand work earlier than we modeled, and Sara is at capacity. Can we discuss in our 1:1 tomorrow?",
					],
				},
				{
					id: "i1-m2",
					from: "You",
					initials: "RB",
					address: "rob@hay.co",
					date: "Today, 8:30 AM",
					body: [
						"Sounds good. Will look at it this morning. Holding platform at four is fine with me — the bottleneck is review capacity, not heads.",
					],
				},
				{
					id: "i1-m1",
					from: "Priya Ramanathan",
					initials: "PR",
					address: "priya@hay.co",
					date: "Yesterday, 6:14 PM",
					body: [
						"Quick note before I forget — I'm pulling together the Q3 hiring plan and want to lock the engineering pod sizes by Friday.",
						"Sending the draft over tonight. Two open questions: do we still want the design hire in pod B, and are we comfortable holding the platform pod at four for another quarter?",
					],
				},
			],
		},
	},
	{
		id: "i2",
		category: "inbox",
		from: "Marcus Okafor",
		initials: "MO",
		address: "marcus@catalystfund.vc",
		subject: "Term sheet — redlines attached",
		preview:
			"Attached are our redlines on the SAFE. Most of it is standard, but flag the pro-rata language — happy to walk through on a call tomorrow.",
		time: "10:18",
		unread: true,
		priority: "p1",
		tags: [tag("reply-later")],
		thread: singleMessageThread({
			id: "i2",
			from: "Marcus Okafor",
			address: "marcus@catalystfund.vc",
			date: "Today, 10:18 AM",
			body: "Attached are our redlines on the SAFE. Most of it is standard, but flag the pro-rata language — happy to walk through on a call tomorrow.",
			aiSummary:
				"Marcus from Catalyst sent SAFE redlines this morning. Most language is standard, but he flagged the pro-rata clause for discussion. He's offering to walk through it on a call tomorrow.",
		}),
	},
	{
		id: "i3",
		category: "inbox",
		from: "Sara Bouchard",
		initials: "SB",
		address: "sara@hay.co",
		subject: "Stale design review — needs your input",
		preview:
			"The thread on the screener empty state has been waiting on you for 3 days. Not blocking yet but Thursday is the cutoff.",
		time: "9:55",
		unread: true,
		priority: "p2",
		thread: singleMessageThread({
			id: "i3",
			from: "Sara Bouchard",
			address: "sara@hay.co",
			date: "Today, 9:55 AM",
			body: "The thread on the screener empty state has been waiting on you for 3 days. Not blocking yet but Thursday is the cutoff.",
		}),
	},
	{
		id: "i4",
		category: "inbox",
		from: "Dad",
		initials: "DA",
		address: "rwbarrett@protonmail.com",
		subject: "Thanksgiving — flight question",
		preview:
			"Are you flying in Wednesday night or Thursday morning? Your mother wants to know whether to grab the airport pickup or send me.",
		time: "9:30",
		unread: false,
		priority: "p3",
		tags: [tag("set-aside")],
		thread: singleMessageThread({
			id: "i4",
			from: "Dad",
			address: "rwbarrett@protonmail.com",
			date: "Today, 9:30 AM",
			body: "Are you flying in Wednesday night or Thursday morning? Your mother wants to know whether to grab the airport pickup or send me.",
		}),
	},
	{
		id: "i5",
		category: "inbox",
		from: "Jordan Vega",
		initials: "JV",
		address: "jordan.vega@hay.co",
		subject: "Pull request #482 — auth refactor",
		preview:
			"Pushed the third revision. The session token edge case is fixed and I added a regression test. Ready for one more look when you have a minute.",
		time: "Wed",
		unread: false,
		priority: "p2",
		thread: singleMessageThread({
			id: "i5",
			from: "Jordan Vega",
			address: "jordan.vega@hay.co",
			date: "Wed, 4:20 PM",
			body: "Pushed the third revision. The session token edge case is fixed and I added a regression test. Ready for one more look when you have a minute.",
		}),
	},
	{
		id: "i6",
		category: "inbox",
		from: "GitHub",
		initials: "GI",
		address: "noreply@github.com",
		subject: "[hay/core] 3 new mentions in pull requests",
		preview:
			"@you was mentioned in #491, #492, and #493. Latest: Jordan Vega left a review on #491 with 2 comments.",
		time: "Wed",
		unread: false,
		priority: "p3",
		thread: singleMessageThread({
			id: "i6",
			from: "GitHub",
			address: "noreply@github.com",
			date: "Wed, 1:02 PM",
			body: "@you was mentioned in #491, #492, and #493. Latest: Jordan Vega left a review on #491 with 2 comments.",
		}),
	},
	{
		id: "i7",
		category: "inbox",
		from: "Anya Volkov",
		initials: "AV",
		address: "anya@silvercreekdesign.com",
		subject: "Following up — illustration commission",
		preview:
			"Hi! Circling back on the brand illustrations for the marketing site. I have a slot opening up in two weeks if you'd like to move forward.",
		time: "Tue",
		unread: false,
		priority: "p2",
		tags: [tag("reply-later")],
		thread: singleMessageThread({
			id: "i7",
			from: "Anya Volkov",
			address: "anya@silvercreekdesign.com",
			date: "Tue, 11:48 AM",
			body: "Hi! Circling back on the brand illustrations for the marketing site. I have a slot opening up in two weeks if you'd like to move forward.",
		}),
	},
	{
		id: "i8",
		category: "inbox",
		from: "Calendly",
		initials: "CA",
		address: "no-reply@calendly.com",
		subject: "New event: Maya Chen on Friday at 2:30 PM",
		preview:
			"Maya Chen scheduled a 20-minute intro call for Friday, May 23 at 2:30 PM PT. Zoom link included.",
		time: "Tue",
		unread: false,
		priority: "p3",
		thread: singleMessageThread({
			id: "i8",
			from: "Calendly",
			address: "no-reply@calendly.com",
			date: "Tue, 9:14 AM",
			body: "Maya Chen scheduled a 20-minute intro call for Friday, May 23 at 2:30 PM PT. Zoom link included.",
		}),
	},
	{
		id: "i9",
		category: "inbox",
		from: "Toni Reyes",
		initials: "TR",
		address: "toni@hay.co",
		subject: "Re: AI assistant copy pass",
		preview:
			"First pass attached. I leaned plain and utilitarian like we talked about — let me know what reads off.",
		time: "Mon",
		unread: false,
		priority: "p3",
		thread: singleMessageThread({
			id: "i9",
			from: "Toni Reyes",
			address: "toni@hay.co",
			date: "Mon, 2:05 PM",
			body: "First pass attached. I leaned plain and utilitarian like we talked about — let me know what reads off.",
		}),
	},

	/* ===== Feed ===== */
	{
		id: "f1",
		category: "feed",
		from: "Stratechery",
		initials: "ST",
		address: "ben@stratechery.com",
		subject: "The platform shift nobody wants to talk about",
		preview:
			"Three years into the AI reset, the platform layer is more contested than it has ever been. This week's update covers the implications for incumbent SaaS, the new browser wars, and what it means for the apps you build on top.",
		time: "11:02",
		unread: true,
		thread: singleMessageThread({
			id: "f1",
			from: "Stratechery",
			address: "ben@stratechery.com",
			date: "Today, 11:02 AM",
			body: "Three years into the AI reset, the platform layer is more contested than it has ever been. This week's update covers the implications for incumbent SaaS, the new browser wars, and what it means for the apps you build on top.",
		}),
	},
	{
		id: "f2",
		category: "feed",
		from: "Vercel",
		initials: "VE",
		address: "team@vercel.com",
		subject: "What's new — May 2026",
		preview:
			"Edge functions are now 40% faster. Framework support expanded to four new frameworks. Plus a new pricing tier for solo developers.",
		time: "9:00",
		unread: false,
		thread: singleMessageThread({
			id: "f2",
			from: "Vercel",
			address: "team@vercel.com",
			date: "Today, 9:00 AM",
			body: "Edge functions are now 40% faster. Framework support expanded to four new frameworks. Plus a new pricing tier for solo developers.",
		}),
	},
	{
		id: "f3",
		category: "feed",
		from: "Substack — Anne Helen Petersen",
		initials: "SA",
		address: "annehelen@substack.com",
		subject: "On the quiet end of friendship",
		preview:
			"A reader writes in about a 15-year friendship that didn't end so much as fade. I want to talk about the unique kind of grief that lives there.",
		time: "8:14",
		unread: true,
		thread: singleMessageThread({
			id: "f3",
			from: "Substack — Anne Helen Petersen",
			address: "annehelen@substack.com",
			date: "Today, 8:14 AM",
			body: "A reader writes in about a 15-year friendship that didn't end so much as fade. I want to talk about the unique kind of grief that lives there.",
		}),
	},
	{
		id: "f4",
		category: "feed",
		from: "Figma",
		initials: "FI",
		address: "news@figma.com",
		subject: "Config 2026 — the lineup is here",
		preview:
			"Three days. Sixty-eight talks. Headliners from Pixar, Anthropic, and Glossier. Early-bird pricing ends Friday.",
		time: "Wed",
		unread: false,
		thread: singleMessageThread({
			id: "f4",
			from: "Figma",
			address: "news@figma.com",
			date: "Wed, 10:00 AM",
			body: "Three days. Sixty-eight talks. Headliners from Pixar, Anthropic, and Glossier. Early-bird pricing ends Friday.",
		}),
	},
	{
		id: "f5",
		category: "feed",
		from: "Morning Brew",
		initials: "MB",
		address: "crew@morningbrew.com",
		subject: "Markets: tariffs round 4, and what changed",
		preview:
			"Good morning. The fourth round of tariffs landed at midnight. Equities opened soft, the dollar firmed up against the yen, and oil is doing oil things.",
		time: "Wed",
		unread: false,
		thread: singleMessageThread({
			id: "f5",
			from: "Morning Brew",
			address: "crew@morningbrew.com",
			date: "Wed, 6:30 AM",
			body: "Good morning. The fourth round of tariffs landed at midnight. Equities opened soft, the dollar firmed up against the yen, and oil is doing oil things.",
		}),
	},
	{
		id: "f6",
		category: "feed",
		from: "The Browser",
		initials: "TB",
		address: "newsletter@thebrowser.com",
		subject: "Five articles worth your morning",
		preview:
			"Why glass keeps getting thinner. A neurosurgeon's case against helmet laws. The forgotten history of municipal compost. Plus two more.",
		time: "Tue",
		unread: false,
		thread: singleMessageThread({
			id: "f6",
			from: "The Browser",
			address: "newsletter@thebrowser.com",
			date: "Tue, 7:15 AM",
			body: "Why glass keeps getting thinner. A neurosurgeon's case against helmet laws. The forgotten history of municipal compost. Plus two more.",
		}),
	},
	{
		id: "f7",
		category: "feed",
		from: "Linear",
		initials: "LI",
		address: "team@linear.app",
		subject: "Changelog — Cycles 2.0, Initiatives, dark contrast theme",
		preview:
			"We rebuilt cycles from the ground up, shipped Initiatives for cross-team work, and added a high-contrast dark theme by popular request.",
		time: "Mon",
		unread: false,
		thread: singleMessageThread({
			id: "f7",
			from: "Linear",
			address: "team@linear.app",
			date: "Mon, 9:30 AM",
			body: "We rebuilt cycles from the ground up, shipped Initiatives for cross-team work, and added a high-contrast dark theme by popular request.",
		}),
	},

	/* ===== Paper Trail ===== */
	{
		id: "p1",
		category: "paper",
		from: "Stripe",
		initials: "ST",
		address: "receipts@stripe.com",
		subject: "Receipt from Linear — $96.00",
		preview: "Payment processed. Card ending 4242. Period: May 20 — Jun 20.",
		time: "7:31",
		unread: false,
		tags: [tag("receipt", "paper")],
		thread: singleMessageThread({
			id: "p1",
			from: "Stripe",
			address: "receipts@stripe.com",
			date: "Today, 7:31 AM",
			body: "Payment processed. Card ending 4242. Period: May 20 — Jun 20.",
		}),
	},
	{
		id: "p2",
		category: "paper",
		from: "Delta",
		initials: "DE",
		address: "deltaairlines@delta.com",
		subject: "Your flight confirmation — DL 482 to PDX",
		preview:
			"Confirmation #JK4Z9P. Departs SFO Wed Nov 26 at 6:14 PM. Seat 14C. Check in 24 hrs prior.",
		time: "Wed",
		unread: false,
		tags: [tag("confirmation")],
		thread: singleMessageThread({
			id: "p2",
			from: "Delta",
			address: "deltaairlines@delta.com",
			date: "Wed, 8:50 AM",
			body: "Confirmation #JK4Z9P. Departs SFO Wed Nov 26 at 6:14 PM. Seat 14C. Check in 24 hrs prior.",
		}),
	},
	{
		id: "p3",
		category: "paper",
		from: "Amazon",
		initials: "AM",
		address: "auto-confirm@amazon.com",
		subject: 'Shipped: Your order of "Cable Management Sleeve"',
		preview:
			"Arriving Friday, May 23. Track package in app or via the link below.",
		time: "Wed",
		unread: false,
		tags: [tag("shipping")],
		thread: singleMessageThread({
			id: "p3",
			from: "Amazon",
			address: "auto-confirm@amazon.com",
			date: "Wed, 7:00 AM",
			body: "Arriving Friday, May 23. Track package in app or via the link below.",
		}),
	},
	{
		id: "p4",
		category: "paper",
		from: "Brex",
		initials: "BR",
		address: "no-reply@brex.com",
		subject: "Card statement available — May 2026",
		preview: "Statement balance: $4,128.42. Due Jun 14. Auto-pay enabled.",
		time: "Tue",
		unread: false,
		tags: [tag("statement")],
		thread: singleMessageThread({
			id: "p4",
			from: "Brex",
			address: "no-reply@brex.com",
			date: "Tue, 6:00 AM",
			body: "Statement balance: $4,128.42. Due Jun 14. Auto-pay enabled.",
		}),
	},
	{
		id: "p5",
		category: "paper",
		from: "PG&E",
		initials: "PG",
		address: "donotreply@pge.com",
		subject: "Your bill is ready — $84.12",
		preview: "Billing period Apr 17 — May 16. Due Jun 2.",
		time: "Tue",
		unread: false,
		tags: [tag("bill")],
		thread: singleMessageThread({
			id: "p5",
			from: "PG&E",
			address: "donotreply@pge.com",
			date: "Tue, 5:30 AM",
			body: "Billing period Apr 17 — May 16. Due Jun 2.",
		}),
	},
	{
		id: "p6",
		category: "paper",
		from: "Notion",
		initials: "NO",
		address: "team@notion.so",
		subject: "Receipt — Notion AI add-on",
		preview: "Thanks for your payment of $20.00. Period: May 18 — Jun 18.",
		time: "Mon",
		unread: false,
		tags: [tag("receipt", "paper")],
		thread: singleMessageThread({
			id: "p6",
			from: "Notion",
			address: "team@notion.so",
			date: "Mon, 8:00 AM",
			body: "Thanks for your payment of $20.00. Period: May 18 — Jun 18.",
		}),
	},
	{
		id: "p7",
		category: "paper",
		from: "DoorDash",
		initials: "DO",
		address: "no-reply@doordash.com",
		subject: "Order delivered — Tartine Bakery",
		preview: "Your order was delivered at 8:42 AM. Total $24.18.",
		time: "Mon",
		unread: false,
		tags: [tag("receipt", "paper")],
		thread: singleMessageThread({
			id: "p7",
			from: "DoorDash",
			address: "no-reply@doordash.com",
			date: "Mon, 8:42 AM",
			body: "Your order was delivered at 8:42 AM. Total $24.18.",
		}),
	},
];

/**
 * SCREENER_ITEMS — senders awaiting Screener triage.
 *
 * Ported from the prototype `SAMPLE.screener` (4 first-time senders). Each
 * carries the AI hint + suggested category exactly as the prototype shows
 * them in the `.screener-ai` row and the "ACCEPT INTO <CATEGORY>" action.
 */
export const SCREENER_ITEMS: ScreenerItem[] = [
	{
		id: "s1",
		from: "Maya Chen",
		initials: "MC",
		address: "maya.chen@northstarcap.com",
		subject: "Intro — angel check for your seed round",
		preview:
			"Hi! I was forwarded your deck by Jamie. Quick context — I write $25–100k checks into developer infrastructure and have led seed rounds at three companies in your space. Would love 20 minutes this week if you have time.",
		time: "9:14",
		suggested: "inbox",
		suggestedLabel: "Looks like a warm investor intro. Recommend Inbox.",
	},
	{
		id: "s2",
		from: "ResonateHQ",
		initials: "RE",
		address: "team@resonate.so",
		subject: "Your monthly product digest — May edition",
		preview:
			"What shipped this month: AI Recap 2.0, retro themes, a redesigned project sidebar, and 14 small fixes. Read the full changelog →",
		time: "8:02",
		suggested: "feed",
		suggestedLabel: "Marketing newsletter. Recommend Feed.",
	},
	{
		id: "s3",
		from: "Stripe",
		initials: "ST",
		address: "receipts@stripe.com",
		subject: "Receipt from Linear — $96.00",
		preview:
			"Your payment of $96.00 to Linear has been processed. View receipt and invoice details below.",
		time: "7:31",
		suggested: "paper",
		suggestedLabel: "Transactional receipt. Recommend Paper Trail.",
	},
	{
		id: "s4",
		from: "Liam Park",
		initials: "LP",
		address: "liam@bluegrouseaudio.co",
		subject: "Quick question about your guitar pickup wiring",
		preview:
			"Hey — saw your post on the Reverb forum about humbucker rewiring. I'm doing a similar swap on a 2003 Tele and wondered if you ran into the same grounding issue with the bridge plate.",
		time: "Wed",
		suggested: "inbox",
		suggestedLabel: "Personal cold email. Recommend Inbox.",
	},
];

/**
 * screenerItemToMailRow — synthesize a category mail row from an accepted
 * Screener sender, so accepting routes the sender into their suggested list.
 *
 * Mirrors the prototype root app: an accepted screener item becomes a new
 * unread row (`ns-<id>`) prepended to its suggested category list, carrying the
 * sender's subject/preview/time. The generated thread reuses the preview as a
 * single message so the reading pane stays populated for newly routed items.
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
		id: `ns-${item.id}`,
		category: item.suggested,
		from: item.from,
		initials: item.initials,
		address: item.address,
		subject: item.subject,
		preview: item.preview,
		time: item.time,
		unread: true,
		priority: item.suggested === "inbox" ? "p2" : undefined,
		tags: [{ label: tagLabel, variant: tagVariant }],
		thread: singleMessageThread({
			id: `ns-${item.id}`,
			from: item.from,
			address: item.address,
			date: "Just now",
			body: item.preview,
		}),
	};
}

/**
 * TASK_CARDS — tasks extracted from mail, shown on the Tasks & Dates screen.
 * Ported verbatim from the prototype `TasksScreen` `tasks` array (5 tasks).
 */
export const TASK_CARDS: TaskCard[] = [
	{
		id: "t1",
		title: "Confirm pod A staffing — was the seventh req rolled into pod C?",
		due: "Before 1:1",
		source: "Priya Ramanathan · Q3 hiring plan",
	},
	{
		id: "t2",
		title: "Decide on moving design hire forward by 6 weeks",
		due: "Tomorrow",
		source: "Priya Ramanathan · Q3 hiring plan",
	},
	{
		id: "t3",
		title: "Review Marcus's SAFE redlines, esp. pro-rata clause",
		due: "Wed",
		source: "Marcus Okafor · Term sheet",
	},
	{
		id: "t4",
		title: "Review PR #482 (auth refactor) — third revision",
		due: "This week",
		source: "Jordan Vega · GitHub",
	},
	{
		id: "t5",
		title: "Reply to Anya re: illustration commission slot",
		due: "By Friday",
		source: "Anya Volkov · Silver Creek Design",
	},
];

/**
 * DATE_CARDS — dates extracted from mail, shown on the Tasks & Dates screen.
 * Ported verbatim from the prototype `TasksScreen` `dates` array (5 dates).
 */
export const DATE_CARDS: DateCard[] = [
	{
		id: "d1",
		title: "1:1 with Priya — Q3 hiring follow-up",
		when: "Tomorrow, 9:00 AM",
		source: "Priya Ramanathan",
	},
	{
		id: "d2",
		title: "Intro call with Maya Chen — NorthStar",
		when: "Fri May 23, 2:30 PM",
		source: "Maya Chen · Calendly",
	},
	{
		id: "d3",
		title: "Walkthrough call with Marcus — SAFE redlines",
		when: "Tomorrow",
		source: "Marcus Okafor · Catalyst",
	},
	{
		id: "d4",
		title: "Amazon delivery — cable management sleeve",
		when: "Fri May 23",
		source: "Amazon shipping notice",
	},
	{
		id: "d5",
		title: "Flight DL 482 SFO→PDX",
		when: "Wed Nov 26, 6:14 PM",
		source: "Delta confirmation",
	},
];

/**
 * AI_USAGE — mock AI usage figures for the sidebar usage card.
 * Prototype shows "34/100 monthly · Free tier" (bar at 34%).
 */
export const AI_USAGE = {
	used: 34,
	limit: 100,
	tier: "Free tier",
	get pct(): number {
		return Math.round((this.used / this.limit) * 100);
	},
};

/* ===================================================================
 * Ask Hay (assistant) — mock conversation + citations.
 *
 * Ported from the prototype `Assistant` component (asset `fa7745fc`): the
 * opening greeting, the four example prompts, and the canned replies keyed on
 * Priya / Stripe / screener / Marcus, each citing existing demo thread ids so
 * the "open thread" affordance routes the shell to the right category.
 * =================================================================== */

/** A cited source attached to an assistant reply. */
export type AssistantCitation = {
	num: number;
	from: string;
	subject: string;
	time: string;
	/** Existing MailRow id to open when the citation is clicked. */
	threadId: string;
};

/** A single message in the Ask Hay conversation. */
export type AssistantMessage = {
	role: "ai" | "user";
	text: string;
	cites?: AssistantCitation[];
};

/** The assistant's opening message (shown before the user asks anything). */
export const ASSISTANT_GREETING: AssistantMessage = {
	role: "ai",
	text: "Search synced threads, ask about anything you've received, or issue a read-only bulk command. I won't send or delete without confirmation.",
	cites: [],
};

/** Example prompts surfaced before the first question. */
export const ASSISTANT_EXAMPLES: string[] = [
	"What did Priya want me to confirm before our 1:1?",
	"Find all receipts from Stripe this month",
	"Anything urgent in the screener?",
	"Summarize Marcus's term sheet thread",
];

/**
 * assistantReply — mock semantic-search responder.
 *
 * Matches the user's text against the prototype's canned intents and returns
 * an AI message with citations pointing at existing demo threads. Falls back
 * to a capability blurb for anything unrecognized. Pure + deterministic.
 */
export function assistantReply(text: string): AssistantMessage {
	if (/priya/i.test(text)) {
		return {
			role: "ai",
			text: "Priya wants you to confirm two things before your 1:1 tomorrow:\n\n1. Pod A staffing — was the seventh req rolled into pod C, or did it disappear?\n2. Whether you'll move the design hire forward by six weeks to support the marketing site rebuild.\n\nShe sent the latest review this morning at 10:42 AM.",
			cites: [
				{
					num: 1,
					from: "Priya Ramanathan",
					subject: "Re: Q3 hiring plan — final review",
					time: "Today, 10:42 AM",
					threadId: "i1",
				},
			],
		};
	}
	if (/stripe|receipt/i.test(text)) {
		return {
			role: "ai",
			text: "Found 2 Stripe receipts in your Paper Trail from May:\n\n• Linear — $96.00 (today)\n• Notion AI — $20.00 (Mon)\n\nTotal across both: $116.00.",
			cites: [
				{
					num: 1,
					from: "Stripe",
					subject: "Receipt from Linear — $96.00",
					time: "Today",
					threadId: "p1",
				},
				{
					num: 2,
					from: "Notion",
					subject: "Receipt — Notion AI add-on",
					time: "Mon",
					threadId: "p6",
				},
			],
		};
	}
	if (/urgent|screener/i.test(text)) {
		return {
			role: "ai",
			text: 'Two screener items look time-sensitive:\n\n• Maya Chen (NorthStar) — angel intro, mentions "this week"\n• Liam Park — personal cold question, no urgency\n\nMaya is the only one I\'d surface as potentially worth notifying about.',
			cites: [
				{
					num: 1,
					from: "Calendly",
					subject: "New event: Maya Chen on Friday at 2:30 PM",
					time: "Tue",
					threadId: "i8",
				},
			],
		};
	}
	if (/term sheet|marcus/i.test(text)) {
		return {
			role: "ai",
			text: "Marcus from Catalyst sent SAFE redlines this morning. Most language is standard, but he flagged the pro-rata clause for discussion. He's offering to walk through it on a call tomorrow.",
			cites: [
				{
					num: 1,
					from: "Marcus Okafor",
					subject: "Term sheet — redlines attached",
					time: "10:18 AM",
					threadId: "i2",
				},
			],
		};
	}
	return {
		role: "ai",
		text: "I can search synced threads, summarize, surface tasks and dates, and propose bulk archives. I won't draft replies or compose for you in MVP.",
		cites: [],
	};
}

/** Which category a given thread id lives in, for the open-thread affordance. */
export function categoryForThread(threadId: string): CategoryId | null {
	return MAIL_ROWS.find((r) => r.id === threadId)?.category ?? null;
}
