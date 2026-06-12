import { describe, expect, it } from "bun:test";

import {
	type Category,
	DEFAULT_ACCEPTED_CATEGORY,
	type ExistingThreadInput,
	type RoutingDecision,
	type RoutingInput,
	routeIncomingMessage,
	type SenderInput,
	type SenderTrust,
	type ThreadState,
} from "./routing.ts";

const ALL_THREAD_STATES: ThreadState[] = [
	"screener",
	"spam",
	"categorized",
	"hidden",
];
const ALL_CATEGORIES: Category[] = ["inbox", "feed", "paper_trail"];

const sender = (
	trust: SenderTrust,
	defaultCategory: Category | null = null,
): SenderInput => ({ trust, defaultCategory });

const input = (overrides: Partial<RoutingInput> = {}): RoutingInput => ({
	spamFlagged: false,
	trashFlagged: false,
	sender: null,
	existingThread: null,
	...overrides,
});

const SKIP: RoutingDecision = {
	action: "skip_ingest",
	reason: "trashed_at_initial_ingest",
};
const IN_THREAD: RoutingDecision = { action: "ingest_into_existing_thread" };
const newThread = (
	threadState: ThreadState,
	category: Category | null = null,
): RoutingDecision => ({ action: "ingest_new_thread", threadState, category });

