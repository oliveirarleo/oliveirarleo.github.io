import assert from "node:assert/strict";
import { test } from "node:test";
import { Schema } from "effect";
import { envSchema, loadConfig } from "./config.ts";

test("environment defaults are decoded", () => {
  const config = loadConfig({});
  assert.equal(config.NODE_ENV, "development");
  assert.equal(config.HOST, "127.0.0.1");
  assert.equal(config.PORT, 8787);
  assert.equal(config.DATABASE_PATH, "./data/wishes.db");
  assert.equal(config.ALLOWED_ORIGIN, "https://wishlist.oliveirarleo.com");
  assert.equal(config.TURNSTILE_SECRET, undefined);
});

test("environment values are decoded from strings", () => {
  const config = loadConfig({
    NODE_ENV: "production",
    HOST: "0.0.0.0",
    PORT: "9000",
    DATABASE_PATH: "/tmp/wishes.db",
    ALLOWED_ORIGIN: "https://example.com",
    TURNSTILE_SECRET: "secret",
  });
  assert.equal(config.NODE_ENV, "production");
  assert.equal(config.HOST, "0.0.0.0");
  assert.equal(config.PORT, 9000);
  assert.equal(config.DATABASE_PATH, "/tmp/wishes.db");
  assert.equal(config.ALLOWED_ORIGIN, "https://example.com");
  assert.equal(config.TURNSTILE_SECRET, "secret");
});

test("invalid environment values are rejected", () => {
  assert.throws(() => Schema.decodeUnknownSync(envSchema)({ PORT: "not-a-port" }));
  assert.throws(() => Schema.decodeUnknownSync(envSchema)({ NODE_ENV: "staging" }));
});

test("production requires a Turnstile secret", () => {
  assert.throws(
    () => loadConfig({ NODE_ENV: "production" }),
    /TURNSTILE_SECRET is required in production/,
  );
});
