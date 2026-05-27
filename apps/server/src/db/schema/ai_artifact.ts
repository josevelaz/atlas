/**
 * Atlas domain: AI-Derived Artifacts
 *
 * AI artifacts are revision-aware: each artifact row references the specific
 * `thread_revision` from which it was derived.  This keeps AI outputs
 * auditable and explainable as thread content evolves.
 *
 * ── ai_thread_summary ────────────────────────────────────────────────────────
 *
 *   A natural-language summary of the thread content at a given revision.
 *   May exist for threads in any screening state, including pending Screener
 *   threads (the spec explicitly allows AI artifacts on pending threads).
 *
 *   At most one summary per (thread_id, thread_revision_id) is enforced by
 *   the unique index.
 *
 * ── ai_thread_priority ───────────────────────────────────────────────────────
 *
 *   An AI-assigned priority level for the thread at a given revision.
 *   Uses semantic levels `low | medium | high` rather than numeric ordinals.
 *
 *   May exist for threads in any screening state, including pending Screener
 *   threads.
 *
 *   At most one priority per (thread_id, thread_revision_id) is enforced by
 *   the unique index.
 *
 * ── action_item ──────────────────────────────────────────────────────────────
 *
 *   An action item extracted from thread content at a given revision.
 *   See action_item.ts for full lifecycle documentation.
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

import { thread } from "./thread.ts";
import { threadRevision } from "./revision.ts";

// ---------------------------------------------------------------------------
// ai_thread_summary
// ---------------------------------------------------------------------------

export const aiThreadSummary = sqliteTable(
	"ai_thread_summary",
	{
		id: text("id").primaryKey(),

		// Parent thread.
		threadId: text("thread_id")
			.notNull()
			.references(() => thread.id, { onDelete: "cascade" }),

		// Source revision — the revision this summary was derived from.
		threadRevisionId: text("thread_revision_id")
			.notNull()
			.references(() => threadRevision.id, { onDelete: "cascade" }),

		// The AI-generated summary text.
		summaryText: text("summary_text").notNull(),

		// AI model identifier used to generate this summary (e.g. "gpt-4o").
		modelId: text("model_id"),

		// Timestamps.
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		// At most one summary per (thread, revision).
		uniqueIndex("ai_thread_summary_thread_revision_unique").on(
			table.threadId,
			table.threadRevisionId,
		),

		// All summaries for a thread.
		index("ai_thread_summary_thread_id_idx").on(table.threadId),
	],
);

// ---------------------------------------------------------------------------
// ai_thread_priority
// ---------------------------------------------------------------------------

export const aiThreadPriority = sqliteTable(
	"ai_thread_priority",
	{
		id: text("id").primaryKey(),

		// Parent thread.
		threadId: text("thread_id")
			.notNull()
			.references(() => thread.id, { onDelete: "cascade" }),

		// Source revision — the revision this priority was derived from.
		threadRevisionId: text("thread_revision_id")
			.notNull()
			.references(() => threadRevision.id, { onDelete: "cascade" }),

		// Semantic priority level.  Uses low|medium|high rather than numeric
		// ordinals so the meaning is clear without a lookup table.
		priorityLevel: text("priority_level", {
			enum: ["low", "medium", "high"],
		}).notNull(),

		// Optional rationale from the AI model (for explainability).
		rationale: text("rationale"),

		// AI model identifier used to generate this priority.
		modelId: text("model_id"),

		// Timestamps.
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		// Enforce priority_level value set.
		check(
			"ai_thread_priority_level_check",
			sql`${table.priorityLevel} IN ('low', 'medium', 'high')`,
		),

		// At most one priority per (thread, revision).
		uniqueIndex("ai_thread_priority_thread_revision_unique").on(
			table.threadId,
			table.threadRevisionId,
		),

		// All priorities for a thread.
		index("ai_thread_priority_thread_id_idx").on(table.threadId),
	],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const aiThreadSummaryRelations = relations(
	aiThreadSummary,
	({ one }) => ({
		thread: one(thread, {
			fields: [aiThreadSummary.threadId],
			references: [thread.id],
		}),
		threadRevision: one(threadRevision, {
			fields: [aiThreadSummary.threadRevisionId],
			references: [threadRevision.id],
		}),
	}),
);

export const aiThreadPriorityRelations = relations(
	aiThreadPriority,
	({ one }) => ({
		thread: one(thread, {
			fields: [aiThreadPriority.threadId],
			references: [thread.id],
		}),
		threadRevision: one(threadRevision, {
			fields: [aiThreadPriority.threadRevisionId],
			references: [threadRevision.id],
		}),
	}),
);
