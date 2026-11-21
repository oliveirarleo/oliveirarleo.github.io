import { expect, it } from "vitest";
import {
  ApiError,
  createWishlistApi,
  isSessionRejection,
} from "./wishlist-api.ts";

it("session rejections are told apart by code, not status", () => {
  expect(isSessionRejection(new ApiError("nope", 401, "session_expired"))).toBe(
    true,
  );
  expect(isSessionRejection(new ApiError("nope", 401, "wrong_secret"))).toBe(
    false,
  );
  expect(isSessionRejection(new ApiError("bad", 400, "invalid_request"))).toBe(
    false,
  );
  expect(isSessionRejection(new Error("network"))).toBe(false);
});

it("API failures keep the code, status and message", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json(
      {
        error: {
          code: "session_expired",
          message: "Use your secret to manage wishes.",
        },
      },
      { status: 401 },
    );
  try {
    const api = createWishlistApi("https://api.example.com");
    await expect(api.remove("wish-1", "stale-token")).rejects.toSatisfy(
      (error) => {
        expect(error instanceof ApiError).toBeTruthy();
        expect(error.status).toBe(401);
        expect(error.code).toBe("session_expired");
        expect(error.message).toBe("Use your secret to manage wishes.");
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it("reactions use idempotent PUT and DELETE on one reaction resource", async () => {
  const originalFetch = globalThis.fetch;
  const calls: { method: string; url: string; body: string | null }[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({
      method: init?.method ?? "GET",
      url: String(input),
      body: typeof init?.body === "string" ? init.body : null,
    });
    return Response.json({ wish: { id: "wish-1" } });
  };
  try {
    const api = createWishlistApi("https://api.example.com/");
    await api.setReaction("wish-1", "❤️", "token");
    await api.clearReaction("wish-1", "token");
    expect(calls).toEqual([
      {
        method: "PUT",
        url: "https://api.example.com/api/wishes/wish-1/reaction",
        body: JSON.stringify({ emoji: "❤️" }),
      },
      {
        method: "DELETE",
        url: "https://api.example.com/api/wishes/wish-1/reaction",
        body: null,
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
