import { expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit.ts";

it("rate limiter admits the limit and resets after its window", () => {
  let now = 1_000;
  const limiter = createRateLimiter({
    limit: 2,
    windowMs: 100,
    now: () => now,
  });

  expect(limiter.take("ip")).toBe(true);
  now += 50;
  expect(limiter.take("ip")).toBe(true);
  expect(limiter.take("ip")).toBe(false);
  now += 50;
  expect(limiter.take("ip")).toBe(true);
});

it("rate limiter tracks keys independently", () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 100, now: () => 0 });
  expect(limiter.take("one")).toBe(true);
  expect(limiter.take("two")).toBe(true);
  expect(limiter.take("one")).toBe(false);
});
