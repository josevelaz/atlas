// Atlas — Ask Atlas canned assistant responses
//
// Typed port of the assistant logic in `docs/prototype/screens.jsx`. The
// prototype matched the query against a series of regexes and returned a canned
// reply; here that branching is data-driven via ordered {@link AssistantRule}s.
// Content (reply text, citations, example prompts, intro message) is preserved
// verbatim. No runtime imports from `docs/prototype/**`.

import type { AssistantMessage, AssistantRule } from "./types";

/** The assistant's initial greeting bubble. */
export const ASSISTANT_INTRO: AssistantMessage = {
	role: "ai",
	text: "Search synced threads, ask about anything you've received, or issue a read-only bulk command. I won't send or delete without confirmation.",
	cites: [],
};

/** Example prompt chips shown while only the intro message is present. */
export const ASSISTANT_EXAMPLES: string[] = [
	"What did Priya want me to confirm before our 1:1?",
	"Find all receipts from Stripe this month",
	"Anything urgent in the screener?",
	"Summarize Marcus's term sheet thread",
];

/**
 * Ordered rule list. The first rule whose `pattern` tests true against the
 * query wins; the final catch-all rule (`/.* /`) is the fallback reply.
 */
export const ASSISTANT_RULES: AssistantRule[] = [
	{
		pattern: /priya/i,
		reply: {
			role: "ai",
			text: "Priya wants you to confirm two things before your 1:1 tomorrow:\n\n1. Pod A staffing — was the seventh req rolled into pod C, or did it disappear?\n2. Whether you'll move the design hire forward by six weeks to support the marketing site rebuild.\n\nShe sent the latest review this morning at 10:42 AM.",
			cites: [
				{
					num: 1,
					from: "Priya Ramanathan",
					subject: "Re: Q3 hiring plan — final review",
					time: "Today, 10:42 AM",
					id: "i1",
				},
			],
		},
	},
	{
		pattern: /stripe|receipt/i,
		reply: {
			role: "ai",
			text: "Found 2 Stripe receipts in your Paper Trail from May:\n\n• Linear — $96.00 (today)\n• Notion AI — $20.00 (Mon)\n\nTotal across both: $116.00.",
			cites: [
				{
					num: 1,
					from: "Stripe",
					subject: "Receipt from Linear — $96.00",
					time: "Today",
					id: "p1",
				},
				{
					num: 2,
					from: "Notion",
					subject: "Receipt — Notion AI add-on",
					time: "Mon",
					id: "p6",
				},
			],
		},
	},
	{
		pattern: /urgent|screener/i,
		reply: {
			role: "ai",
			text: 'Two screener items look time-sensitive:\n\n• Maya Chen (NorthStar) — angel intro, mentions "this week"\n• Liam Park — personal cold question, no urgency\n\nMaya is the only one I\'d surface as potentially worth notifying about.',
			cites: [
				{
					num: 1,
					from: "Maya Chen",
					subject: "Intro — angel check for your seed round",
					time: "9:14 AM",
					id: "s1",
				},
			],
		},
	},
	{
		pattern: /term sheet|marcus/i,
		reply: {
			role: "ai",
			text: "Marcus from Catalyst sent SAFE redlines this morning. Most language is standard, but he flagged the pro-rata clause for discussion. He's offering to walk through it on a call tomorrow.",
			cites: [
				{
					num: 1,
					from: "Marcus Okafor",
					subject: "Term sheet — redlines attached",
					time: "10:18 AM",
					id: "i2",
				},
			],
		},
	},
	{
		// Fallback — always matches.
		pattern: /[\s\S]*/,
		reply: {
			role: "ai",
			text: "I can search synced threads, summarize, surface tasks and dates, and propose bulk archives. I won't draft replies or compose for you in MVP.",
			cites: [],
		},
	},
];

/** The catch-all fallback reply (last rule), used when no pattern matches. */
const FALLBACK_REPLY: AssistantMessage =
	ASSISTANT_RULES[ASSISTANT_RULES.length - 1]?.reply ?? ASSISTANT_INTRO;

/** Resolve the canned reply for a query by walking {@link ASSISTANT_RULES}. */
export function answerQuery(query: string): AssistantMessage {
	const rule = ASSISTANT_RULES.find((r) => r.pattern.test(query));
	// The catch-all guarantees a match, but fall back defensively.
	return rule ? rule.reply : FALLBACK_REPLY;
}
