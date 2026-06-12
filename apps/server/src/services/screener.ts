/**
 * Screener decisions (sender trust) and per-thread category overrides.
 *
 * Decisions are USER-GLOBAL: the `sender` table is unique on
 * (user_id, email_address), so accepting/rejecting/recovering a sender
 * applies across every connected account of the same user. Threads remain
 * mailbox-specific records — bulk moves below therefore match on
 * (thread.user_id, thread.sender_email), never on connected_account_id.
 *
 * FUTURE routing is owned by the pure engine in
 * `services/ingestion/routing.ts`, which reads the sender trust row this
 * module writes — accept/reject/recover only have to update the rule and
 * sweep the EXISTING threads:
 *
 *   - accept  → trust `accepted` + default_category; the sender's
 *     `screener` threads move to `categorized` with that category.
 *     Hidden threads are deliberately untouched — restoring them is the
 *     recover endpoint's job.
 *   - reject  → trust `rejected`; the sender's `screener` threads move to
 *     `hidden` (recoverable — thread detail still resolves hidden threads).
 *     Already-categorized threads are NOT hidden: the user triaged them.
 *   - recover → re-accept a rejected sender with a category; optionally
 *     restore that sender's `hidden` threads to `categorized`.
 *
 * Per-thread override sets `category_overridden` so later automation knows
 * the user pinned this thread's category. With `promote` the sender's
 * routing rule is ALSO updated (accepted + default_category) — but other
 * existing threads are not swept; promote changes the rule, accept does
 * the sweep.
 *
 * Sender emails are normalized (trim + lowercase) to match ingest, which
 * lowercases parsed From addresses before persisting.
 *
 * Testability: no db work at import time — the default client resolves
 * lazily and every function accepts an injectable `dbClient`.
 */

import { and, count, desc, eq } from "drizzle-orm";

import { sender, thread } from "../db/schema.ts";
import { ThreadNotFoundError } from "./mail_queries.ts";

type Db = typeof import("../db/index.ts")["db"];

let defaultDb: Db | undefined;

const getDb = async (): Promise<Db> => {
	if (!defaultDb) {
		({ db: defaultDb } = await import("../db/index.ts"));
	}
	return defaultDb;
};

/** Mail category, mirroring `thread.category` / `sender.default_category`. */
export type ScreenerCategory = "inbox" | "feed" | "paper_trail";

/**
 * No sender with trust `rejected` exists for this user+email. Missing
 * senders and non-rejected senders are deliberately indistinguishable.
 */
export class RejectedSenderNotFoundError extends Error {
	readonly code = "REJECTED_SENDER_NOT_FOUND";

	constructor(emailAddress: string) {
		super(`Rejected sender not found: ${emailAddress}`);
		this.name = "RejectedSenderNotFoundError";
	}
}

/** Match ingest's normalization of parsed From addresses. */
export const normalizeSenderEmail = (raw: string): string =>
	raw.trim().toLowerCase();

export interface AcceptSenderResult {
	emailAddress: string;
	/** Screener threads moved to `categorized` (across all accounts). */
	movedThreadCount: number;
}

/**
 * Accept a sender: set the user-global routing rule (trust `accepted` +
 * `default_category`) and move the sender's existing `screener` threads —
 * across ALL of the user's connected accounts — to `categorized` with the
 * chosen category. Upserts the sender row so accepting an address that has
 * no row yet (or re-deciding an already-screened one) both work.
 */
export const acceptSender = async (
	userId: string,
	emailAddress: string,
	category: ScreenerCategory,
	dbClient?: Db,
): Promise<AcceptSenderResult> => {
	const db = dbClient ?? (await getDb());
	const email = normalizeSenderEmail(emailAddress);

	return db.transaction(async (tx) => {
		const decidedAt = new Date();
		await tx
			.insert(sender)
			.values({
				userId,
				emailAddress: email,
				trust: "accepted",
				defaultCategory: category,
				decidedAt,
			})
			.onConflictDoUpdate({
				target: [sender.userId, sender.emailAddress],
				set: { trust: "accepted", defaultCategory: category, decidedAt },
			});

		const moved = await tx
			.update(thread)
			.set({ state: "categorized", category })
			.where(
				and(
					eq(thread.userId, userId),
					eq(thread.senderEmail, email),
					eq(thread.state, "screener"),
				),
			)
			.returning({ id: thread.id });

		return { emailAddress: email, movedThreadCount: moved.length };
	});
};

