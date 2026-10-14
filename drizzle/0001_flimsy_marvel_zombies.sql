CREATE TABLE `snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quarter` integer NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `snapshots_quarter_unique` ON `snapshots` (`quarter`);--> statement-breakpoint
ALTER TABLE `game` ADD `deadline_at` integer DEFAULT 0 NOT NULL;