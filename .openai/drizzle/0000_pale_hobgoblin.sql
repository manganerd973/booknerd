CREATE TABLE `admin_users` (
	`email` text PRIMARY KEY NOT NULL,
	`role` text DEFAULT 'editor' NOT NULL,
	`created_at` text NOT NULL,
	`invited_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`original_title` text DEFAULT '' NOT NULL,
	`author` text NOT NULL,
	`synopsis` text DEFAULT '' NOT NULL,
	`genres` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'Черновик' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`cover_key` text,
	`published` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `books_slug_unique` ON `books` (`slug`);--> statement-breakpoint
CREATE TABLE `chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`chapter_number` integer NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chapters_book_number_unique` ON `chapters` (`book_id`,`chapter_number`);