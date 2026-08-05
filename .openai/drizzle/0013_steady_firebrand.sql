CREATE TABLE `chapter_music` (
	`chapter_id` text PRIMARY KEY NOT NULL,
	`storage_key` text NOT NULL,
	`file_name` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`artist` text DEFAULT '' NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`uploaded_at` text NOT NULL,
	`uploaded_by` text NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chapter_music_storage_key_unique` ON `chapter_music` (`storage_key`);