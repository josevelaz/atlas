/**
 * Atlas domain: Sync State and Sync Job
 *
 * These two tables model the sync layer for a connected mailbox account.
 * They are intentionally SEPARATE concepts:
 *
 *   `sync_state` — durable, current stream state for a connected account.
 *     One row per connected account.  Holds the provider cursor / page token
 *     needed to resume incremental sync.  Updated in-place as sync progresses.
 *     This is the "where are we up to" record.
 *
 *   `sync_job` — append-only operational run history.
 *     One row per sync attempt.  Records start time, end time, outcome, and
 *     error details.  Rows are never updated after completion — new rows are
 *     inserted for each run.  This is the "what happened" audit log.
 *
 * Separation rationale:
 *   Keeping current state and run history in separate tables avoids the
 *   "update-in-place vs append-only" tension.  `sync_state` can be read
 *   cheaply with a PK lookup; `sync_job` can be queried for history without
 *   touching the hot state row.
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

// ---------------------------------------------------------------------------
// sync_state — durable current stream state (one row per connected account)
// ---------------------------------------------------------------------------

export const syncState = sqliteTable(
	"sync_state",
	{
		id: text("id").primaryKey(),

		// Ownership — one sync_state per connected_account.
		connectedAccountId: text("connected_account_id")
			.notNull()
			.references(() => connectedAccount.id, { onDelete: "cascade" }),

		// Provider-specific cursor / page token for incremental sync.
		// Null means a full sync is required (initial or after reset).
		syncCursor: text("sync_cursor"),

		// Sync mode: "full" | "incremental"
		syncMode: text("sync_mode", { enum: ["full", "incremental"] })
			.notNull()
			.default("full"),

		// Overall sync health: "ok" | "degraded" | "failed"
		health: text("health", { enum: ["ok", "degraded", "failed"] })
			.notNull()
			.default("ok"),

		// Timestamp of the last successful sync completion.
		lastSyncedAt: integer("last_synced_at", { mode: "timestamp_ms" }),

		// Timestamp of the last sync attempt (success or failure).
		lastAttemptedAt: integer("last_attempted_at", { mode: "timestamp_ms" }),

		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		// One sync_state per connected_account.
		uniqueIndex("sync_state_connected_account_unique").on(
			table.connectedAccountId,
		),
		// Enforce health value set.
		check(
			"sync_state_health_check",
			sql`${table.health} IN ('ok', 'degraded', 'failed')`,
		),
		// Enforce sync_mode value set.
		check(
			"sync_state_mode_check",
			sql`${table.syncMode} IN ('full', 'incremental')`,
		),
	],
);

// ---------------------------------------------------------------------------
// sync_job — append-only operational run history
// ---------------------------------------------------------------------------

export const syncJob = sqliteTable(
	"sync_job",
	{
		id: text("id").primaryKey(),

		// Ownership — each job belongs to a connected_account.
		connectedAccountId: text("connected_account_id")
			.notNull()
			.references(() => connectedAccount.id, { onDelete: "cascade" }),

		// Job type: "full" | "incremental" | "partial"
		jobType: text("job_type", {
			enum: ["full", "incremental", "partial"],
		}).notNull(),

		// Outcome: "running" | "success" | "partial_success" | "failed" | "cancelled"
		status: text("status", {
			enum: ["running", "success", "partial_success", "failed", "cancelled"],
		})
			.notNull()
			.default("running"),

		// Timestamps for the run window.
		startedAt: integer("started_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		finishedAt: integer("finished_at", { mode: "timestamp_ms" }),

		// Counts for observability.
		threadsProcessed: integer("threads_processed").default(0).notNull(),
		messagesProcessed: integer("messages_processed").default(0).notNull(),
		errorsEncountered: integer("errors_encountered").default(0).notNull(),

		// Error detail (JSON string) — sanitized, no provider secrets.
		errorDetail: text("error_detail"),

		// The sync cursor snapshot at the START of this job (for replay).
		cursorSnapshot: text("cursor_snapshot"),

		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		// Fast lookup of all jobs for a connected account (most recent first).
		index("sync_job_connected_account_id_idx").on(table.connectedAccountId),
		// Fast lookup of running jobs (for crash recovery).
		index("sync_job_status_idx").on(table.status),
		// Enforce status value set.
		check(
			"sync_job_status_check",
			sql`${table.status} IN ('running', 'success', 'partial_success', 'failed', 'cancelled')`,
		),
		// Enforce job_type value set.
		check(
			"sync_job_type_check",
			sql`${table.jobType} IN ('full', 'incremental', 'partial')`,
		),
	],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const syncStateRelations = relations(syncState, ({ one }) => ({
	connectedAccount: one(connectedAccount, {
		fields: [syncState.connectedAccountId],
		references: [connectedAccount.id],
	}),
}));

export const syncJobRelations = relations(syncJob, ({ one }) => ({
	connectedAccount: one(connectedAccount, {
		fields: [syncJob.connectedAccountId],
		references: [connectedAccount.id],
	}),
}));
