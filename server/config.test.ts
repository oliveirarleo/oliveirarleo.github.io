import { Schema } from "effect";
import { expect, it } from "vitest";
import { envSchema, loadConfig } from "./config.ts";

const required = {
  ALLOWED_ORIGIN: "https://example.com",
  BETTER_AUTH_SECRET: "local-test-auth-secret-at-least-32-characters",
};

it("environment defaults are decoded", () => {
  const config = loadConfig(required);
  expect(config.NODE_ENV).toBe("development");
  expect(config.HOST).toBe("127.0.0.1");
  expect(config.PORT).toBe(8787);
  expect(config.DATABASE_PATH).toBe("./data/wishes.db");
  expect(config.ALLOWED_ORIGIN).toBe("https://example.com");
  expect(config.TURNSTILE_SECRET).toBe(undefined);
});

it("environment values are decoded from strings", () => {
  const config = loadConfig({
    ...required,
    NODE_ENV: "production",
    HOST: "0.0.0.0",
    PORT: "9000",
    DATABASE_PATH: "/tmp/wishes.db",
    TURNSTILE_SECRET: "secret",
  });
  expect(config.NODE_ENV).toBe("production");
  expect(config.HOST).toBe("0.0.0.0");
  expect(config.PORT).toBe(9000);
  expect(config.DATABASE_PATH).toBe("/tmp/wishes.db");
  expect(config.TURNSTILE_SECRET).toBe("secret");
});

it("required configuration is validated", () => {
  expect(() =>
    Schema.decodeUnknownSync(envSchema)({ PORT: "not-a-port" }),
  ).toThrow();
  expect(() =>
    Schema.decodeUnknownSync(envSchema)({ ...required, PORT: "not-a-port" }),
  ).toThrow();
  expect(() =>
    Schema.decodeUnknownSync(envSchema)({ ...required, NODE_ENV: "staging" }),
  ).toThrow();
  expect(() =>
    loadConfig({
      BETTER_AUTH_SECRET: "local-test-auth-secret-at-least-32-characters",
    }),
  ).toThrow();
  expect(() => loadConfig({ ALLOWED_ORIGIN: "https://example.com" })).toThrow();
  expect(() => loadConfig(required)).not.toThrow();
});

it("proxy trust is opt-in", () => {
  expect(loadConfig(required).TRUST_PROXY).toBe(false);
  expect(loadConfig({ ...required, TRUST_PROXY: "true" }).TRUST_PROXY).toBe(
    true,
  );
  expect(() => loadConfig({ ...required, TRUST_PROXY: "yes" })).toThrow();
});

it("production requires a Turnstile secret", () => {
  expect(() => loadConfig({ ...required, NODE_ENV: "production" })).toThrow(
    /TURNSTILE_SECRET is required in production/,
  );
});
