CREATE TABLE `thread_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`revision_number` integer NOT NULL,
	`content_hash` text NOT NULL,
	`change_reason` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `thread`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `thread_revision_thread_revision_number_unique` ON `thread_revision` (`thread_id`,`revision_number`);--> statement-breakpoint
CREATE INDEX `thread_revision_thread_id_idx` ON `thread_revision` (`thread_id`);--> statement-breakpoint
CREATE INDEX `thread_revision_thread_id_number_idx` ON `thread_revision` (`thread_id`,`revision_number`);--> statement-breakpoint
CREATE TABLE `ai_thread_priority` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`thread_revision_id` text NOT NULL,
	`priority_level` text NOT NULL,
	`rationale` text,
	`model_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `thread`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`thread_revision_id`) REFERENCES `thread_revision`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ai_thread_priority_level_check" CHECK("ai_thread_priority"."priority_level" IN ('low', 'medium', 'high'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_thread_priority_thread_revision_unique` ON `ai_thread_priority` (`thread_id`,`thread_revision_id`);--> statement-breakpoint
CREATE INDEX `ai_thread_priority_thread_id_idx` ON `ai_thread_priority` (`thread_id`);--> statement-breakpoint
CREATE TABLE `ai_thread_summary` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`thread_revision_id` text NOT NULL,
	`summary_text` text NOT NULL,
	`model_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `thread`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`thread_revision_id`) REFERENCES `thread_revision`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_thread_summary_thread_revision_unique` ON `ai_thread_summary` (`thread_id`,`thread_revision_id`);--> statement-breakpoint
CREATE INDEX `ai_thread_summary_thread_id_idx` ON `ai_thread_summary` (`thread_id`);--> statement-breakpoint
CREATE TABLE `action_item` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`source_revision_id` text,
	`lifecycle_state` text DEFAULT 'pending' NOT NULL,
	`destination_integration_id` text,
	`provider_item_id` text,
	`title` text NOT NULL,
	`description` text,
	`suggested_due_at` integer,
	`priority` text,
	`model_id` text,
	`confirmed_at` integer,
	`dismissed_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `thread`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_revision_id`) REFERENCES `thread_revision`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`destination_integration_id`) REFERENCES `destination_integration`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "action_item_lifecycle_state_check" CHECK("action_item"."lifecycle_state" IN ('pending', 'confirmed', 'dismissed', 'completed')),
	CONSTRAINT "action_item_confirmed_needs_destination" CHECK(("action_item"."lifecycle_state" != 'confirmed' OR "action_item"."destination_integration_id" IS NOT NULL)),
	CONSTRAINT "action_item_priority_check" CHECK("action_item"."priority" IS NULL OR "action_item"."priority" IN ('low', 'medium', 'high'))
);
--> statement-breakpoint
CREATE INDEX `action_item_thread_id_idx` ON `action_item` (`thread_id`);--> statement-breakpoint
CREATE INDEX `action_item_thread_lifecycle_idx` ON `action_item` (`thread_id`,`lifecycle_state`);--> statement-breakpoint
CREATE INDEX `action_item_source_revision_id_idx` ON `action_item` (`source_revision_id`);--> statement-breakpoint
CREATE INDEX `action_item_destination_integration_id_idx` ON `action_item` (`destination_integration_id`);--> statement-breakpoint
CREATE TABLE `attachment` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`filename` text,
	`content_type` text,
	`byte_size` integer,
	`provider_attachment_id` text,
	`ingestion_state` text DEFAULT 'pending' NOT NULL,
	`object_asset_id` text,
	`ingestion_error` text,
	`uploaded_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`object_asset_id`) REFERENCES `object_asset`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "attachment_ingestion_state_check" CHECK("attachment"."ingestion_state" IN ('pending', 'uploaded', 'failed', 'skipped')),
	CONSTRAINT "attachment_uploaded_needs_asset" CHECK(("attachment"."ingestion_state" != 'uploaded' OR "attachment"."object_asset_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `attachment_message_id_idx` ON `attachment` (`message_id`);--> statement-breakpoint
CREATE INDEX `attachment_ingestion_state_idx` ON `attachment` (`ingestion_state`);--> statement-breakpoint
CREATE INDEX `attachment_object_asset_id_idx` ON `attachment` (`object_asset_id`);--> statement-breakpoint
CREATE TABLE `object_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`bucket` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text,
	`byte_size` integer,
	`checksum` text,
	`storage_provider` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `object_asset_bucket_key_idx` ON `object_asset` (`bucket`,`object_key`);--> statement-breakpoint
CREATE TABLE `raw_payload_ref` (
	`id` text PRIMARY KEY NOT NULL,
	`object_asset_id` text NOT NULL,
	`payload_type` text NOT NULL,
	`thread_id` text,
	`message_id` text,
	`provider` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`object_asset_id`) REFERENCES `object_asset`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`thread_id`) REFERENCES `thread`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "raw_payload_ref_type_check" CHECK("raw_payload_ref"."payload_type" IN ('thread', 'message'))
);
--> statement-breakpoint
CREATE INDEX `raw_payload_ref_thread_id_idx` ON `raw_payload_ref` (`thread_id`);--> statement-breakpoint
CREATE INDEX `raw_payload_ref_message_id_idx` ON `raw_payload_ref` (`message_id`);--> statement-breakpoint
CREATE TABLE `thread_embedding` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`thread_revision_id` text NOT NULL,
	`embedding` blob NOT NULL,
	`embedding_dimension` integer NOT NULL,
	`embedding_model` text NOT NULL,
	`is_search_excluded` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `thread`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`thread_revision_id`) REFERENCES `thread_revision`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `thread_embedding_thread_revision_model_unique` ON `thread_embedding` (`thread_id`,`thread_revision_id`,`embedding_model`);--> statement-breakpoint
CREATE INDEX `thread_embedding_thread_id_idx` ON `thread_embedding` (`thread_id`);--> statement-breakpoint
CREATE INDEX `thread_embedding_revision_id_idx` ON `thread_embedding` (`thread_revision_id`);--> statement-breakpoint
CREATE INDEX `thread_embedding_search_excluded_idx` ON `thread_embedding` (`is_search_excluded`);