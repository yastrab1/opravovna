CREATE TABLE `project_presence` (
	`project` text NOT NULL,
	`user` text NOT NULL,
	`session` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`image` text NOT NULL,
	`updated` integer NOT NULL,
	PRIMARY KEY(`project`, `user`, `session`)
);
--> statement-breakpoint
CREATE INDEX `presence_updated_idx` ON `project_presence` (`updated`);