-- Migration: rename sync taxonomy
--
-- sync_state.sync_mode: 'full' → 'initial'  (default also changes)
-- sync_job.job_type:    'full' → 'initial', 'partial' → 'incremental'
--
-- SQLite does not support ALTER TABLE ... DROP CONSTRAINT or ALTER COLUMN,
-- so we use the standard recreate-table pattern:
--   1. Rename old table to a temp name.
--   2. Create new table with updated CHECK constraints and default.
--   3. INSERT ... SELECT with CASE expressions to remap stale values.
--   4. Drop the temp table.
--
-- Existing data mapping:
--   sync_state.sync_mode  'full'    → 'initial'   (was the initial-sync sentinel)
--   sync_job.job_type     'full'    → 'initial'   (first-ever sync run)
--   sync_job.job_type     'partial' → 'incremental' (partial was a sub-type of incremental)

PRAGMA foreign_keys=OFF;--> statement-breakpoint

-- ── sync_state ──────────────────────────────────────────────────────────────

ALTER TABLE `sync_state` RENAME TO `__old_sync_state`;--> statement-breakpoint

CREATE TABLE `sync_state` (
	`id` text PRIMARY KEY NOT NULL,
	`connected_account_id` text NOT NULL,
	`sync_cursor` text,
	`sync_mode` text DEFAULT 'initial' NOT NULL,
	`health` text DEFAULT 'ok' NOT NULL,
	`last_synced_at` integer,
	`last_attempted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`connected_account_id`) REFERENCES `connected_account`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "sync_state_health_check" CHECK("sync_state"."health" IN ('ok', 'degraded', 'failed')),
	CONSTRAINT "sync_state_mode_check" CHECK("sync_state"."sync_mode" IN ('initial', 'incremental'))
);--> statement-breakpoint

INSERT INTO `sync_state` (
	`id`, `connected_account_id`, `sync_cursor`,
	`sync_mode`, `health`,
	`last_synced_at`, `last_attempted_at`,
	`created_at`, `updated_at`
)
SELECT
	`id`, `connected_account_id`, `sync_cursor`,
	-- Remap 'full' → 'initial'; keep 'incremental' as-is.
	CASE `sync_mode` WHEN 'full' THEN 'initial' ELSE `sync_mode` END,
	`health`,
	`last_synced_at`, `last_attempted_at`,
	`created_at`, `updated_at`
FROM `__old_sync_state`;--> statement-breakpoint

DROP TABLE `__old_sync_state`;--> statement-breakpoint

CREATE UNIQUE INDEX `sync_state_connected_account_unique` ON `sync_state` (`connected_account_id`);--> statement-breakpoint

-- ── sync_job ─────────────────────────────────────────────────────────────────

ALTER TABLE `sync_job` RENAME TO `__old_sync_job`;--> statement-breakpoint

CREATE TABLE `sync_job` (
	`id` text PRIMARY KEY NOT NULL,
	`connected_account_id` text NOT NULL,
	`job_type` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`started_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`finished_at` integer,
	`threads_processed` integer DEFAULT 0 NOT NULL,
	`messages_processed` integer DEFAULT 0 NOT NULL,
	`errors_encountered` integer DEFAULT 0 NOT NULL,
	`error_detail` text,
	`cursor_snapshot` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`connected_account_id`) REFERENCES `connected_account`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "sync_job_status_check" CHECK("sync_job"."status" IN ('running', 'success', 'partial_success', 'failed', 'cancelled')),
	CONSTRAINT "sync_job_type_check" CHECK("sync_job"."job_type" IN ('initial', 'incremental'))
);--> statement-breakpoint

INSERT INTO `sync_job` (
	`id`, `connected_account_id`, `job_type`, `status`,
	`started_at`, `finished_at`,
	`threads_processed`, `messages_processed`, `errors_encountered`,
	`error_detail`, `cursor_snapshot`, `created_at`
)
SELECT
	`id`, `connected_account_id`,
	-- Remap 'full' → 'initial'; 'partial' → 'incremental'; keep 'incremental' as-is.
	CASE `job_type`
		WHEN 'full'    THEN 'initial'
		WHEN 'partial' THEN 'incremental'
		ELSE `job_type`
	END,
	`status`,
	`started_at`, `finished_at`,
	`threads_processed`, `messages_processed`, `errors_encountered`,
	`error_detail`, `cursor_snapshot`, `created_at`
FROM `__old_sync_job`;--> statement-breakpoint

DROP TABLE `__old_sync_job`;--> statement-breakpoint

CREATE INDEX `sync_job_connected_account_id_idx` ON `sync_job` (`connected_account_id`);--> statement-breakpoint
CREATE INDEX `sync_job_status_idx` ON `sync_job` (`status`);--> statement-breakpoint

PRAGMA foreign_keys=ON;
