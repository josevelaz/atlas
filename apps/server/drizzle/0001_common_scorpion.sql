ALTER TABLE `account` ADD `is_primary` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `account_user_primary_uq` ON `account` (`user_id`) WHERE is_primary = 1;