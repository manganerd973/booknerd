CREATE TABLE `book_ratings` (
	`book_id` text NOT NULL,
	`voter_key` text NOT NULL,
	`rating` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`book_id`, `voter_key`),
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `book_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`voter_key` text NOT NULL,
	`author_name` text NOT NULL,
	`body` text NOT NULL,
	`rating` integer NOT NULL,
	`status` text DEFAULT 'approved' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `book_reviews_book_voter_unique` ON `book_reviews` (`book_id`,`voter_key`);