CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`project` text NOT NULL,
	`path` text NOT NULL,
	`metadata` text NOT NULL,
	`original` text NOT NULL,
	`graded` text,
	`state` text DEFAULT '{}' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`project` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`folder` text DEFAULT '' NOT NULL,
	`created` integer NOT NULL,
	`archive` text,
	`legacy` text DEFAULT '{}' NOT NULL,
	`share` text
);
--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`project` text NOT NULL,
	`user` text NOT NULL,
	`key` text NOT NULL,
	`multipart` text NOT NULL,
	`parts` text DEFAULT '[]' NOT NULL
);
