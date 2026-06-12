CREATE TABLE `attachment` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`provider_attachment_id` text NOT NULL,
	`filename` text,
	`mime_type` text,
	`size_bytes` integer,
	`bytes_state` text DEFAULT 'metadata_only' NOT NULL,
	`storage_ref` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attachment_messageId_idx` ON `attachment` (`message_id`);--> statement-breakpoint
CREATE TABLE `connected_account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`auth_account_id` text NOT NULL,
	`provider` text DEFAULT 'gmail' NOT NULL,
	`email_address` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`sync_state` text DEFAULT 'pending' NOT NULL,
	`checkpoint_history_id` text,
	`checkpoint_at` integer,
	`last_synced_history_id` text,
	`last_synced_at` integer,
	`watch_expiration` integer,
	`watch_failure_count` integer DEFAULT 0 NOT NULL,
	`disconnected_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`auth_account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connected_account_user_email_provider_uq` ON `connected_account` (`user_id`,`email_address`,`provider`);--> statement-breakpoint
CREATE INDEX `connected_account_userId_idx` ON `connected_account` (`user_id`);--> statement-breakpoint
CREATE TABLE `message` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`connected_account_id` text NOT NULL,
	`provider_message_id` text NOT NULL,
	`from_email` text NOT NULL,
	`from_name` text,
	`to_json` text,
	`sent_at` integer NOT NULL,
	`preview` text,
	`body_state` text DEFAULT 'preview_only' NOT NULL,
	`body_ref` text,
	`spam_flagged_at_ingest` integer DEFAULT false NOT NULL,
	`rfc822_message_id` text,
	`in_reply_to` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `thread`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connected_account_id`) REFERENCES `connected_account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_account_provider_message_uq` ON `message` (`connected_account_id`,`provider_message_id`);--> statement-breakpoint
CREATE INDEX `message_thread_sent_at_idx` ON `message` (`thread_id`,`sent_at`);--> statement-breakpoint
CREATE TABLE `sender` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email_address` text NOT NULL,
	`trust` text DEFAULT 'unscreened' NOT NULL,
	`default_category` text,
	`decided_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sender_user_email_uq` ON `sender` (`user_id`,`email_address`);--> statement-breakpoint
CREATE INDEX `sender_user_trust_idx` ON `sender` (`user_id`,`trust`);--> statement-breakpoint
CREATE TABLE `sync_gap` (
	`id` text PRIMARY KEY NOT NULL,
	`connected_account_id` text NOT NULL,
	`from_history_id` text NOT NULL,
	`reset_to_history_id` text NOT NULL,
	`reason` text NOT NULL,
	`detected_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`connected_account_id`) REFERENCES `connected_account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sync_gap_connectedAccountId_idx` ON `sync_gap` (`connected_account_id`);--> statement-breakpoint
CREATE TABLE `thread` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`connected_account_id` text NOT NULL,
	`provider_thread_id` text NOT NULL,
	`state` text DEFAULT 'screener' NOT NULL,
	`category` text,
	`category_overridden` integer DEFAULT false NOT NULL,
	`sender_email` text NOT NULL,
	`subject` text,
	`preview` text,
	`last_message_at` integer,
	`message_count` integer DEFAULT 0 NOT NULL,
	`read` integer DEFAULT false NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`trashed` integer DEFAULT false NOT NULL,
	`first_ingested_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connected_account_id`) REFERENCES `connected_account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `thread_account_provider_thread_uq` ON `thread` (`connected_account_id`,`provider_thread_id`);--> statement-breakpoint
CREATE INDEX `thread_user_state_last_message_idx` ON `thread` (`user_id`,`state`,`last_message_at`);--> statement-breakpoint
CREATE INDEX `thread_connectedAccountId_idx` ON `thread` (`connected_account_id`);