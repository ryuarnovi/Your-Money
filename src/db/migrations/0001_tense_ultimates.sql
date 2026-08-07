CREATE TABLE `emergency_fund_histories` (
	`id` text PRIMARY KEY NOT NULL,
	`fund_id` text NOT NULL,
	`amount` real NOT NULL,
	`note` text,
	`date` integer NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`fund_id`) REFERENCES `emergency_funds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `emergency_funds` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`monthly_expense` real NOT NULL,
	`target_months` integer DEFAULT 6 NOT NULL,
	`target_amount` real NOT NULL,
	`current_amount` real DEFAULT 0,
	`status` text DEFAULT 'single' NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `emergency_funds_user_id_unique` ON `emergency_funds` (`user_id`);