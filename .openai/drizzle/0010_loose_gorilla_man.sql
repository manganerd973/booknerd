CREATE TABLE `chapter_emotions` (
	`visitor_key` text NOT NULL,
	`book_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`emoji` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`visitor_key`, `chapter_id`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chapter_emotions_book_idx` ON `chapter_emotions` (`book_id`,`chapter_id`);--> statement-breakpoint
CREATE TABLE `community_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor_key` text NOT NULL,
	`book_id` text,
	`kind` text DEFAULT 'theory' NOT NULL,
	`author_name` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'approved' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `community_posts_kind_created_idx` ON `community_posts` (`kind`,`created_at`);--> statement-breakpoint
CREATE INDEX `community_posts_book_created_idx` ON `community_posts` (`book_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `community_votes` (
	`post_id` text NOT NULL,
	`visitor_key` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`post_id`, `visitor_key`),
	FOREIGN KEY (`post_id`) REFERENCES `community_posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `paragraph_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor_key` text NOT NULL,
	`book_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`paragraph_index` integer DEFAULT 0 NOT NULL,
	`emoji` text NOT NULL,
	`selected_text` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `paragraph_reactions_reader_unique` ON `paragraph_reactions` (`visitor_key`,`chapter_id`,`paragraph_index`,`emoji`);--> statement-breakpoint
CREATE INDEX `paragraph_reactions_chapter_idx` ON `paragraph_reactions` (`chapter_id`,`paragraph_index`);--> statement-breakpoint
CREATE TABLE `reader_dictionary` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor_key` text NOT NULL,
	`book_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`word` text NOT NULL,
	`meaning` text DEFAULT '' NOT NULL,
	`quote` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reader_dictionary_visitor_book_idx` ON `reader_dictionary` (`visitor_key`,`book_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `reader_profiles` (
	`visitor_key` text PRIMARY KEY NOT NULL,
	`display_name` text DEFAULT 'Читатель BOOKNERD' NOT NULL,
	`banner` text DEFAULT 'books' NOT NULL,
	`favorite_characters` text DEFAULT '[]' NOT NULL,
	`favorite_quotes` text DEFAULT '[]' NOT NULL,
	`app_theme` text DEFAULT 'original' NOT NULL,
	`atmosphere` text DEFAULT 'auto' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reader_time_capsules` (
	`visitor_key` text NOT NULL,
	`book_id` text NOT NULL,
	`first_impression` text DEFAULT '' NOT NULL,
	`final_impression` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`visitor_key`, `book_id`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `books` ADD `country` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `publication_year` integer;--> statement-breakpoint
ALTER TABLE `books` ADD `page_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `author_birthday` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `original_release_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `translator` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `editor` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `proofreader` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `playlist_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `team_pick` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `quote_of_day` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `search_aliases` text DEFAULT '[]' NOT NULL;
