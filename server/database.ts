import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";

export function createDatabase(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });

  const client = new DatabaseSync(path);
  client.exec("PRAGMA journal_mode = WAL;");
  client.exec("PRAGMA foreign_keys = ON;");
  client.exec("PRAGMA busy_timeout = 5000;");

  const db = drizzle({ client });
  const failure = migrate(db, {
    migrationsFolder: join(import.meta.dirname, "migrations"),
  });
  if (failure) {
    throw new Error(`Database migrations failed: ${failure.exitCode}`);
  }

  return { client, db };
}

export type WishlistDatabase = ReturnType<typeof createDatabase>["db"];
