ALTER TABLE `events` ADD `college` text DEFAULT 'ANU' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `image_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `official_url` text DEFAULT '' NOT NULL;