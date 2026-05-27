CREATE TABLE `integration_mutation_journal` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`mutation_target` text NOT NULL,
	`connected_account_id` text,
	`destination_integration_id` text,
	`action_item_id` text,
	`mutation_type` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_attempted_at` integer,
	`next_attempt_at` integer,
	`provider_response_id` text,
	`error_code` text,
	`error_message` text,
	`mutation_payload_json` text,
	`succeeded_at` integer,
	`abandoned_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connected_account_id`) REFERENCES `connected_account`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`destination_integration_id`) REFERENCES `destination_integration`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`action_item_id`) REFERENCES `action_item`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "imj_mutation_target_check" CHECK("integration_mutation_journal"."mutation_target" IN ('connected_account', 'destination_integration')),
	CONSTRAINT "imj_connected_account_target_needs_id" CHECK(("integration_mutation_journal"."mutation_target" != 'connected_account' OR "integration_mutation_journal"."connected_account_id" IS NOT NULL)),
	CONSTRAINT "imj_destination_integration_target_needs_id" CHECK(("integration_mutation_journal"."mutation_target" != 'destination_integration' OR "integration_mutation_journal"."destination_integration_id" IS NOT NULL)),
	CONSTRAINT "imj_exactly_one_target" CHECK(("integration_mutation_journal"."connected_account_id" IS NULL) != ("integration_mutation_journal"."destination_integration_id" IS NULL)),
	CONSTRAINT "imj_status_check" CHECK("integration_mutation_journal"."status" IN ('pending', 'in_flight', 'succeeded', 'failed', 'abandoned'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `imj_idempotency_key_unique` ON `integration_mutation_journal` (`mutation_target`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `imj_user_id_idx` ON `integration_mutation_journal` (`user_id`);--> statement-breakpoint
CREATE INDEX `imj_connected_account_id_idx` ON `integration_mutation_journal` (`connected_account_id`);--> statement-breakpoint
CREATE INDEX `imj_destination_integration_id_idx` ON `integration_mutation_journal` (`destination_integration_id`);--> statement-breakpoint
CREATE INDEX `imj_action_item_id_idx` ON `integration_mutation_journal` (`action_item_id`);--> statement-breakpoint
CREATE INDEX `imj_status_next_attempt_idx` ON `integration_mutation_journal` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `imj_user_status_idx` ON `integration_mutation_journal` (`user_id`,`status`);