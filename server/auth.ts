import { randomUUID } from "node:crypto";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { bearer, username } from "better-auth/plugins";
import type { WishlistDatabase } from "./database.ts";
import * as schema from "./schema.ts";
import { SECRET_LENGTH } from "./user-secrets.ts";

/**
 * Names are unique case-insensitively; this is the value stored in `username`.
 * Uses toLowerCase, never toLocaleLowerCase, so the result does not depend on
 * the server's locale. See docs/adr/0001 for the ASCII-only legacy backfill.
 */
export function normalizeUsername(name: string) {
  return name.trim().toLowerCase();
}

// The user secret is the account password (see ADR 0001).
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
    emailAndPassword: {
      enabled: true,
      minPasswordLength: SECRET_LENGTH,
      maxPasswordLength: 64,
      // Registering a name also starts its session, so the new owner can
      // immediately manage the wish they just posted.
      autoSignIn: true,
    },
    plugins: [
      username({
        minUsernameLength: 1,
        maxUsernameLength: 60,
        // Names are unique case-insensitively; the original casing is kept in displayUsername.
        usernameValidator: () => true,
        usernameNormalization: normalizeUsername,
        displayUsernameNormalization: (value) => value.trim(),
      }),
      bearer(),
    ],
    user: {
      modelName: "users",
    },
    session: {
      modelName: "sessions",
      expiresIn: 60 * 60 * 24 * 30,
    },
    advanced: { database: { generateId: () => randomUUID() } },
  });
}

// Used by the Better Auth CLI to generate the Drizzle schema without opening a database.
export const auth = createAuth(
  {} as WishlistDatabase,
  "schema-generation-only-not-for-runtime-000000000000",
  "https://oliveirarleo.com",
);