describe("routeIncomingMessage", () => {
	describe("(a) existing thread: message stays in-thread, state unchanged", () => {
		// Every combination of prior thread state × sender trust (incl. no
		// sender row) × provider flags resolves to in-thread ingestion with
		// no state change and no screening side effect.
		const senderVariants: Array<[string, SenderInput | null]> = [
			["no sender row", null],
			["unscreened sender", sender("unscreened")],
			["accepted sender", sender("accepted", "feed")],
			["rejected sender", sender("rejected")],
		];
		const flagVariants: Array<[string, Partial<RoutingInput>]> = [
			["no flags", {}],
			["spam-flagged", { spamFlagged: true }],
			["trash-flagged", { trashFlagged: true }],
			["spam+trash-flagged", { spamFlagged: true, trashFlagged: true }],
		];

		for (const state of ALL_THREAD_STATES) {
			for (const [senderLabel, senderRow] of senderVariants) {
				for (const [flagLabel, flags] of flagVariants) {
					it(`thread=${state}, ${senderLabel}, ${flagLabel} → stay in-thread`, () => {
						const existingThread: ExistingThreadInput = { state };
						expect(
							routeIncomingMessage(
								input({ existingThread, sender: senderRow, ...flags }),
							),
						).toEqual(IN_THREAD);
					});
				}
			}
		}

		it("reply from a still-unscreened sender into an active categorized thread stays in-thread (never bounced to Screener)", () => {
			const decision = routeIncomingMessage(
				input({
					existingThread: { state: "categorized" },
					sender: sender("unscreened"),
				}),
			);
			expect(decision).toEqual(IN_THREAD);
			// The decision carries no thread-state or category mutation and no
			// sender screening verdict — screening for future new threads is
			// untouched.
			expect(decision).not.toHaveProperty("threadState");
			expect(decision).not.toHaveProperty("category");
		});

		it("reply from an unscreened sender into a thread still sitting in the Screener stays in-thread", () => {
			expect(
				routeIncomingMessage(
					input({
						existingThread: { state: "screener" },
						sender: sender("unscreened"),
					}),
				),
			).toEqual(IN_THREAD);
		});
	});

	describe("(b) provider spam flag → state `spam`, never the Screener", () => {
		const cases: Array<[string, SenderInput | null]> = [
			["no sender row", null],
			["unscreened sender", sender("unscreened")],
			[
				"accepted sender (spam wins over acceptance)",
				sender("accepted", "inbox"),
			],
			["rejected sender (spam wins over hidden)", sender("rejected")],
		];

		for (const [label, senderRow] of cases) {
			it(`spam-flagged, ${label} → new thread in spam`, () => {
				expect(
					routeIncomingMessage(input({ spamFlagged: true, sender: senderRow })),
				).toEqual(newThread("spam"));
			});
		}

		it("spam-flagged AND trash-flagged → spam (rule order: b before c)", () => {
			expect(
				routeIncomingMessage(input({ spamFlagged: true, trashFlagged: true })),
			).toEqual(newThread("spam"));
		});
	});

	describe("(c) trash/deleted at initial ingest → skip ingest", () => {
		const cases: Array<[string, SenderInput | null]> = [
			["no sender row", null],
			["unscreened sender", sender("unscreened")],
			["accepted sender", sender("accepted", "paper_trail")],
			["rejected sender", sender("rejected")],
		];

		for (const [label, senderRow] of cases) {
			it(`trash-flagged, ${label} → skip ingest`, () => {
				expect(
					routeIncomingMessage(
						input({ trashFlagged: true, sender: senderRow }),
					),
				).toEqual(SKIP);
			});
		}
	});

	describe("(d) rejected sender → ingest hidden", () => {
		it("rejected sender, new thread → hidden, no category", () => {
			expect(
				routeIncomingMessage(input({ sender: sender("rejected") })),
			).toEqual(newThread("hidden"));
		});

		it("rejected sender with a stale default_category still routes hidden", () => {
			expect(
				routeIncomingMessage(input({ sender: sender("rejected", "feed") })),
			).toEqual(newThread("hidden"));
		});
	});

	describe("(e) accepted sender → categorized with default_category", () => {
		for (const category of ALL_CATEGORIES) {
			it(`accepted sender with default_category=${category} → categorized/${category}`, () => {
				expect(
					routeIncomingMessage(input({ sender: sender("accepted", category) })),
				).toEqual(newThread("categorized", category));
			});
		}

		it("accepted sender with null default_category falls back to inbox", () => {
			expect(
				routeIncomingMessage(input({ sender: sender("accepted", null) })),
			).toEqual(newThread("categorized", DEFAULT_ACCEPTED_CATEGORY));
			expect(DEFAULT_ACCEPTED_CATEGORY).toBe("inbox");
		});
	});

	describe("(f) unscreened → Screener", () => {
		it("no sender row yet → screener", () => {
			expect(routeIncomingMessage(input())).toEqual(newThread("screener"));
		});

		it("unscreened sender row → screener", () => {
			expect(
				routeIncomingMessage(input({ sender: sender("unscreened") })),
			).toEqual(newThread("screener"));
		});

		it("unscreened sender with a pre-set default_category still goes to the Screener", () => {
			expect(
				routeIncomingMessage(input({ sender: sender("unscreened", "feed") })),
			).toEqual(newThread("screener"));
		});
	});

	describe("invariants", () => {
		it("category is non-null exactly when threadState is `categorized` (exhaustive new-thread sweep)", () => {
			const senderVariants: Array<SenderInput | null> = [
				null,
				sender("unscreened"),
				sender("unscreened", "inbox"),
				sender("accepted", null),
				...ALL_CATEGORIES.map((c) => sender("accepted", c)),
				sender("rejected"),
				sender("rejected", "inbox"),
			];

			for (const senderRow of senderVariants) {
				for (const spamFlagged of [false, true]) {
					for (const trashFlagged of [false, true]) {
						const decision = routeIncomingMessage(
							input({ sender: senderRow, spamFlagged, trashFlagged }),
						);
						if (decision.action === "ingest_new_thread") {
							expect(decision.category !== null).toBe(
								decision.threadState === "categorized",
							);
							// New threads are never created directly in `hidden`-less
							// invalid states; threadState is one of the schema enums.
							expect(ALL_THREAD_STATES).toContain(decision.threadState);
						}
					}
				}
			}
		});

		it("never skips ingest unless trash-flagged at initial ingest", () => {
			const senderVariants: Array<SenderInput | null> = [
				null,
				sender("unscreened"),
				sender("accepted", "inbox"),
				sender("rejected"),
			];
			for (const senderRow of senderVariants) {
				for (const spamFlagged of [false, true]) {
					const decision = routeIncomingMessage(
						input({ sender: senderRow, spamFlagged, trashFlagged: false }),
					);
					expect(decision.action).not.toBe("skip_ingest");
				}
			}
		});
	});
});

describe("module purity", () => {
	it("imports no db, drizzle, gmail client, redis, or job code", async () => {
		const source = await Bun.file(
			new URL("./routing.ts", import.meta.url),
		).text();
		const importLines = source
			.split("\n")
			.filter((line) => /^\s*(import|export)\b.*\bfrom\s+["']/.test(line));
		// The module must be fully self-contained: zero runtime imports.
		expect(importLines).toEqual([]);
		for (const forbidden of [
			"../../db",
			"drizzle",
			"gmail",
			"redis",
			"jobify",
			"bullmq",
		]) {
			expect(source).not.toContain(`from "${forbidden}`);
		}
	});
});
