CREATE TABLE `connected_account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider_account_email` text NOT NULL,
	`provider` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`display_name` text,
	`enc_access_token` text,
	`enc_refresh_token` text,
	`access_token_expires_at` integer,
	`enc_key_id` text,
	`enc_algorithm` text,
	`enc_iv` text,
	`connected_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`disconnected_at` integer,
	`reactivated_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "connected_account_status_check" CHECK("connected_account"."status" IN ('active', 'disconnected', 'reactivating', 'error'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connected_account_user_email_unique` ON `connected_account` (`user_id`,`provider_account_email`);--> statement-breakpoint
CREATE INDEX `connected_account_user_id_idx` ON `connected_account` (`user_id`);--> statement-breakpoint
CREATE TABLE `contact` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contact_user_id_idx` ON `contact` (`user_id`);--> statement-breakpoint
CREATE TABLE `email_identity` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`contact_id` text,
	`email_address` text NOT NULL,
	`display_name` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact_id`) REFERENCES `contact`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_identity_user_email_unique` ON `email_identity` (`user_id`,`email_address`);--> statement-breakpoint
CREATE INDEX `email_identity_user_id_idx` ON `email_identity` (`user_id`);--> statement-breakpoint
CREATE INDEX `email_identity_contact_id_idx` ON `email_identity` (`contact_id`);--> statement-breakpoint
CREATE TABLE `destination_integration` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`display_name` text,
	`status` text DEFAULT 'active' NOT NULL,
	`enc_access_token` text,
	`enc_refresh_token` text,
	`access_token_expires_at` integer,
	`enc_key_id` text,
	`enc_algorithm` text,
	`enc_iv` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "destination_integration_status_check" CHECK("destination_integration"."status" IN ('active', 'disconnected', 'error'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `destination_integration_user_provider_account_unique` ON `destination_integration` (`user_id`,`provider`,`provider_account_id`);--> statement-breakpoint
CREATE INDEX `destination_integration_user_id_idx` ON `destination_integration` (`user_id`);--> statement-breakpoint
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
	CONSTRAINT "sync_job_type_check" CHECK("sync_job"."job_type" IN ('full', 'incremental', 'partial'))
);
--> statement-breakpoint
CREATE INDEX `sync_job_connected_account_id_idx` ON `sync_job` (`connected_account_id`);--> statement-breakpoint
CREATE INDEX `sync_job_status_idx` ON `sync_job` (`status`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`id` text PRIMARY KEY NOT NULL,
	`connected_account_id` text NOT NULL,
	`sync_cursor` text,
	`sync_mode` text DEFAULT 'full' NOT NULL,
	`health` text DEFAULT 'ok' NOT NULL,
	`last_synced_at` integer,
	`last_attempted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`connected_account_id`) REFERENCES `connected_account`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "sync_state_health_check" CHECK("sync_state"."health" IN ('ok', 'degraded', 'failed')),
	CONSTRAINT "sync_state_mode_check" CHECK("sync_state"."sync_mode" IN ('full', 'incremental'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_state_connected_account_unique` ON `sync_state` (`connected_account_id`);