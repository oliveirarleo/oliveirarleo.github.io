CREATE TABLE `wishes` (
	`id` text PRIMARY KEY,
	`author` text NOT NULL,
	`name` text NOT NULL,
	`link` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "wishes_author_length" CHECK(length("author") between 1 and 60),
	CONSTRAINT "wishes_name_length" CHECK(length("name") between 1 and 120),
	CONSTRAINT "wishes_link_length" CHECK(length("link") between 1 and 2000)
);
--> statement-breakpoint
CREATE INDEX `wishes_created_at_idx` ON `wishes` (`created_at`);