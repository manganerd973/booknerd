CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`visitor_key` text NOT NULL,
	`path` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analytics_events_type_created_idx` ON `analytics_events` (`event_type`,`created_at`);--> statement-breakpoint
CREATE INDEX `analytics_events_type_visitor_idx` ON `analytics_events` (`event_type`,`visitor_key`);--> statement-breakpoint
CREATE TABLE `reader_presence` (
	`visitor_key` text PRIMARY KEY NOT NULL,
	`book_id` text DEFAULT '' NOT NULL,
	`chapter_id` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reader_presence_updated_idx` ON `reader_presence` (`updated_at`);--> statement-breakpoint
CREATE TABLE `site_installs` (
	`visitor_key` text PRIMARY KEY NOT NULL,
	`platform` text DEFAULT 'unknown' NOT NULL,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL
);
