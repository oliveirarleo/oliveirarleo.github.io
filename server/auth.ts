import { randomUUID } from "node:crypto";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import type { WishlistDatabase } from "./database.ts";
import * as schema from "./schema.ts";

export function createAuth(
  db: WishlistDatabase,
  secret: string,
  allowedOrigin: string,
) {
  return betterAuth({
    secret,
    baseURL: allowedOrigin,
    trustedOrigins: [allowedOrigin],
    telemetry: { enabled: false },
    logger: { disabled: true },
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    emailAndPassword: { enabled: true },
    user: {
      modelName: "users",
      additionalFields: {
        nameKey: {
          type: "string",
          required: false,
          input: false,
          returned: false,
        },
      },
    },
    session: { modelName: "sessions" },
    advanced: { database: { generateId: () => randomUUID() } },
  });
}

// Used by the Better Auth CLI to generate the Drizzle schema without opening a database.
export const auth = createAuth(
  {} as WishlistDatabase,
  "schema-generation-only-not-for-runtime-000000000000",
  "https://oliveirarleo.com",
);
