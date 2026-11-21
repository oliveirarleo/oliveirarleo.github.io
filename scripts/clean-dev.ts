/**
 * Clears all wishlist data from the local development database.
 *
 * Removes wishes and authors (sessions and password accounts cascade), and
 * leaves the schema in place so `just seed` can repopulate it. Refuses to run
 * in production.
 */
import { loadConfig } from "../server/config.ts";
import { createDatabase } from "../server/database.ts";

const config = loadConfig(process.env);
if (config.NODE_ENV === "production") {
  throw new Error("Refusing to clear the wishlist database in production.");
}

const { client } = createDatabase(config.DATABASE_PATH);

try {
  const count = (table: "wishes" | "users") =>
    (
      client.prepare(`select count(*) as total from ${table}`).get() as {
        total: number;
      }
    ).total;

  const wishesBefore = count("wishes");
  const usersBefore = count("users");

  // Deleting authors cascades to wishes, sessions and password accounts.
  client.exec("delete from wishes");
  client.exec("delete from users");

  console.log(`Database: ${config.DATABASE_PATH}`);
  console.log(
    `Removed ${wishesBefore} wishes and ${usersBefore} authors. Run \`just seed\` to repopulate.`,
  );
} finally {
  client.close();
}
