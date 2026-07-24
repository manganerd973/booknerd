ALTER TABLE `books` ADD `has_hot_scenes` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `hot_scene_chapters` text DEFAULT '' NOT NULL;
