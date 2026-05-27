/**
 * Atlas domain: Integration Mutation Journal
 *
 * The `integration_mutation_journal` is a unified, append-only log of every
 * outbound write that Atlas attempts against an external provider.  It covers
 * two distinct write targets:
 *
 *   1. **Mailbox-side writes** — operations sent to a connected account's
 *      provider (e.g. Gmail, Outlook) such as label changes, send-reply, or
 *      trash operations.  These are owned by a `connected_account`.
 *
 *   2. **Destination-integration writes** — operations sent to a destination
 *      integration (e.g. Google Tasks, Notion, Linear) such as creating a
 *      task or event from a confirmed action item.  These are owned by a
 *      `destination_integration`.
 *
 * Exactly one of `connected_account_id` or `destination_integration_id` is
 * non-null per row; the `mutation_target` column makes the target type
 * explicit.  A CHECK constraint enforces this mutual exclusivity.
 *
 * ── Idempotency ──────────────────────────────────────────────────────────────
 *
 *   Every journal entry carries an `idempotency_key` — a caller-generated
 *   opaque string that uniquely identifies the logical operation.  The unique
 *   index on `(mutation_target, idempotency_key)` ensures that a retry of the
 *   same logical operation cannot insert a duplicate journal row.
 *
 *   The idempotency key MUST NOT encode provider secrets, tokens, or any
 *   sensitive credential material.  It is safe to store in plaintext and to
 *   include in proof artifacts.  Typical formats:
 *     - `"action_item:<action_item_id>:create"` for destination writes
 *     - `"thread:<thread_id>:label:<label_id>:add"` for mailbox writes
 *
 * ── Mutation lifecycle ───────────────────────────────────────────────────────
 *
 *   "pending"   — mutation is queued but not yet attempted
 *   "in_flight" — mutation attempt is currently in progress
 *   "succeeded" — provider confirmed the mutation was applied
 *   "failed"    — last attempt failed; may be retried
 *   "abandoned" — mutation will not be retried (e.g. too many failures,
 *                 integration disconnected, or action item dismissed)
 *
 * ── Retry safety ─────────────────────────────────────────────────────────────
 *
 *   Before attempting a mutation, the caller checks whether a journal entry
 *   with the same `idempotency_key` already exists in `succeeded` state.  If
 *   so, the mutation is skipped.  The unique index prevents duplicate rows for
 *   the same key, so concurrent retries cannot race to create two entries.
 *
 *   `attempt_count` tracks how many times the mutation has been attempted.
 *   `last_attempted_at` records the most recent attempt timestamp.
 *   `next_attempt_at` is a hint for the retry scheduler.
 *
 * ── Provider response ────────────────────────────────────────────────────────
 *
 *   `provider_response_id` stores the provider-side identifier returned on
 *   success (e.g. the created task ID, the event ID).  This is safe to store
 *   in plaintext — it is an opaque reference, not a credential.
 *
 *   `error_code` and `error_message` capture failure details for debugging
 *   and retry decisions.  These MUST NOT contain provider tokens or secrets.
 *
 * ── Ownership ────────────────────────────────────────────────────────────────
 *
 *   All journal entries are ultimately owned by a `user` (via the connected
 *   account or destination integration).  The `user_id` column is denormalized
 *   here for fast per-user reconciliation queries without requiring a join
 *   through the integration tables.
 *
 * ── Reconciliation ───────────────────────────────────────────────────────────
 *
 *   The `action_item_id` FK (nullable) links destination-integration writes
 *   back to the action item that triggered them.  This supports reconciliation
 *   queries such as "find all pending mutations for this action item" and
 *   "mark this action item completed once its mutation succeeds".
 *
 * ── Secret hygiene ───────────────────────────────────────────────────────────
 *
 *   This table MUST NOT store provider access tokens, refresh tokens, or any
 *   other credential material.  Encrypted tokens live exclusively on
 *   `connected_account` and `destination_integration`.  The journal stores
 *   only opaque identifiers and non-sensitive metadata.
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

import { user } from "./auth.ts";
import { connectedAccount } from "./connected_account.ts";
import { destinationIntegration } from "./destination_integration.ts";
import { actionItem } from "./action_item.ts";

// ---------------------------------------------------------------------------
// integration_mutation_journal
// ---------------------------------------------------------------------------

export const integrationMutationJournal = sqliteTable(
	"integration_mutation_journal",
	{
		id: text("id").primaryKey(),

		// -----------------------------------------------------------------------
		// Ownership — denormalized user_id for fast per-user queries.
		// -----------------------------------------------------------------------
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),

		// -----------------------------------------------------------------------
		// Mutation target — exactly one of the two FKs below is non-null.
		// -----------------------------------------------------------------------

		// Discriminator: "connected_account" | "destination_integration"
		mutationTarget: text("mutation_target", {
			enum: ["connected_account", "destination_integration"],
		}).notNull(),

		// FK to connected_account — set for mailbox-side writes.
		// Null for destination-integration writes.
		connectedAccountId: text("connected_account_id").references(
			() => connectedAccount.id,
			{ onDelete: "set null" },
		),

		// FK to destination_integration — set for outbound action-item writes.
		// Null for mailbox-side writes.
		destinationIntegrationId: text("destination_integration_id").references(
			() => destinationIntegration.id,
			{ onDelete: "set null" },
		),

		// -----------------------------------------------------------------------
		// Reconciliation link — the action item that triggered this mutation.
		// Null for mailbox-side writes that are not action-item-driven.
		// -----------------------------------------------------------------------
		actionItemId: text("action_item_id").references(() => actionItem.id, {
			onDelete: "set null",
		}),

		// -----------------------------------------------------------------------
		// Mutation type — opaque string describing the operation.
		// Examples: "create_task", "create_event", "add_label", "send_reply"
		// -----------------------------------------------------------------------
		mutationType: text("mutation_type").notNull(),

		// -----------------------------------------------------------------------
		// Idempotency key — caller-generated, unique per logical operation.
		// MUST NOT contain provider secrets or credential material.
		// -----------------------------------------------------------------------
		idempotencyKey: text("idempotency_key").notNull(),

		// -----------------------------------------------------------------------
		// Lifecycle state
		// -----------------------------------------------------------------------
		// "pending" | "in_flight" | "succeeded" | "failed" | "abandoned"
		status: text("status", {
			enum: ["pending", "in_flight", "succeeded", "failed", "abandoned"],
		})
			.notNull()
			.default("pending"),

		// -----------------------------------------------------------------------
		// Retry tracking
		// -----------------------------------------------------------------------
		attemptCount: integer("attempt_count").notNull().default(0),
		lastAttemptedAt: integer("last_attempted_at", { mode: "timestamp_ms" }),
		nextAttemptAt: integer("next_attempt_at", { mode: "timestamp_ms" }),

		// -----------------------------------------------------------------------
		// Provider response (non-sensitive)
		// -----------------------------------------------------------------------
		// Opaque provider-side identifier returned on success (e.g. task ID).
		// Safe to store in plaintext — not a credential.
		providerResponseId: text("provider_response_id"),

		// Error details for failed attempts (MUST NOT contain tokens/secrets).
		errorCode: text("error_code"),
		errorMessage: text("error_message"),

		// -----------------------------------------------------------------------
		// Mutation payload reference (optional)
		// -----------------------------------------------------------------------
		// Opaque JSON blob describing the mutation inputs (non-sensitive).
		// Useful for debugging and replay.  MUST NOT contain provider secrets.
		mutationPayloadJson: text("mutation_payload_json"),

		// -----------------------------------------------------------------------
		// Timestamps
		// -----------------------------------------------------------------------
		succeededAt: integer("succeeded_at", { mode: "timestamp_ms" }),
		abandonedAt: integer("abandoned_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		// ── Idempotency constraint ───────────────────────────────────────────────
		// Prevents duplicate journal entries for the same logical operation.
		// Scoped to mutation_target so the same key can be reused across targets
		// if needed (though callers should use globally unique keys in practice).
		uniqueIndex("imj_idempotency_key_unique").on(
			table.mutationTarget,
			table.idempotencyKey,
		),

		// ── Mutual-exclusivity invariants ────────────────────────────────────────

		// mutation_target value set.
		check(
			"imj_mutation_target_check",
			sql`${table.mutationTarget} IN ('connected_account', 'destination_integration')`,
		),

		// connected_account writes must have connected_account_id.
		check(
			"imj_connected_account_target_needs_id",
			sql`(${table.mutationTarget} != 'connected_account' OR ${table.connectedAccountId} IS NOT NULL)`,
		),

		// destination_integration writes must have destination_integration_id.
		check(
			"imj_destination_integration_target_needs_id",
			sql`(${table.mutationTarget} != 'destination_integration' OR ${table.destinationIntegrationId} IS NOT NULL)`,
		),

		// Exactly one target FK is non-null (mutual exclusivity).
		check(
			"imj_exactly_one_target",
			sql`(${table.connectedAccountId} IS NULL) != (${table.destinationIntegrationId} IS NULL)`,
		),

		// status value set.
		check(
			"imj_status_check",
			sql`${table.status} IN ('pending', 'in_flight', 'succeeded', 'failed', 'abandoned')`,
		),

		// ── Indexes ──────────────────────────────────────────────────────────────

		// All journal entries for a user (primary reconciliation query).
		index("imj_user_id_idx").on(table.userId),

		// Journal entries for a connected account (mailbox-side reconciliation).
		index("imj_connected_account_id_idx").on(table.connectedAccountId),

		// Journal entries for a destination integration (outbound reconciliation).
		index("imj_destination_integration_id_idx").on(
			table.destinationIntegrationId,
		),

		// Journal entries for an action item (action-item reconciliation).
		index("imj_action_item_id_idx").on(table.actionItemId),

		// Pending/in-flight entries for retry scheduling.
		index("imj_status_next_attempt_idx").on(table.status, table.nextAttemptAt),

		// Per-user status filter (e.g. "all failed mutations for this user").
		index("imj_user_status_idx").on(table.userId, table.status),
	],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const integrationMutationJournalRelations = relations(
	integrationMutationJournal,
	({ one }) => ({
		user: one(user, {
			fields: [integrationMutationJournal.userId],
			references: [user.id],
		}),
		connectedAccount: one(connectedAccount, {
			fields: [integrationMutationJournal.connectedAccountId],
			references: [connectedAccount.id],
		}),
		destinationIntegration: one(destinationIntegration, {
			fields: [integrationMutationJournal.destinationIntegrationId],
			references: [destinationIntegration.id],
		}),
		actionItem: one(actionItem, {
			fields: [integrationMutationJournal.actionItemId],
			references: [actionItem.id],
		}),
	}),
);
