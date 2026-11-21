-- Better Auth username + password model (see docs/adr/0001-user-secret-as-password.md).
-- Back up the database before deploying this migration.
--
-- Existing wishes and names are kept. Existing accounts have no password, so they
-- cannot sign in. The users table is altered in place (never dropped), so
-- ON DELETE CASCADE cannot remove existing wishes.
ALTER TABLE `users` ADD `username` text;--> statement-breakpoint
ALTER TABLE `users` ADD `display_username` text;--> statement-breakpoint
-- name_key was computed with toLocaleLowerCase, so keep it when present.
UPDATE `users` SET `username` = coalesce(`name_key`, lower(trim(`name`))), `display_username` = trim(`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
DROP INDEX IF EXISTS `users_name_key_idx`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `name_key`;--> statement-breakpoint
DROP INDEX IF EXISTS `wishlist_secrets_lookup_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `wishlist_secrets_user_id_idx`;--> statement-breakpoint
DROP TABLE IF EXISTS `wishlist_secrets`;
