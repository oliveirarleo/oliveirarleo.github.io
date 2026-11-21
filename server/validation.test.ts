import { expect, it } from "vitest";
import { normalizeWebUrl } from "./validation.ts";

it("normalizes safe HTTP links", () => {
  expect(normalizeWebUrl("  HTTPS://Example.COM:443/a/../b?x=1#top  ")).toBe(
    "https://example.com/b?x=1#top",
  );
});

it("rejects non-web links and credentials", () => {
  expect(normalizeWebUrl("javascript:alert(1)")).toBe(null);
  expect(normalizeWebUrl("https://user:pass@example.com")).toBe(null);
  expect(normalizeWebUrl("not a URL")).toBe(null);
});
