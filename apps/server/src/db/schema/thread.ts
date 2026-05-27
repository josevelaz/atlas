/**
 * Atlas domain: Thread and Message
 *
 * `thread` — a mail conversation scoped to a single connected account.
 *   Uniquely keyed to the provider-native thread identity within that account.
 *   Carries screening state, category (nullable until accepted), visibility
 *   overlays (archive, trash), handling state, and read state.
 *
 * `message` — a single email message within a thread.
 *   Scoped to a single connected account and uniquely keyed to the
 *   provider-native message identity within that account.
 *
 * ── Screening vs Category invariants ────────────────────────────────────────
 *
 *   screening_state values:
 *     "pending"  — thread is in the Screener awaiting a sender decision
 *     "accepted" — sender was accepted; thread lives in a category
 *     "rejected" — sender was rejected; thread is hidden from normal views
 *
 *   category values (null | "inbox" | "feed" | "paper_trail"):
 *     - MUST be null when screening_state = "pending" or "rejected"
 *     - MUST be non-null when screening_state = "accepted"
 *
 *   The CHECK constraint `thread_category_invariant` enforces this at the DB
 *   level.  Application code must also validate before writes.
 *
 * ── Visibility overlays ──────────────────────────────────────────────────────
 *
 *   is_hidden:
 *     true when the thread's initiating sender was rejected.  Hidden threads
 *     are excluded from normal Atlas views and search.  Lossless restore is
 *     supported via `prior_category` (see below).
 *
 *   is_archived:
 *     App-owned archive flag.  Only valid on accepted threads (screening_state
 *     = "accepted").  Archived threads are removed from active category views
 *     but remain in the account.  CHECK constraint enforces accepted-only.
 *
 *   is_trashed:
 *     App-owned trash flag.  Valid on both accepted AND pending/Screener
 *     threads (per spec: "Trash on Screener threads" is allowed).  Trashed
 *     threads are excluded from normal views.
 *
 * ── Handling state ───────────────────────────────────────────────────────────
 *
 *   handling_state values (null | "set_aside" | "reply_later"):
 *     Only valid on accepted threads.  CHECK constraint enforces accepted-only.
 *
 * ── Rejected-thread restore ──────────────────────────────────────────────────
 *
 *   prior_category:
 *     Preserved when a previously accepted thread is hidden due to sender
 *     rejection.  Allows lossless restore: if the sender is later accepted,
 *     the thread can be restored to its prior category without data loss.
 *     Null for threads that were never accepted before being rejected.
 *
 * ── Initiating sender ────────────────────────────────────────────────────────
 *
 *   initiating_sender_email_identity_id:
 *     FK to `email_identity` — the exact email address that started this
 *     thread.  Used for Screener decisions and routing-rule lookups.
 *     Stored explicitly so screening logic does not need to inspect message
 *     participants to determine the thread's origin.
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
// thread
// ---------------------------------------------------------------------------

export const thread = sqliteTable(
	"thread",
	{
		id: text("id").primaryKey(),

		// Ownership — scoped to a single connected account.
		connectedAccountId: text("connected_account_id")
			.notNull()
			.references(() => connectedAccount.id, { onDelete: "cascade" }),

		// Provider-native thread identifier (e.g. Gmail threadId).
		// Unique per connected account — the same provider thread cannot appear
		// twice under the same account.
		providerThreadId: text("provider_thread_id").notNull(),

		// -----------------------------------------------------------------------
		// Screening state — independent of category (see invariants above)
		// -----------------------------------------------------------------------
		screeningState: text("screening_state", {
			enum: ["pending", "accepted", "rejected"],
		})
			.notNull()
			.default("pending"),

		// -----------------------------------------------------------------------
		// Category — null until accepted; required once accepted
		// -----------------------------------------------------------------------
		// Enforced by CHECK constraint `thread_category_invariant` below.
		category: text("category", {
			enum: ["inbox", "feed", "paper_trail"],
		}),

		// Prior category — preserved when a previously accepted thread is hidden
		// due to sender rejection.  Enables lossless restore.
		priorCategory: text("prior_category", {
			enum: ["inbox", "feed", "paper_trail"],
		}),

		// -----------------------------------------------------------------------
		// Initiating sender
		// -----------------------------------------------------------------------
		// FK to email_identity — the exact sender that started this thread.
		// Null only if the identity has not yet been resolved during sync.
		initiatingSenderEmailIdentityId: text(
			"initiating_sender_email_identity_id",
		).references(() => emailIdentity.id, { onDelete: "set null" }),

		// -----------------------------------------------------------------------
		// Visibility overlays
		// -----------------------------------------------------------------------
		// Hidden due to sender rejection.
		isHidden: integer("is_hidden", { mode: "boolean" })
			.notNull()
			.default(false),

		// App-owned archive (accepted threads only — enforced by CHECK).
		isArchived: integer("is_archived", { mode: "boolean" })
			.notNull()
			.default(false),

		// App-owned trash (accepted OR pending/Screener threads).
		isTrashed: integer("is_trashed", { mode: "boolean" })
			.notNull()
			.default(false),

		// -----------------------------------------------------------------------
		// Handling state (accepted threads only — enforced by CHECK)
		// -----------------------------------------------------------------------
		handlingState: text("handling_state", {
			enum: ["set_aside", "reply_later"],
		}),

		// -----------------------------------------------------------------------
		// Read state (app-owned, does not modify provider)
		// -----------------------------------------------------------------------
		isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),

		// -----------------------------------------------------------------------
		// Provider metadata
		// -----------------------------------------------------------------------
		// Subject line from the provider (may be updated on sync).
		subject: text("subject"),

		// Snippet / preview text from the provider.
		snippet: text("snippet"),

		// Timestamp of the most recent message in the thread (from provider).
		lastMessageAt: integer("last_message_at", { mode: "timestamp_ms" }),

		// -----------------------------------------------------------------------
		// Timestamps
		// -----------------------------------------------------------------------
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
		// Provider thread ID must be unique within a connected account.
		uniqueIndex("thread_provider_thread_id_unique").on(
			table.connectedAccountId,
			table.providerThreadId,
		),

		// ── Screening / category invariant ─────────────────────────────────────
		// category must be null when screening_state is "pending" or "rejected",
		// and must be non-null when screening_state is "accepted".
		check(
			"thread_category_invariant",
			sql`(
        (${table.screeningState} = 'accepted' AND ${table.category} IS NOT NULL)
        OR
        (${table.screeningState} != 'accepted' AND ${table.category} IS NULL)
      )`,
		),

		// archive is only valid on accepted threads
		check(
			"thread_archive_accepted_only",
			sql`(${table.isArchived} = 0 OR ${table.screeningState} = 'accepted')`,
		),

		// handling_state is only valid on accepted threads
		check(
			"thread_handling_state_accepted_only",
			sql`(${table.handlingState} IS NULL OR ${table.screeningState} = 'accepted')`,
		),

		// Enforce screening_state value set.
		check(
			"thread_screening_state_check",
			sql`${table.screeningState} IN ('pending', 'accepted', 'rejected')`,
		),

		// Enforce category value set (when not null).
		check(
			"thread_category_check",
			sql`${table.category} IS NULL OR ${table.category} IN ('inbox', 'feed', 'paper_trail')`,
		),

		// Enforce prior_category value set (when not null).
		check(
			"thread_prior_category_check",
			sql`${table.priorCategory} IS NULL OR ${table.priorCategory} IN ('inbox', 'feed', 'paper_trail')`,
		),

		// Enforce handling_state value set (when not null).
		check(
			"thread_handling_state_check",
			sql`${table.handlingState} IS NULL OR ${table.handlingState} IN ('set_aside', 'reply_later')`,
		),

		// ── Indexes ─────────────────────────────────────────────────────────────
		// All threads for a connected account (primary listing query).
		index("thread_connected_account_id_idx").on(table.connectedAccountId),

		// Category filtering within a connected account (accepted threads).
		index("thread_connected_account_category_idx").on(
			table.connectedAccountId,
			table.category,
		),

		// Screening queue lookup (pending threads for a connected account).
		index("thread_screening_state_idx").on(
			table.connectedAccountId,
			table.screeningState,
		),

		// Initiating sender lookup (for routing and screening decisions).
		index("thread_initiating_sender_idx").on(
			table.initiatingSenderEmailIdentityId,
		),

		// Hidden-thread lookup (for rejected-sender restore flows).
		index("thread_is_hidden_idx").on(table.connectedAccountId, table.isHidden),

		// Recent-thread ordering within a connected account.
		index("thread_last_message_at_idx").on(
			table.connectedAccountId,
			table.lastMessageAt,
		),
	],
);

// ---------------------------------------------------------------------------
// message
// ---------------------------------------------------------------------------

export const message = sqliteTable(
	"message",
	{
		id: text("id").primaryKey(),

		// Ownership — scoped to a single connected account.
		connectedAccountId: text("connected_account_id")
			.notNull()
			.references(() => connectedAccount.id, { onDelete: "cascade" }),

		// Parent thread.
		threadId: text("thread_id")
			.notNull()
			.references(() => thread.id, { onDelete: "cascade" }),

		// Provider-native message identifier (e.g. Gmail messageId).
		// Unique per connected account.
		providerMessageId: text("provider_message_id").notNull(),

		// -----------------------------------------------------------------------
		// Message metadata
		// -----------------------------------------------------------------------
		subject: text("subject"),
		snippet: text("snippet"),

		// Sender display name and address (denormalized for display performance).
		// The normalized FK is on `message_participant` rows with role = "from".
		fromName: text("from_name"),
		fromEmail: text("from_email"),

		// Message body (plain text, may be truncated for large messages).
		bodyText: text("body_text"),

		// Message body (HTML, may be truncated for large messages).
		bodyHtml: text("body_html"),

		// Provider timestamp of the message.
		sentAt: integer("sent_at", { mode: "timestamp_ms" }),

		// Whether this message has been read in the provider mailbox.
		isProviderRead: integer("is_provider_read", { mode: "boolean" })
			.notNull()
			.default(false),

		// -----------------------------------------------------------------------
		// Timestamps
		// -----------------------------------------------------------------------
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
		// Provider message ID must be unique within a connected account.
		uniqueIndex("message_provider_message_id_unique").on(
			table.connectedAccountId,
			table.providerMessageId,
		),

		// ── Indexes ─────────────────────────────────────────────────────────────
		// All messages for a thread (primary join query).
		index("message_thread_id_idx").on(table.threadId),

		// All messages for a connected account.
		index("message_connected_account_id_idx").on(table.connectedAccountId),

		// Chronological ordering within a thread.
		index("message_sent_at_idx").on(table.threadId, table.sentAt),
	],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const threadRelations = relations(thread, ({ one, many }) => ({
	connectedAccount: one(connectedAccount, {
		fields: [thread.connectedAccountId],
		references: [connectedAccount.id],
	}),
	initiatingSenderEmailIdentity: one(emailIdentity, {
		fields: [thread.initiatingSenderEmailIdentityId],
		references: [emailIdentity.id],
	}),
	messages: many(message),
}));

export const messageRelations = relations(message, ({ one, many }) => ({
	connectedAccount: one(connectedAccount, {
		fields: [message.connectedAccountId],
		references: [connectedAccount.id],
	}),
	thread: one(thread, {
		fields: [message.threadId],
		references: [thread.id],
	}),
	participants: many(messageParticipant),
}));

// ---------------------------------------------------------------------------
// message_participant — normalized participant rows
// ---------------------------------------------------------------------------
// Instead of storing recipients as a JSON array on the message, each
// participant (from, to, cc, bcc, reply-to) gets its own row.  This enables
// indexed lookups by email address and role without JSON parsing.

export const messageParticipant = sqliteTable(
	"message_participant",
	{
		id: text("id").primaryKey(),

		// Parent message.
		messageId: text("message_id")
			.notNull()
			.references(() => message.id, { onDelete: "cascade" }),

		// Participant role in this message.
		role: text("role", {
			enum: ["from", "to", "cc", "bcc", "reply_to"],
		}).notNull(),

		// Exact email address of this participant.
		emailAddress: text("email_address").notNull(),

		// Display name from the message header (may differ from email_identity).
		displayName: text("display_name"),

		// FK to email_identity if this address has been resolved.
		// Null until the identity resolution pass runs.
		emailIdentityId: text("email_identity_id").references(
			() => emailIdentity.id,
			{ onDelete: "set null" },
		),

		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		// Enforce role value set.
		check(
			"message_participant_role_check",
			sql`${table.role} IN ('from', 'to', 'cc', 'bcc', 'reply_to')`,
		),

		// All participants for a message.
		index("message_participant_message_id_idx").on(table.messageId),

		// Lookup by email address (for screening / routing lookups).
		index("message_participant_email_address_idx").on(table.emailAddress),

		// Lookup by resolved email identity.
		index("message_participant_email_identity_id_idx").on(
			table.emailIdentityId,
		),
	],
);

export const messageParticipantRelations = relations(
	messageParticipant,
	({ one }) => ({
		message: one(message, {
			fields: [messageParticipant.messageId],
			references: [message.id],
		}),
		emailIdentity: one(emailIdentity, {
			fields: [messageParticipant.emailIdentityId],
			references: [emailIdentity.id],
		}),
	}),
);
