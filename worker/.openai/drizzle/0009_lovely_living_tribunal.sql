CREATE TABLE IF NOT EXISTS `book_glossary` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`category` text DEFAULT 'character' NOT NULL,
	`name` text NOT NULL,
	`pronunciation` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`connections` text DEFAULT '' NOT NULL,
	`reveal_after_chapter` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `book_glossary_book_reveal_idx` ON `book_glossary` (`book_id`,`reveal_after_chapter`,`sort_order`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chapter_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text NOT NULL,
	`action` text NOT NULL,
	`from_status` text DEFAULT '' NOT NULL,
	`to_status` text DEFAULT '' NOT NULL,
	`editor_email` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `chapter_audit_chapter_created_idx` ON `chapter_audit` (`chapter_id`,`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `chapter_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text NOT NULL,
	`title` text NOT NULL,
	`point_of_view` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`body_rich` text DEFAULT '' NOT NULL,
	`footnotes` text DEFAULT '[]' NOT NULL,
	`team_note` text DEFAULT '' NOT NULL,
	`workflow_status` text DEFAULT 'draft' NOT NULL,
	`scheduled_at` text,
	`saved_by` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `chapter_versions_chapter_created_idx` ON `chapter_versions` (`chapter_id`,`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `notification_preferences` (
	`visitor_key` text NOT NULL,
	`book_key` text NOT NULL,
	`new_chapter` integer DEFAULT true NOT NULL,
	`translation_complete` integer DEFAULT false NOT NULL,
	`author_book` integer DEFAULT false NOT NULL,
	`comment_reply` integer DEFAULT false NOT NULL,
	`team_news` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`visitor_key`, `book_key`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `notification_preferences_book_idx` ON `notification_preferences` (`book_key`,`new_chapter`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `reader_bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor_key` text NOT NULL,
	`book_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`category` text DEFAULT 'later' NOT NULL,
	`quote` text DEFAULT '' NOT NULL,
	`paragraph_index` integer DEFAULT 0 NOT NULL,
	`page` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `reader_bookmarks_visitor_book_idx` ON `reader_bookmarks` (`visitor_key`,`book_id`,`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `reader_error_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor_key` text NOT NULL,
	`book_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`category` text NOT NULL,
	`selected_text` text NOT NULL,
	`paragraph_index` integer DEFAULT 0 NOT NULL,
	`page` integer DEFAULT 0 NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`resolved_by` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `reader_error_reports_status_created_idx` ON `reader_error_reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `reader_error_reports_chapter_idx` ON `reader_error_reports` (`chapter_id`,`paragraph_index`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `reading_sessions` (
	`visitor_key` text NOT NULL,
	`chapter_id` text NOT NULL,
	`book_id` text NOT NULL,
	`reading_date` text NOT NULL,
	`seconds` integer DEFAULT 0 NOT NULL,
	`max_progress` integer DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`notification_return` integer DEFAULT false NOT NULL,
	`started_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`visitor_key`, `chapter_id`, `reading_date`),
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `reading_sessions_book_chapter_idx` ON `reading_sessions` (`book_id`,`chapter_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `reading_sessions_visitor_date_idx` ON `reading_sessions` (`visitor_key`,`reading_date`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `translation_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`suggested_by` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'suggested' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `translation_votes` (
	`candidate_id` text NOT NULL,
	`visitor_key` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`candidate_id`, `visitor_key`),
	FOREIGN KEY (`candidate_id`) REFERENCES `translation_candidates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- New columns are added idempotently by lib/runtime.js. Keeping migration
-- files column-safe prevents repeated deployments from hitting duplicate-column errors.
SELECT 1;
