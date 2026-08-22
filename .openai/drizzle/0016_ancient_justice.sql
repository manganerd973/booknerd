CREATE TABLE `reader_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor_key` text NOT NULL,
	`event_key` text NOT NULL,
	`type` text NOT NULL,
	`book_id` text,
	`chapter_id` text,
	`comment_id` text,
	`actor_name` text DEFAULT '' NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`url` text NOT NULL,
	`read_at` text,
	`hidden_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reader_notifications_visitor_event_unique` ON `reader_notifications` (`visitor_key`,`event_key`);--> statement-breakpoint
CREATE INDEX `reader_notifications_visitor_created_idx` ON `reader_notifications` (`visitor_key`,`created_at`);--> statement-breakpoint
CREATE INDEX `reader_notifications_visitor_read_idx` ON `reader_notifications` (`visitor_key`,`read_at`,`created_at`);--> statement-breakpoint
ALTER TABLE `comments` ADD `context` text DEFAULT 'comments' NOT NULL;