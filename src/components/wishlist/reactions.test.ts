import { describe, expect, it } from "vitest";
import type { Wish } from "../../lib/wishlist-api";
import { applyReaction, reactionSummary } from "./reactions";

function wish(overrides: Partial<Wish> = {}): Wish {
  return {
    id: "wish-1",
    userId: "owner",
    author: "Alice",
    name: "Book",
    link: "https://example.com",
    createdAt: "2026-11-21T10:00:00.000Z",
    updatedAt: null,
    reactions: [],
    ...overrides,
  };
}

describe("reactionSummary", () => {
  it("returns the whole palette, with counts and the active user's own", () => {
    const summary = reactionSummary(
      wish({
        reactions: [
          { emoji: "❤️", userIds: ["owner", "friend"] },
          { emoji: "🧦", userIds: ["friend"] },
        ],
      }),
      "owner",
    );

    expect(summary.find(({ emoji }) => emoji === "❤️")).toEqual({
      emoji: "❤️",
      count: 2,
      mine: true,
    });
    expect(summary.find(({ emoji }) => emoji === "🧦")).toEqual({
      emoji: "🧦",
      count: 1,
      mine: false,
    });
    expect(summary.find(({ emoji }) => emoji === "🎁")).toEqual({
      emoji: "🎁",
      count: 0,
      mine: false,
    });
  });
});

describe("applyReaction", () => {
  it("adds a reaction without touching other wishes", () => {
    const other = wish({ id: "wish-2" });
    const [updated, untouched] = applyReaction(
      [wish(), other],
      "wish-1",
      "friend",
      "❤️",
    );

    expect(updated?.reactions).toEqual([{ emoji: "❤️", userIds: ["friend"] }]);
    expect(untouched).toBe(other);
  });

  it("replaces the user's previous emoji, keeping one per user", () => {
    const [updated] = applyReaction(
      [wish({ reactions: [{ emoji: "❤️", userIds: ["friend"] }] })],
      "wish-1",
      "friend",
      "🧦",
    );

    expect(updated?.reactions).toEqual([{ emoji: "🧦", userIds: ["friend"] }]);
  });

  it("clears the reaction and drops an empty emoji", () => {
    const [updated] = applyReaction(
      [wish({ reactions: [{ emoji: "🎁", userIds: ["friend"] }] })],
      "wish-1",
      "friend",
      null,
    );

    expect(updated?.reactions).toEqual([]);
  });
});
