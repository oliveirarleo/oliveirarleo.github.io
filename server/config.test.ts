import assert from "node:assert/strict";
import { test } from "node:test";
import { Schema } from "effect";
import { envSchema, loadConfig } from "./config.ts";

const required = {
  ALLOWED_ORIGIN: "https://example.com",
  BETTER_AUTH_SECRET: "local-test-auth-secret-at-least-32-characters",
  WISHLIST_SECRET_PEPPER: "local-test-secret-pepper",
};

test("environment defaults are decoded", () => {
  const config = loadConfig(required);
  assert.equal(config.NODE_ENV, "development");
  assert.equal(config.HOST, "127.0.0.1");
  assert.equal(config.PORT, 8787);
  assert.equal(config.DATABASE_PATH, "./data/wishes.db");
  assert.equal(config.ALLOWED_ORIGIN, "https://example.com");
  assert.equal(config.TURNSTILE_SECRET, undefined);
});

test("environment values are decoded from strings", () => {
  const config = loadConfig({
    ...required,
    NODE_ENV: "production",
    HOST: "0.0.0.0",
    PORT: "9000",
    DATABASE_PATH: "/tmp/wishes.db",
    TURNSTILE_SECRET: "secret",
  });
  assert.equal(config.NODE_ENV, "production");
  assert.equal(config.HOST, "0.0.0.0");
  assert.equal(config.PORT, 9000);
  assert.equal(config.DATABASE_PATH, "/tmp/wishes.db");
  assert.equal(config.TURNSTILE_SECRET, "secret");
});

test("required configuration is validated", () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(envSchema)({ PORT: "not-a-port" }),
  );
  assert.throws(() =>
    Schema.decodeUnknownSync(envSchema)({ ...required, PORT: "not-a-port" }),
  );
  assert.throws(() =>
    Schema.decodeUnknownSync(envSchema)({ ...required, NODE_ENV: "staging" }),
  );
  assert.throws(() =>
    loadConfig({
      BETTER_AUTH_SECRET: "local-test-auth-secret-at-least-32-characters",
      WISHLIST_SECRET_PEPPER: "local-test-secret-pepper",
    }),
  );
  assert.throws(() => loadConfig({ ALLOWED_ORIGIN: "https://example.com" }));
  assert.throws(() =>
    loadConfig({
      ALLOWED_ORIGIN: "https://example.com",
      BETTER_AUTH_SECRET: "local-test-auth-secret-at-least-32-characters",
    }),
  );
});

test("production requires a Turnstile secret", () => {
  assert.throws(
    () => loadConfig({ ...required, NODE_ENV: "production" }),
    /TURNSTILE_SECRET is required in production/,
  );
});
