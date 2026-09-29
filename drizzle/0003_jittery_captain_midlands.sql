PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`category` text,
	`intent` text DEFAULT 'learn' NOT NULL,
	`mode` text DEFAULT 'on_campus' NOT NULL,
	`is_free` integer DEFAULT true NOT NULL,
	`starts_at` text NOT NULL,
	`location` text NOT NULL,
	`description` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
-- drizzle-kit's generated SELECT list wrongly includes intent/mode/is_free,
-- which don't exist on the pre-migration table — they're new NOT NULL
-- columns with defaults, so omitting them here lets SQLite fill the default
-- for every pre-existing row (all wiped by the next migration anyway).
INSERT INTO `__new_events`("id", "title", "category", "starts_at", "location", "description", "created_at") SELECT "id", "title", "category", "starts_at", "location", "description", "created_at" FROM `events`;--> statement-breakpoint
DROP TABLE `events`;--> statement-breakpoint
ALTER TABLE `__new_events` RENAME TO `events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;