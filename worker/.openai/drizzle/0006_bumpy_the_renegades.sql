CREATE TABLE IF NOT EXISTS `push_announcements` (
	`chapter_id` text PRIMARY KEY NOT NULL,
	`sent_at` text NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `push_subscriptions` (
	`endpoint` text PRIMARY KEY NOT NULL,
	`visitor_key` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `push_subscriptions_visitor_idx` ON `push_subscriptions` (`visitor_key`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `reader_library` (
	`visitor_key` text NOT NULL,
	`book_id` text NOT NULL,
	`status` text DEFAULT 'saved' NOT NULL,
	`last_chapter_id` text,
	`progress` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`visitor_key`, `book_id`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`last_chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `reader_library_visitor_updated_idx` ON `reader_library` (`visitor_key`,`updated_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `vapid_config` (
	`id` text PRIMARY KEY NOT NULL,
	`public_key` text NOT NULL,
	`private_key` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
-- The heat-level column is added idempotently by lib/runtime.js.
SELECT 1;
