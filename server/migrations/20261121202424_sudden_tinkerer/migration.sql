CREATE TABLE `wish_reactions` (
	`wish_id` text NOT NULL,
	`user_id` text NOT NULL,
	`emoji` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `wish_reactions_pk` PRIMARY KEY(`wish_id`, `user_id`),
	CONSTRAINT `fk_wish_reactions_wish_id_wishes_id_fk` FOREIGN KEY (`wish_id`) REFERENCES `wishes`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_wish_reactions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `wishes` ADD `updated_at` text;--> statement-breakpoint
CREATE INDEX `wish_reactions_user_id_idx` ON `wish_reactions` (`user_id`);