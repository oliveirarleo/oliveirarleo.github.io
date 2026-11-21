import { cleanup, renderHook, waitFor } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoredUser } from "../../lib/user-secrets";
import type { Wish, WishlistApi } from "../../lib/wishlist-api";
import type { UseWishesDeps } from "./useWishes";
import { useWishes } from "./useWishes";

const user: StoredUser = {
  id: "user-1",
  name: "Leo",
  secret: "ABC234",
  sessionToken: "token",
};

function wish(overrides: Partial<Wish> = {}): Wish {
  return {
    id: "wish-1",
    userId: user.id,
    author: user.name,
    name: "Book",
    link: "https://example.com",
    createdAt: "2026-11-21T10:00:00.000Z",
    updatedAt: null,
    reactions: [],
    ...overrides,
  };
}

function depsWith(api: Partial<WishlistApi>): UseWishesDeps {
  return {
    api: {
      list: async () => ({ wishes: [wish()] }),
      setReaction: async () => ({ wish: wish() }),
      clearReaction: async () => ({ wish: wish() }),
      ...api,
    } as WishlistApi,
    activeUser: () => user,
    sessionTokenFor: () => "token",
    remember: vi.fn(),
    fail: vi.fn(),
    report: vi.fn(),
  };
}

afterEach(cleanup);

describe("useWishes reactions", () => {
  it("updates optimistically and replaces with the server's wish", async () => {
    const serverWish = wish({
      reactions: [{ emoji: "❤️", userIds: [user.id] }],
    });
    const setReaction = vi.fn(async () => ({ wish: serverWish }));
    const deps = depsWith({ setReaction });
    const { result } = renderHook(() => useWishes(deps));
    await waitFor(() => expect(result.wishes().length).toBe(1));

    const pending = result.react(wish(), "❤️");
    expect(result.wishes()[0]?.reactions).toEqual([
      { emoji: "❤️", userIds: [user.id] },
    ]);

    await expect(pending).resolves.toBe(true);
    expect(setReaction).toHaveBeenCalledWith("wish-1", "❤️", "token");
    expect(result.wishes()[0]?.reactions).toEqual(serverWish.reactions);
  });

  it("rolls the optimistic change back when the call fails", async () => {
    const deps = depsWith({
      setReaction: async () => {
        throw new Error("offline");
      },
    });
    const { result } = renderHook(() => useWishes(deps));
    await waitFor(() => expect(result.wishes().length).toBe(1));

    const pending = result.react(wish(), "❤️");
    expect(result.wishes()[0]?.reactions?.[0]?.emoji).toBe("❤️");

    await expect(pending).resolves.toBe(false);
    expect(result.wishes()[0]?.reactions).toEqual([]);
    expect(deps.fail).toHaveBeenCalledWith(
      user,
      expect.any(Error),
      "Could not save your reaction.",
    );
  });

  it("clears the reaction when the same emoji is pressed again", async () => {
    const current = wish({
      reactions: [{ emoji: "❤️", userIds: [user.id] }],
    });
    const clearReaction = vi.fn(async () => ({ wish: wish() }));
    const deps = depsWith({
      list: async () => ({ wishes: [current] }),
      clearReaction,
    });
    const { result } = renderHook(() => useWishes(deps));
    await waitFor(() => expect(result.wishes().length).toBe(1));

    await expect(result.react(current, "❤️")).resolves.toBe(true);
    expect(clearReaction).toHaveBeenCalledWith("wish-1", "token");
    expect(result.wishes()[0]?.reactions).toEqual([]);
  });
});