export interface RejectSenderResult {
	emailAddress: string;
	/** Screener threads moved to `hidden` (across all accounts). */
	hiddenThreadCount: number;
}

/**
 * Reject a sender: set the user-global rule to trust `rejected` (future new
 * threads ingest as `hidden` via the routing engine) and move the sender's
 * current `screener` threads to `hidden`. Recoverable — nothing is deleted
 * and {@link recoverSender} can restore both the rule and the threads.
 * Any existing `default_category` is kept for reference; recover takes an
 * explicit category anyway.
 */
export const rejectSender = async (
	userId: string,
	emailAddress: string,
	dbClient?: Db,
): Promise<RejectSenderResult> => {
	const db = dbClient ?? (await getDb());
	const email = normalizeSenderEmail(emailAddress);

	return db.transaction(async (tx) => {
		const decidedAt = new Date();
		await tx
			.insert(sender)
			.values({
				userId,
				emailAddress: email,
				trust: "rejected",
				decidedAt,
			})
			.onConflictDoUpdate({
				target: [sender.userId, sender.emailAddress],
				set: { trust: "rejected", decidedAt },
			});

		const hidden = await tx
			.update(thread)
			.set({ state: "hidden", category: null })
			.where(
				and(
					eq(thread.userId, userId),
					eq(thread.senderEmail, email),
					eq(thread.state, "screener"),
				),
			)
			.returning({ id: thread.id });

		return { emailAddress: email, hiddenThreadCount: hidden.length };
	});
};

export interface RejectedSenderDto {
	emailAddress: string;
	/** ISO 8601, or null for legacy rows without a decision timestamp. */
	decidedAt: string | null;
	/** Currently hidden threads from this sender (across all accounts). */
	hiddenThreadCount: number;
}

/** List the user's rejected senders, most recently decided first. */
export const listRejectedSenders = async (
	userId: string,
	dbClient?: Db,
): Promise<RejectedSenderDto[]> => {
	const db = dbClient ?? (await getDb());

	const rows = await db
		.select({
			emailAddress: sender.emailAddress,
			decidedAt: sender.decidedAt,
			hiddenThreadCount: count(thread.id),
		})
		.from(sender)
		.leftJoin(
			thread,
			and(
				eq(thread.userId, sender.userId),
				eq(thread.senderEmail, sender.emailAddress),
				eq(thread.state, "hidden"),
			),
		)
		.where(and(eq(sender.userId, userId), eq(sender.trust, "rejected")))
		.groupBy(sender.id, sender.emailAddress, sender.decidedAt)
		.orderBy(desc(sender.decidedAt), desc(sender.id));

	return rows.map((row) => ({
		emailAddress: row.emailAddress,
		decidedAt: row.decidedAt?.toISOString() ?? null,
		hiddenThreadCount: row.hiddenThreadCount,
	}));
};

export interface RecoverSenderOptions {
	category: ScreenerCategory;
	/** Also move the sender's `hidden` threads back to `categorized`. */
	restoreHidden?: boolean;
}

export interface RecoverSenderResult {
	emailAddress: string;
	/** Hidden threads restored to `categorized` (0 unless restoreHidden). */
	restoredThreadCount: number;
}

/**
 * Recover a previously rejected sender: re-accept with a category and,
 * when `restoreHidden` is set, restore that sender's `hidden` threads to
 * `categorized`. Throws {@link RejectedSenderNotFoundError} when the user
 * has no rejected sender for this address.
 */
