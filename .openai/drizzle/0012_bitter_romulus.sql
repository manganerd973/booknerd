CREATE TABLE `reader_public_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor_key` text NOT NULL,
	`source_annotation_id` text NOT NULL,
	`book_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`author_name` text DEFAULT 'Читатель BOOKNERD' NOT NULL,
	`quote` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`paragraph_index` integer DEFAULT 0 NOT NULL,
	`page` integer DEFAULT 0 NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`is_pinned` integer DEFAULT false NOT NULL,
	`approved_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reader_public_notes_source_unique` ON `reader_public_notes` (`visitor_key`,`source_annotation_id`);--> statement-breakpoint
CREATE INDEX `reader_public_notes_status_created_idx` ON `reader_public_notes` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `reader_public_notes_pinned_updated_idx` ON `reader_public_notes` (`is_pinned`,`updated_at`);--> statement-breakpoint
CREATE INDEX `reader_public_notes_book_chapter_idx` ON `reader_public_notes` (`book_id`,`chapter_id`);