import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";

export function createDatabase(
  path: string,
  { migrate: runMigrations = true }: { migrate?: boolean } = {},
) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });

  const client = new DatabaseSync(path);
  client.exec("PRAGMA journal_mode = WAL;");
  client.exec("PRAGMA foreign_keys = ON;");
  client.exec("PRAGMA busy_timeout = 5000;");

  const db = drizzle({ client });
  if (runMigrations) {
    const failure = migrate(db, {
      migrationsFolder: join(import.meta.dirname, "migrations"),
    });
    if (failure) {
      throw new Error(`Database migrations failed: ${failure.exitCode}`);
    }
  }

  return { client, db };
}

export type WishlistDatabase = ReturnType<typeof createDatabase>["db"];

/** True when an error (or a caused-by chain) says a table does not exist. */
export function isMissingTable(error: unknown) {
  let current: unknown = error;
  while (current instanceof Error) {
    if (current.message.includes("no such table")) return true;
    current = current.cause;
  }
  return false;
}