export const recoverSender = async (
	userId: string,
	emailAddress: string,
	options: RecoverSenderOptions,
	dbClient?: Db,
): Promise<RecoverSenderResult> => {
	const db = dbClient ?? (await getDb());
	const email = normalizeSenderEmail(emailAddress);

	return db.transaction(async (tx) => {
		const rows = await tx
			.select({ id: sender.id, trust: sender.trust })
			.from(sender)
			.where(and(eq(sender.userId, userId), eq(sender.emailAddress, email)))
			.limit(1);
		const row = rows[0];
		if (!row || row.trust !== "rejected") {
			throw new RejectedSenderNotFoundError(email);
		}

		await tx
			.update(sender)
			.set({
				trust: "accepted",
				defaultCategory: options.category,
				decidedAt: new Date(),
			})
			.where(eq(sender.id, row.id));

		let restoredThreadCount = 0;
		if (options.restoreHidden) {
			const restored = await tx
				.update(thread)
				.set({ state: "categorized", category: options.category })
				.where(
					and(
						eq(thread.userId, userId),
						eq(thread.senderEmail, email),
						eq(thread.state, "hidden"),
					),
				)
				.returning({ id: thread.id });
			restoredThreadCount = restored.length;
		}

		return { emailAddress: email, restoredThreadCount };
	});
};

export interface OverrideThreadCategoryOptions {
	/** Also update the sender's user-global routing rule. */
	promote?: boolean;
}

export interface OverrideThreadCategoryResult {
	id: string;
	state: "categorized";
	category: ScreenerCategory;
	categoryOverridden: true;
	/**
	 * Whether the sender rule was updated. False without `promote`, and
	 * also false when the thread has no usable sender address.
	 */
	promotedSender: boolean;
}

/**
 * Per-thread category override: move ONE owned thread to `categorized`
 * with the chosen category and mark it `category_overridden`. Works from
 * any state (screener, hidden, spam, categorized) — overriding is an
 * explicit user decision about this specific thread.
 *
 * Without `promote` the sender's routing rule is untouched. With
 * `promote: true` the sender is also upserted to trust `accepted` with
 * this category as `default_category` (user-global, like accept) — but no
 * other existing threads are swept; use the accept endpoint for that.
 *
 * Ownership is strict: unknown ids and other users' ids both throw
 * {@link ThreadNotFoundError}, indistinguishably.
 */
export const overrideThreadCategory = async (
	userId: string,
	threadId: string,
	category: ScreenerCategory,
	options: OverrideThreadCategoryOptions = {},
	dbClient?: Db,
): Promise<OverrideThreadCategoryResult> => {
	const db = dbClient ?? (await getDb());

	return db.transaction(async (tx) => {
		const rows = await tx
			.select({
				id: thread.id,
				userId: thread.userId,
				senderEmail: thread.senderEmail,
			})
			.from(thread)
			.where(eq(thread.id, threadId))
			.limit(1);
		const row = rows[0];
		if (!row || row.userId !== userId) {
			throw new ThreadNotFoundError(threadId);
		}

		await tx
			.update(thread)
			.set({ state: "categorized", category, categoryOverridden: true })
			.where(eq(thread.id, row.id));

		let promotedSender = false;
		// Threads with an unparseable From fall back to a raw (possibly
		// empty) sender_email at ingest — never promote an empty address.
		if (options.promote && row.senderEmail) {
			const decidedAt = new Date();
			await tx
				.insert(sender)
				.values({
					userId,
					emailAddress: row.senderEmail,
					trust: "accepted",
					defaultCategory: category,
					decidedAt,
				})
				.onConflictDoUpdate({
					target: [sender.userId, sender.emailAddress],
					set: { trust: "accepted", defaultCategory: category, decidedAt },
				});
			promotedSender = true;
		}

		return {
			id: row.id,
			state: "categorized" as const,
			category,
			categoryOverridden: true as const,
			promotedSender,
		};
	});
};
