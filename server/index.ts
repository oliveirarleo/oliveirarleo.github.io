import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createDatabase } from "./database.ts";

const config = loadConfig();
const { db, client } = createDatabase(config.DATABASE_PATH);
const app = createApp(db, {
  allowedOrigin: config.ALLOWED_ORIGIN,
  turnstileSecret: config.TURNSTILE_SECRET,
});

const server = serve(
  { fetch: app.fetch, hostname: config.HOST, port: config.PORT },
  (info) => {
    console.log(`Wishlist API listening on http://${info.address}:${info.port}`);
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
