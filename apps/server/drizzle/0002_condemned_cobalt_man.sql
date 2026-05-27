CREATE TABLE `message` (
	`id` text PRIMARY KEY NOT NULL,
	`connected_account_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`provider_message_id` text NOT NULL,
	`subject` text,
	`snippet` text,
	`from_name` text,
	`from_email` text,
	`body_text` text,
	`body_html` text,
	`sent_at` integer,
	`is_provider_read` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`connected_account_id`) REFERENCES `connected_account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`thread_id`) REFERENCES `thread`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_provider_message_id_unique` ON `message` (`connected_account_id`,`provider_message_id`);--> statement-breakpoint
CREATE INDEX `message_thread_id_idx` ON `message` (`thread_id`);--> statement-breakpoint
CREATE INDEX `message_connected_account_id_idx` ON `message` (`connected_account_id`);--> statement-breakpoint
CREATE INDEX `message_sent_at_idx` ON `message` (`thread_id`,`sent_at`);--> statement-breakpoint
CREATE TABLE `message_participant` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`role` text NOT NULL,
	`email_address` text NOT NULL,
	`display_name` text,
	`email_identity_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `message`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`email_identity_id`) REFERENCES `email_identity`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "message_participant_role_check" CHECK("message_participant"."role" IN ('from', 'to', 'cc', 'bcc', 'reply_to'))
);
--> statement-breakpoint
CREATE INDEX `message_participant_message_id_idx` ON `message_participant` (`message_id`);--> statement-breakpoint
CREATE INDEX `message_participant_email_address_idx` ON `message_participant` (`email_address`);--> statement-breakpoint
CREATE INDEX `message_participant_email_identity_id_idx` ON `message_participant` (`email_identity_id`);--> statement-breakpoint
CREATE TABLE `thread` (
	`id` text PRIMARY KEY NOT NULL,
	`connected_account_id` text NOT NULL,
	`provider_thread_id` text NOT NULL,
	`screening_state` text DEFAULT 'pending' NOT NULL,
	`category` text,
	`prior_category` text,
	`initiating_sender_email_identity_id` text,
	`is_hidden` integer DEFAULT false NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`is_trashed` integer DEFAULT false NOT NULL,
	`handling_state` text,
	`is_read` integer DEFAULT false NOT NULL,
	`subject` text,
	`snippet` text,
	`last_message_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`connected_account_id`) REFERENCES `connected_account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`initiating_sender_email_identity_id`) REFERENCES `email_identity`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "thread_category_invariant" CHECK((
        ("thread"."screening_state" = 'accepted' AND "thread"."category" IS NOT NULL)
        OR
        ("thread"."screening_state" != 'accepted' AND "thread"."category" IS NULL)
      )),
	CONSTRAINT "thread_archive_accepted_only" CHECK(("thread"."is_archived" = 0 OR "thread"."screening_state" = 'accepted')),
	CONSTRAINT "thread_handling_state_accepted_only" CHECK(("thread"."handling_state" IS NULL OR "thread"."screening_state" = 'accepted')),
	CONSTRAINT "thread_screening_state_check" CHECK("thread"."screening_state" IN ('pending', 'accepted', 'rejected')),
	CONSTRAINT "thread_category_check" CHECK("thread"."category" IS NULL OR "thread"."category" IN ('inbox', 'feed', 'paper_trail')),
	CONSTRAINT "thread_prior_category_check" CHECK("thread"."prior_category" IS NULL OR "thread"."prior_category" IN ('inbox', 'feed', 'paper_trail')),
	CONSTRAINT "thread_handling_state_check" CHECK("thread"."handling_state" IS NULL OR "thread"."handling_state" IN ('set_aside', 'reply_later'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `thread_provider_thread_id_unique` ON `thread` (`connected_account_id`,`provider_thread_id`);--> statement-breakpoint
CREATE INDEX `thread_connected_account_id_idx` ON `thread` (`connected_account_id`);--> statement-breakpoint
CREATE INDEX `thread_connected_account_category_idx` ON `thread` (`connected_account_id`,`category`);--> statement-breakpoint
CREATE INDEX `thread_screening_state_idx` ON `thread` (`connected_account_id`,`screening_state`);--> statement-breakpoint
CREATE INDEX `thread_initiating_sender_idx` ON `thread` (`initiating_sender_email_identity_id`);--> statement-breakpoint
CREATE INDEX `thread_is_hidden_idx` ON `thread` (`connected_account_id`,`is_hidden`);--> statement-breakpoint
CREATE INDEX `thread_last_message_at_idx` ON `thread` (`connected_account_id`,`last_message_at`);--> statement-breakpoint
CREATE TABLE `sender_routing_rule` (
	`id` text PRIMARY KEY NOT NULL,
	`connected_account_id` text NOT NULL,
	`email_address` text NOT NULL,
	`email_identity_id` text,
	`screening_decision` text NOT NULL,
	`default_category` text,
	`decided_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`connected_account_id`) REFERENCES `connected_account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`email_identity_id`) REFERENCES `email_identity`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "sender_routing_rule_category_invariant" CHECK((
        ("sender_routing_rule"."screening_decision" = 'accepted' AND "sender_routing_rule"."default_category" IS NOT NULL)
        OR
        ("sender_routing_rule"."screening_decision" = 'rejected' AND "sender_routing_rule"."default_category" IS NULL)
      )),
	CONSTRAINT "sender_routing_rule_decision_check" CHECK("sender_routing_rule"."screening_decision" IN ('accepted', 'rejected')),
	CONSTRAINT "sender_routing_rule_category_check" CHECK("sender_routing_rule"."default_category" IS NULL OR "sender_routing_rule"."default_category" IN ('inbox', 'feed', 'paper_trail'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sender_routing_rule_account_email_unique` ON `sender_routing_rule` (`connected_account_id`,`email_address`);--> statement-breakpoint
CREATE INDEX `sender_routing_rule_account_email_idx` ON `sender_routing_rule` (`connected_account_id`,`email_address`);--> statement-breakpoint
CREATE INDEX `sender_routing_rule_connected_account_id_idx` ON `sender_routing_rule` (`connected_account_id`);--> statement-breakpoint
CREATE INDEX `sender_routing_rule_email_identity_id_idx` ON `sender_routing_rule` (`email_identity_id`);