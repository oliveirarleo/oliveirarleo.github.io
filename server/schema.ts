import { sql } from "drizzle-orm";
import { check, index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const wishes = sqliteTable(
  "wishes",
  {
    id: text("id").primaryKey(),
    author: text("author").notNull(),
    name: text("name").notNull(),
    link: text("link").notNull(),
    createdAt: text("created_at").notNull(),
    deleteTokenHash: text("delete_token_hash"),
  },
  (table) => [
    index("wishes_created_at_idx").on(table.createdAt),
    check("wishes_author_length", sql`length(${table.author}) between 1 and 60`),
    check("wishes_name_length", sql`length(${table.name}) between 1 and 120`),
    check("wishes_link_length", sql`length(${table.link}) between 1 and 2000`),
  ],
);
