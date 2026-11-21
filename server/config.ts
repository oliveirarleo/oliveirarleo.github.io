import { Effect, Schema, SchemaGetter } from "effect";
import { logger } from "./logger.ts";

const portSchema = Schema.NumberFromString.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 1, maximum: 65535 }),
);

export const envSchema = Schema.Struct({
  NODE_ENV: Schema.Literals(["development", "production", "test"]).pipe(
    Schema.withDecodingDefaultTypeKey(Effect.succeed("development")),
  ),
  HOST: Schema.NonEmptyString.pipe(
    Schema.withDecodingDefaultTypeKey(Effect.succeed("127.0.0.1")),
  ),
  PORT: portSchema.pipe(
    Schema.withDecodingDefaultTypeKey(Effect.succeed(8787)),
  ),
  DATABASE_PATH: Schema.NonEmptyString.pipe(
    Schema.withDecodingDefaultTypeKey(Effect.succeed("./data/wishes.db")),
  ),
  ALLOWED_ORIGIN: Schema.NonEmptyString,
  BETTER_AUTH_SECRET: Schema.String.check(Schema.isMinLength(32)),
  // Set only when the API sits behind the Cloudflare Tunnel so client IPs can be trusted.
  TRUST_PROXY: Schema.Literals(["true", "false"]).pipe(
    Schema.decodeTo(Schema.Boolean, {
      decode: SchemaGetter.transform((value) => value === "true"),
      encode: SchemaGetter.transform((value) => (value ? "true" : "false")),
    }),
    Schema.withDecodingDefaultTypeKey(Effect.succeed(false)),
  ),
  TURNSTILE_SECRET: Schema.optional(Schema.NonEmptyString),
  // Only used to upgrade accounts created before the Better Auth migration.
  WISHLIST_SECRET_PEPPER: Schema.optional(Schema.NonEmptyString),
});

type AppConfig = typeof envSchema.Type;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  let config: AppConfig;
  try {
    config = Schema.decodeUnknownSync(envSchema)(env);
  } catch (error) {
    logger.error({ err: error }, "Invalid environment configuration");
    throw new Error("Invalid environment configuration.", { cause: error });
  }

  if (config.NODE_ENV === "production" && !config.TURNSTILE_SECRET) {
    throw new Error("TURNSTILE_SECRET is required in production.");
  }

  return config;
}
