import { expect, it } from "vitest";
import {
  createUserSecret,
  SECRET_LENGTH,
  validUserSecret,
} from "./user-secrets.ts";

it("generated secrets are SECRET_LENGTH symbols from A-Z and 2-9", () => {
  expect(SECRET_LENGTH).toBe(6);
  for (let index = 0; index < 200; index += 1) {
    expect(createUserSecret()).toMatch(/^[A-Z2-9]{6}$/);
  }
});

it("validation requires SECRET_LENGTH symbols from A-Z and 2-9", () => {
  expect(validUserSecret(" abc234 ")).toBe(true);
  expect(validUserSecret("ABCO23")).toBe(true);
  expect(validUserSecret("ABC0O1")).toBe(false);
  expect(validUserSecret("ABC23")).toBe(false);
  expect(validUserSecret("ABC2345")).toBe(false);
  expect(validUserSecret("ABC-23")).toBe(false);
});
