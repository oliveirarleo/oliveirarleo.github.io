import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeWebUrl } from "./validation.ts";

test("normalizes safe HTTP links", () => {
  assert.equal(
    normalizeWebUrl("  HTTPS://Example.COM:443/a/../b?x=1#top  "),
    "https://example.com/b?x=1#top",
  );
});

test("rejects non-web links and credentials", () => {
  assert.equal(normalizeWebUrl("javascript:alert(1)"), null);
  assert.equal(normalizeWebUrl("https://user:pass@example.com"), null);
  assert.equal(normalizeWebUrl("not a URL"), null);
});
