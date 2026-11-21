import assert from "node:assert/strict";
import { test } from "node:test";
import { createRateLimiter } from "./rate-limit.ts";

test("rate limiter admits the limit and resets after its window", () => {
  let now = 1_000;
  const limiter = createRateLimiter({
    limit: 2,
    windowMs: 100,
    now: () => now,
  });

  assert.equal(limiter.take("ip"), true);
  now += 50;
  assert.equal(limiter.take("ip"), true);
  assert.equal(limiter.take("ip"), false);
  now += 50;
  assert.equal(limiter.take("ip"), true);
});

test("rate limiter tracks keys independently", () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 100, now: () => 0 });
  assert.equal(limiter.take("one"), true);
  assert.equal(limiter.take("two"), true);
  assert.equal(limiter.take("one"), false);
});
