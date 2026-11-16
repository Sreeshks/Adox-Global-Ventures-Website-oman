CREATE TABLE IF NOT EXISTS `cms_history` (
	`revision` integer PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`operation` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `cms_state` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`content` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL,
	`change_id` text NOT NULL
);
