/**
 * Pure routing engine for incoming Gmail messages.
 *
 * Decides where a freshly ingested message lands (Screener, a category,
 * spam, hidden, or skipped) from facts the caller already gathered. This
 * module performs NO I/O: no db access, no Gmail client, no imports beyond
 * its own types. Callers (the ingest pipeline) look up the sender trust row
 * and any existing thread, then ask this function for a decision.
 *
 * Rules, evaluated in order (first match wins):
 *
 *  (a) Message belongs to an EXISTING thread → stay in-thread. The thread's
 *      state is unchanged and sender screening is untouched — a reply from a
 *      still-unscreened sender into an active thread does NOT bounce the
 *      thread back to the Screener, and does not screen the sender for
 *      future new threads.
 *  (b) Provider spam flag (initial ingest) → new thread with state `spam`,
 *      even when the sender is accepted. Spam never lands in the Screener.
 *  (c) Trash/deleted flag at initial ingest → skip ingest entirely.
 *  (d) Sender trust `rejected` → ingest with thread state `hidden`.
 *  (e) Sender trust `accepted` → thread state `categorized` with the
 *      sender's `default_category`.
 *  (f) Otherwise (unscreened sender, or no sender row yet) → `screener`.
 *
 * Non-inputs, by design: Gmail CATEGORY_* labels and importance markers are
 * never consulted — categorization is owned by Atlas screening, not Gmail.
 *
 * Documented assumptions:
 *  - Rule (a) outranks the spam/trash flags: provider flags on a reply into
 *    an already-ingested thread do not retro-route or skip the message; the
 *    message is stored in its thread as-is.
 *  - Rule (b) outranks (c): a message somehow flagged both spam and trashed
 *    at initial ingest is ingested as spam rather than skipped, per the
 *    stated rule order.
 *  - An accepted sender whose `default_category` is null (the column is
 *    nullable) categorizes to `inbox` as the neutral fallback rather than
 *    falling back to the Screener — acceptance has already been decided.
 */

/** Sender screening verdict, mirroring `sender.trust` in the db schema. */
export type SenderTrust = "unscreened" | "accepted" | "rejected";

/** Mail category, mirroring `thread.category` / `sender.default_category`. */
export type Category = "inbox" | "feed" | "paper_trail";

/** Thread routing state, mirroring `thread.state` in the db schema. */
export type ThreadState = "screener" | "spam" | "categorized" | "hidden";

/** The slice of a sender trust row the engine needs (null = no row yet). */
export interface SenderInput {
	trust: SenderTrust;
	defaultCategory: Category | null;
}

/** The slice of an existing thread row the engine needs (null = new thread). */
export interface ExistingThreadInput {
	state: ThreadState;
}

/** Facts about one incoming message, gathered by the caller. */
export interface RoutingInput {
	/** Provider spam flag, evaluated at initial ingest only. */
	spamFlagged: boolean;
	/** Provider trash/deleted flag, evaluated at initial ingest only. */
	trashFlagged: boolean;
	/** Sender trust row for the message's from-address, or null if none. */
	sender: SenderInput | null;
	/** Already-ingested thread this message belongs to, or null if new. */
	existingThread: ExistingThreadInput | null;
}

/** Where an incoming message goes. */
export type RoutingDecision =
	/** Trashed at initial ingest — do not ingest the message at all. */
	| { action: "skip_ingest"; reason: "trashed_at_initial_ingest" }
	/**
	 * Append to the existing thread. Thread state stays as-is and sender
	 * screening is untouched.
	 */
	| { action: "ingest_into_existing_thread" }
	/**
	 * Create a new thread. `category` is non-null exactly when `threadState`
	 * is `categorized`.
	 */
	| {
			action: "ingest_new_thread";
			threadState: ThreadState;
			category: Category | null;
	  };

/** Fallback category for accepted senders with no `default_category` set. */
export const DEFAULT_ACCEPTED_CATEGORY: Category = "inbox";

/** Decide routing for one incoming message. Pure — no I/O, no db. */
export function routeIncomingMessage(input: RoutingInput): RoutingDecision {
	// (a) Replies into an already-ingested thread stay in-thread.
	if (input.existingThread !== null) {
		return { action: "ingest_into_existing_thread" };
	}

	// (b) Provider spam flag wins over sender trust — never the Screener.
	if (input.spamFlagged) {
		return { action: "ingest_new_thread", threadState: "spam", category: null };
	}

	// (c) Trashed at initial ingest — skip entirely.
	if (input.trashFlagged) {
		return { action: "skip_ingest", reason: "trashed_at_initial_ingest" };
	}

	// (d) Rejected sender — ingest but keep hidden.
	if (input.sender?.trust === "rejected") {
		return {
			action: "ingest_new_thread",
			threadState: "hidden",
			category: null,
		};
	}

	// (e) Accepted sender — straight to their default category.
	if (input.sender?.trust === "accepted") {
		return {
			action: "ingest_new_thread",
			threadState: "categorized",
			category: input.sender.defaultCategory ?? DEFAULT_ACCEPTED_CATEGORY,
		};
	}

	// (f) Unscreened sender (or no sender row yet) — the Screener decides.
	return {
		action: "ingest_new_thread",
		threadState: "screener",
		category: null,
	};
}
