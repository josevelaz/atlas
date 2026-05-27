PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_thread_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`revision_number` integer NOT NULL,
	`content_hash` text NOT NULL,
	`change_reason` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `thread`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "thread_revision_number_positive" CHECK("__new_thread_revision"."revision_number" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_thread_revision`("id", "thread_id", "revision_number", "content_hash", "change_reason", "created_at") SELECT "id", "thread_id", "revision_number", "content_hash", "change_reason", "created_at" FROM `thread_revision`;--> statement-breakpoint
DROP TABLE `thread_revision`;--> statement-breakpoint
ALTER TABLE `__new_thread_revision` RENAME TO `thread_revision`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `thread_revision_thread_revision_number_unique` ON `thread_revision` (`thread_id`,`revision_number`);--> statement-breakpoint
CREATE INDEX `thread_revision_thread_id_idx` ON `thread_revision` (`thread_id`);--> statement-breakpoint
CREATE TABLE `__new_attachment` (
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
	CONSTRAINT "attachment_ingestion_state_check" CHECK("__new_attachment"."ingestion_state" IN ('pending', 'uploaded', 'failed', 'skipped')),
	CONSTRAINT "attachment_uploaded_needs_asset" CHECK(("__new_attachment"."ingestion_state" != 'uploaded' OR "__new_attachment"."object_asset_id" IS NOT NULL)),
	CONSTRAINT "attachment_uploaded_needs_timestamp" CHECK(("__new_attachment"."ingestion_state" != 'uploaded' OR "__new_attachment"."uploaded_at" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_attachment`("id", "message_id", "filename", "content_type", "byte_size", "provider_attachment_id", "ingestion_state", "object_asset_id", "ingestion_error", "uploaded_at", "created_at", "updated_at") SELECT "id", "message_id", "filename", "content_type", "byte_size", "provider_attachment_id", "ingestion_state", "object_asset_id", "ingestion_error", "uploaded_at", "created_at", "updated_at" FROM `attachment`;--> statement-breakpoint
DROP TABLE `attachment`;--> statement-breakpoint
ALTER TABLE `__new_attachment` RENAME TO `attachment`;--> statement-breakpoint
CREATE INDEX `attachment_message_id_idx` ON `attachment` (`message_id`);--> statement-breakpoint
CREATE INDEX `attachment_ingestion_state_idx` ON `attachment` (`ingestion_state`);--> statement-breakpoint
CREATE INDEX `attachment_object_asset_id_idx` ON `attachment` (`object_asset_id`);--> statement-breakpoint
CREATE TABLE `__new_raw_payload_ref` (
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
	CONSTRAINT "raw_payload_ref_type_check" CHECK("__new_raw_payload_ref"."payload_type" IN ('thread', 'message')),
	CONSTRAINT "raw_payload_ref_exactly_one_parent" CHECK(("__new_raw_payload_ref"."thread_id" IS NULL) != ("__new_raw_payload_ref"."message_id" IS NULL))
);
--> statement-breakpoint
INSERT INTO `__new_raw_payload_ref`("id", "object_asset_id", "payload_type", "thread_id", "message_id", "provider", "created_at") SELECT "id", "object_asset_id", "payload_type", "thread_id", "message_id", "provider", "created_at" FROM `raw_payload_ref`;--> statement-breakpoint
DROP TABLE `raw_payload_ref`;--> statement-breakpoint
ALTER TABLE `__new_raw_payload_ref` RENAME TO `raw_payload_ref`;--> statement-breakpoint
CREATE INDEX `raw_payload_ref_thread_id_idx` ON `raw_payload_ref` (`thread_id`);--> statement-breakpoint
CREATE INDEX `raw_payload_ref_message_id_idx` ON `raw_payload_ref` (`message_id`);--> statement-breakpoint
CREATE TABLE `__new_thread_embedding` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`thread_revision_id` text NOT NULL,
	`embedding` blob NOT NULL,
	`embedding_dimension` integer NOT NULL,
	`embedding_model` text NOT NULL,
	`is_search_excluded` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `thread`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`thread_revision_id`) REFERENCES `thread_revision`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "thread_embedding_dimension_positive" CHECK("__new_thread_embedding"."embedding_dimension" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_thread_embedding`("id", "thread_id", "thread_revision_id", "embedding", "embedding_dimension", "embedding_model", "is_search_excluded", "created_at") SELECT "id", "thread_id", "thread_revision_id", "embedding", "embedding_dimension", "embedding_model", "is_search_excluded", "created_at" FROM `thread_embedding`;--> statement-breakpoint
DROP TABLE `thread_embedding`;--> statement-breakpoint
ALTER TABLE `__new_thread_embedding` RENAME TO `thread_embedding`;--> statement-breakpoint
CREATE UNIQUE INDEX `thread_embedding_thread_revision_model_unique` ON `thread_embedding` (`thread_id`,`thread_revision_id`,`embedding_model`);--> statement-breakpoint
CREATE INDEX `thread_embedding_thread_id_idx` ON `thread_embedding` (`thread_id`);--> statement-breakpoint
CREATE INDEX `thread_embedding_revision_id_idx` ON `thread_embedding` (`thread_revision_id`);--> statement-breakpoint
CREATE INDEX `thread_embedding_search_excluded_idx` ON `thread_embedding` (`is_search_excluded`);