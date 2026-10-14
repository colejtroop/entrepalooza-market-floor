CREATE TABLE `announcements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `game` (
	`id` integer PRIMARY KEY NOT NULL,
	`quarter` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'lobby' NOT NULL,
	`event_key` text DEFAULT 'steady' NOT NULL,
	`updated_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` text NOT NULL,
	`quarter` integer NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `submission_team_quarter` ON `submissions` (`team_id`,`quarter`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`join_code` text NOT NULL,
	`specialization` text NOT NULL,
	`segment` text NOT NULL,
	`price` real DEFAULT 49 NOT NULL,
	`cash` real DEFAULT 100000 NOT NULL,
	`debt` real DEFAULT 0 NOT NULL,
	`customers` integer DEFAULT 40 NOT NULL,
	`revenue` real DEFAULT 0 NOT NULL,
	`valuation` real DEFAULT 500000 NOT NULL,
	`marketing` real DEFAULT 45 NOT NULL,
	`product` real DEFAULT 45 NOT NULL,
	`research` real DEFAULT 35 NOT NULL,
	`operations` real DEFAULT 50 NOT NULL,
	`reputation` real DEFAULT 45 NOT NULL,
	`social_impact` real DEFAULT 0 NOT NULL,
	`risk_score` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`submitted` integer DEFAULT false NOT NULL,
	`last_change` real DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_name_unique` ON `teams` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `teams_code_unique` ON `teams` (`join_code`);