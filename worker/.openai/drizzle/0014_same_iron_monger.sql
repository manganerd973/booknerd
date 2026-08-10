ALTER TABLE `books` ADD `world_map_key` text;--> statement-breakpoint
ALTER TABLE `books` ADD `world_map_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `world_map_content_type` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `world_map_size_bytes` integer DEFAULT 0 NOT NULL;