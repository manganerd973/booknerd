ALTER TABLE `books` ADD `suitability_profile` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE `books` ADD `age_rating` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `books` ADD `age_reason` text DEFAULT '' NOT NULL;
