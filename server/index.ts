import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createDatabase } from "./database.ts";
import { logger } from "./logger.ts";

const config = loadConfig();
const { db, client } = createDatabase(config.DATABASE_PATH);
const app = createApp(db, {
  allowedOrigin: config.ALLOWED_ORIGIN,
  authSecret: config.BETTER_AUTH_SECRET,
  secretPepper: config.WISHLIST_SECRET_PEPPER,
  nodeEnv: config.NODE_ENV,
  turnstileSecret: config.TURNSTILE_SECRET,
});

const server = serve(
  { fetch: app.fetch, hostname: config.HOST, port: config.PORT },
  (info) => {
    logger.info(
      { address: info.address, port: info.port },
      "Wishlist API listening",
    );
  },
);

function shutdown() {
  server.close(() => {
    client.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
