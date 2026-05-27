/**
 * Atlas domain: Action Item
 *
 * An `action_item` is a task or follow-up extracted from thread content by
 * the Atlas AI pipeline.  Action items have an explicit lifecycle and are
 * tied to the specific thread revision from which they were extracted.
 *
 * ── Lifecycle states ─────────────────────────────────────────────────────────
 *
 *   "pending"   — extracted but not yet acted on by the user
 *   "confirmed" — user confirmed the action item and it has been (or will be)
 *                 sent to a destination integration
 *   "dismissed" — user dismissed the action item; retained for audit/history
 *   "completed" — action item was completed (provider-side confirmation)
 *
 * ── Destination integration ──────────────────────────────────────────────────
 *
 *   `destination_integration_id` is NULLABLE until the action item is
 *   confirmed.  This allows action items to exist before the user has chosen
 *   a destination.  Once confirmed, exactly one destination integration is
 *   referenced.
 *
 *   The CHECK constraint `action_item_confirmed_needs_destination` enforces
 *   that confirmed action items always have a destination_integration_id.
 *
 * ── Durability across revisions ──────────────────────────────────────────────
 *
 *   Confirmed action items are durable: they are NOT deleted or invalidated
 *   when a later thread revision is created.  The `source_revision_id` field
 *   preserves provenance — it records which revision the item was extracted
 *   from — but later revisions do not cascade-delete confirmed items.
 *
 *   Dismissed action items are also retained (not deleted) so that the
 *   dismissal history is preserved.
 *
 * ── Priority ─────────────────────────────────────────────────────────────────
 *
 *   `priority` uses semantic levels `low | medium | high` (nullable — not all
 *   action items have an AI-assigned priority).
 *
 * ── Source revision provenance ───────────────────────────────────────────────
 *
 *   `source_revision_id` references the `thread_revision` from which this
 *   action item was extracted.  It uses SET NULL on delete so that if a
 *   revision row is ever removed (unusual), the action item is retained with
 *   a null provenance pointer rather than being cascade-deleted.
 */
import { relations, sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

import { destinationIntegration } from "./destination_integration.ts";
import { threadRevision } from "./revision.ts";
import { thread } from "./thread.ts";

// ---------------------------------------------------------------------------
// action_item
// ---------------------------------------------------------------------------

export const actionItem = sqliteTable(
	"action_item",
	{
		id: text("id").primaryKey(),

		// Parent thread.
		threadId: text("thread_id")
			.notNull()
			.references(() => thread.id, { onDelete: "cascade" }),

		// Source revision — the revision this item was extracted from.
		// SET NULL on delete so the item is retained if the revision is removed.
		sourceRevisionId: text("source_revision_id").references(
			() => threadRevision.id,
			{ onDelete: "set null" },
		),

		// -----------------------------------------------------------------------
		// Lifecycle state
		// -----------------------------------------------------------------------
		// "pending" | "confirmed" | "dismissed" | "completed"
		lifecycleState: text("lifecycle_state", {
			enum: ["pending", "confirmed", "dismissed", "completed"],
		})
			.notNull()
			.default("pending"),

		// -----------------------------------------------------------------------
		// Destination integration (nullable until confirmed)
		// -----------------------------------------------------------------------
		// FK to destination_integration — set when the user confirms the item.
		// NULL before confirmation.  SET NULL on delete so confirmed items are
		// retained even if the integration is later disconnected.
		destinationIntegrationId: text("destination_integration_id").references(
			() => destinationIntegration.id,
			{ onDelete: "set null" },
		),

		// Provider-side identifier for the created task/event (set after sync).
		providerItemId: text("provider_item_id"),

		// -----------------------------------------------------------------------
		// Content
		// -----------------------------------------------------------------------
		// The extracted action item text.
		title: text("title").notNull(),

		// Optional longer description.
		description: text("description"),

		// Due date suggested by the AI (nullable).
		suggestedDueAt: integer("suggested_due_at", { mode: "timestamp_ms" }),

		// -----------------------------------------------------------------------
		// Priority (semantic, nullable)
		// -----------------------------------------------------------------------
		priority: text("priority", {
			enum: ["low", "medium", "high"],
		}),

		// -----------------------------------------------------------------------
		// AI model provenance
		// -----------------------------------------------------------------------
		modelId: text("model_id"),

		// -----------------------------------------------------------------------
		// Timestamps
		// -----------------------------------------------------------------------
		confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
		dismissedAt: integer("dismissed_at", { mode: "timestamp_ms" }),
		completedAt: integer("completed_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		// ── Lifecycle invariants ────────────────────────────────────────────────

		// Enforce lifecycle_state value set.
		check(
			"action_item_lifecycle_state_check",
			sql`${table.lifecycleState} IN ('pending', 'confirmed', 'dismissed', 'completed')`,
		),

		// Confirmed action items MUST have a destination_integration_id.
		check(
			"action_item_confirmed_needs_destination",
			sql`(${table.lifecycleState} != 'confirmed' OR ${table.destinationIntegrationId} IS NOT NULL)`,
		),

		// Enforce priority value set (when not null).
		check(
			"action_item_priority_check",
			sql`${table.priority} IS NULL OR ${table.priority} IN ('low', 'medium', 'high')`,
		),

		// ── Indexes ─────────────────────────────────────────────────────────────

		// All action items for a thread.
		index("action_item_thread_id_idx").on(table.threadId),

		// Action items by lifecycle state (e.g. pending items for a thread).
		index("action_item_thread_lifecycle_idx").on(
			table.threadId,
			table.lifecycleState,
		),

		// Action items by source revision (for provenance lookups).
		index("action_item_source_revision_id_idx").on(table.sourceRevisionId),

		// Action items by destination integration (for sync reconciliation).
		index("action_item_destination_integration_id_idx").on(
			table.destinationIntegrationId,
		),
	],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const actionItemRelations = relations(actionItem, ({ one }) => ({
	thread: one(thread, {
		fields: [actionItem.threadId],
		references: [thread.id],
	}),
	sourceRevision: one(threadRevision, {
		fields: [actionItem.sourceRevisionId],
		references: [threadRevision.id],
	}),
	destinationIntegration: one(destinationIntegration, {
		fields: [actionItem.destinationIntegrationId],
		references: [destinationIntegration.id],
	}),
}));
