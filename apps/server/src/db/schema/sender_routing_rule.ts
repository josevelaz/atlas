/**
 * Atlas domain: Sender Routing Rule
 *
 * A `sender_routing_rule` maps an exact sender email address to a default
 * category within a connected account.  It is established when a sender is
 * Accepted from the Screener using the Accept category dropdown.
 *
 * Semantics:
 *   - Keyed by (connected_account_id, email_address) — exact-email granularity
 *     within a connected account, matching the Screener's decision scope.
 *   - The `default_category` column records which category future threads from
 *     this sender should be routed to.
 *   - `screening_decision` records whether the sender was accepted or rejected.
 *     Rejected senders have a rule row so the Screener can quickly determine
 *     that a new thread from this sender should be hidden without re-screening.
 *   - `email_identity_id` is a FK to `email_identity` for the resolved sender
 *     identity.  It may be null if the identity has not yet been resolved.
 *
 * Uniqueness:
 *   One rule per (connected_account_id, email_address) — a sender cannot have
 *   two conflicting routing rules for the same connected account.
 *
 * Relationship to Screener:
 *   The Screener checks this table on every new thread to determine whether
 *   the initiating sender has already been screened.  If no row exists, the
 *   thread is placed in the Screener (pending).  If a row exists with
 *   screening_decision = "accepted", the thread is routed to default_category.
 *   If screening_decision = "rejected", the thread is hidden.
 */
import { relations, sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { connectedAccount } from "./connected_account.ts";
import { emailIdentity } from "./contact.ts";

// ---------------------------------------------------------------------------
// sender_routing_rule
// ---------------------------------------------------------------------------

export const senderRoutingRule = sqliteTable(
	"sender_routing_rule",
	{
		id: text("id").primaryKey(),

		// Ownership — scoped to a single connected account.
		connectedAccountId: text("connected_account_id")
			.notNull()
			.references(() => connectedAccount.id, { onDelete: "cascade" }),

		// The exact sender email address this rule applies to.
		// This is the primary lookup key for the Screener.
		emailAddress: text("email_address").notNull(),

		// FK to the resolved email_identity for this sender (if resolved).
		// Null until identity resolution runs.
		emailIdentityId: text("email_identity_id").references(
			() => emailIdentity.id,
			{ onDelete: "set null" },
		),

		// Screening decision for this sender within this connected account.
		//   "accepted" — sender was accepted; future threads route to default_category
		//   "rejected" — sender was rejected; future threads are hidden
		screeningDecision: text("screening_decision", {
			enum: ["accepted", "rejected"],
		}).notNull(),

		// Default category for accepted senders.
		// MUST be non-null when screening_decision = "accepted".
		// MUST be null when screening_decision = "rejected".
		// Enforced by CHECK constraint below.
		defaultCategory: text("default_category", {
			enum: ["inbox", "feed", "paper_trail"],
		}),

		// -----------------------------------------------------------------------
		// Timestamps
		// -----------------------------------------------------------------------
		// When the screening decision was made.
		decidedAt: integer("decided_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),

		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		// ── Uniqueness ──────────────────────────────────────────────────────────
		// One routing rule per exact sender email per connected account.
		uniqueIndex("sender_routing_rule_account_email_unique").on(
			table.connectedAccountId,
			table.emailAddress,
		),

		// ── Invariants ──────────────────────────────────────────────────────────
		// default_category must be non-null for accepted senders and null for
		// rejected senders.
		check(
			"sender_routing_rule_category_invariant",
			sql`(
        (${table.screeningDecision} = 'accepted' AND ${table.defaultCategory} IS NOT NULL)
        OR
        (${table.screeningDecision} = 'rejected' AND ${table.defaultCategory} IS NULL)
      )`,
		),

		// Enforce screening_decision value set.
		check(
			"sender_routing_rule_decision_check",
			sql`${table.screeningDecision} IN ('accepted', 'rejected')`,
		),

		// Enforce default_category value set (when not null).
		check(
			"sender_routing_rule_category_check",
			sql`${table.defaultCategory} IS NULL OR ${table.defaultCategory} IN ('inbox', 'feed', 'paper_trail')`,
		),

		// ── Indexes ─────────────────────────────────────────────────────────────
		// Primary Screener lookup: given a connected account + sender email,
		// find the routing rule instantly.
		index("sender_routing_rule_account_email_idx").on(
			table.connectedAccountId,
			table.emailAddress,
		),

		// All routing rules for a connected account.
		index("sender_routing_rule_connected_account_id_idx").on(
			table.connectedAccountId,
		),

		// Lookup by resolved email identity.
		index("sender_routing_rule_email_identity_id_idx").on(
			table.emailIdentityId,
		),
	],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const senderRoutingRuleRelations = relations(
	senderRoutingRule,
	({ one }) => ({
		connectedAccount: one(connectedAccount, {
			fields: [senderRoutingRule.connectedAccountId],
			references: [connectedAccount.id],
		}),
		emailIdentity: one(emailIdentity, {
			fields: [senderRoutingRule.emailIdentityId],
			references: [emailIdentity.id],
		}),
	}),
);
