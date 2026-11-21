import { expect, it } from "vitest";
import {
  ApiError,
  createWishlistApi,
  isSessionRejection,
  type Wish,
} from "./wishlist-api.ts";

const wish: Wish = {
  id: "wish-1",
  userId: "user-1",
  author: "Leo",
  name: "Book",
  link: "https://example.com",
  createdAt: "2026-11-21T00:00:00.000Z",
};

it("session rejections are told apart from other failures", () => {
  expect(isSessionRejection(new ApiError("nope", 401))).toBe(true);
  expect(isSessionRejection(new ApiError("bad", 400))).toBe(false);
  expect(isSessionRejection(new Error("network"))).toBe(false);
});

it("API failures keep the HTTP status for session handling", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json(
      { error: "Use your secret to manage wishes." },
      { status: 401 },
    );
  try {
    const api = createWishlistApi("https://api.example.com");
    await expect(api.remove(wish, "stale-token")).rejects.toSatisfy((error) => {
      expect(error instanceof ApiError).toBeTruthy();
      expect(error.status).toBe(401);
      expect(error.message).toBe("Use your secret to manage wishes.");
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
