ALTER TABLE `project_presence` ADD `document` text;--> statement-breakpoint
ALTER TABLE `project_presence` ADD `activity` integer DEFAULT 0 NOT NULL;