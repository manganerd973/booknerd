ALTER TABLE `comments` ADD `parent_id` text;
--> statement-breakpoint
ALTER TABLE `comments` ADD `visitor_key` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `reader_profiles` ADD `photo_key` text;
--> statement-breakpoint
ALTER TABLE `reader_profiles` ADD `photo_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `reader_profiles` ADD `photo_content_type` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `reader_profiles` ADD `photo_size_bytes` integer DEFAULT 0 NOT NULL;
