/**
 * Atlas domain: Thread Content Revision
 *
 * A `thread_revision` captures a snapshot of the effective content of a thread
 * at a point in time.  A new revision row is created only when effective thread
 * content changes — e.g. a new message arrives, or a re-parse materially
 * changes the normalized content.
 *
 * Atlas-only overlay changes (read state, category, archive, trash, handling
 * state) do NOT advance the revision counter.  This keeps AI-derived artifacts
 * tied to stable content snapshots rather than to every user interaction.
 *
 * ── Revision advancement rules ───────────────────────────────────────────────
 *
 *   A new revision is created when:
 *     - A new message is added to the thread.
 *     - A re-parse of existing messages materially changes normalized content
 *       (e.g. body text, subject, participant list).
 *
 *   A new revision is NOT created for:
 *     - read/unread state changes
 *     - category assignment or changes
 *     - archive / trash / handling state changes
 *     - screening state changes (pending → accepted / rejected)
 *
 * ── Revision number ──────────────────────────────────────────────────────────
 *
 *   `revision_number` is a monotonically increasing integer scoped to the
 *   parent thread.  The first revision is 1.  The unique index on
 *   (thread_id, revision_number) enforces this.
 *
 * ── Content hash ─────────────────────────────────────────────────────────────
 *
 *   `content_hash` is an application-computed hash of the effective content
 *   (e.g. SHA-256 of the concatenated normalized message bodies).  It is used
 *   to detect whether a re-parse actually changed content before creating a
 *   new revision row.
 */
import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { thread } from "./thread.ts";

// ---------------------------------------------------------------------------
// thread_revision
// ---------------------------------------------------------------------------

export const threadRevision = sqliteTable(
	"thread_revision",
	{
		id: text("id").primaryKey(),

		// Parent thread.
		threadId: text("thread_id")
			.notNull()
			.references(() => thread.id, { onDelete: "cascade" }),

		// Monotonically increasing revision number scoped to the thread.
		// Starts at 1.  Unique per thread.
		revisionNumber: integer("revision_number").notNull(),

		// Application-computed hash of the effective content at this revision.
		// Used to detect whether a re-parse actually changed content.
		contentHash: text("content_hash").notNull(),

		// Human-readable reason for this revision (optional, for debugging).
		// e.g. "new_message", "reparse_content_changed"
		changeReason: text("change_reason"),

		// Timestamp when this revision was created.
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		// Revision number must be unique within a thread.
		uniqueIndex("thread_revision_thread_revision_number_unique").on(
			table.threadId,
			table.revisionNumber,
		),

		// All revisions for a thread (primary listing query).
		index("thread_revision_thread_id_idx").on(table.threadId),

		// Latest revision lookup (order by revision_number DESC LIMIT 1).
		index("thread_revision_thread_id_number_idx").on(
			table.threadId,
			table.revisionNumber,
		),
	],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const threadRevisionRelations = relations(threadRevision, ({ one }) => ({
	thread: one(thread, {
		fields: [threadRevision.threadId],
		references: [thread.id],
	}),
}));
