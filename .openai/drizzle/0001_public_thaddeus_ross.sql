CREATE TABLE `book_artworks` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`image_key` text NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`uploaded_by` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `book_covers` (
	`key` text PRIMARY KEY NOT NULL,
	`content_type` text NOT NULL,
	`data` blob NOT NULL,
	`created_at` text NOT NULL,
	`uploaded_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `comment_reports` (
	`comment_id` text NOT NULL,
	`voter_key` text NOT NULL,
	`reason` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`comment_id`, `voter_key`),
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `comment_votes` (
	`comment_id` text NOT NULL,
	`voter_key` text NOT NULL,
	`value` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`comment_id`, `voter_key`),
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`chapter_id` text,
	`author_name` text NOT NULL,
	`body` text NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'approved' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `books` ADD `series_title` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `series_number` integer;--> statement-breakpoint
ALTER TABLE `books` ADD `tropes` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `drive_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `chapters` ADD `drive_url` text DEFAULT '' NOT NULL;