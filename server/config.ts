import { Effect, Schema } from "effect";
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
  WISHLIST_SECRET_PEPPER: Schema.NonEmptyString,
  TURNSTILE_SECRET: Schema.optional(Schema.NonEmptyString),
});

export type AppConfig = typeof envSchema.Type;

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
