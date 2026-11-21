import { REACTIONS, type Reaction } from "../../../shared/reactions";
import type { Wish } from "../../lib/wishlist-api";

export interface ReactionSummary {
  emoji: Reaction;
  count: number;
  mine: boolean;
}

/**
 * Projects a wish's reaction rows into the palette, for rendering. `mine` is
 * derived from the active user, so the list stays anonymous and cache-free.
 */
export function reactionSummary(
  wish: Wish,
  userId: string | undefined,
): ReactionSummary[] {
  const byEmoji = new Map<Reaction, string[]>();
  for (const reaction of wish.reactions) {
    byEmoji.set(reaction.emoji, reaction.userIds);
  }
  return REACTIONS.map(({ emoji }) => {
    const userIds = byEmoji.get(emoji) ?? [];
    return {
      emoji,
      count: userIds.length,
      mine: userId !== undefined && userIds.includes(userId),
    };
  });
}

/**
 * Optimistic reaction update. Removes the user's previous reaction (whatever
 * emoji it was), then optionally adds the new one. Keeps palette order and
 * drops empty emoji entries, matching what the server returns.
 */
export function applyReaction(
  wishes: Wish[],
  wishId: string,
  userId: string,
  emoji: Reaction | null,
): Wish[] {
  return wishes.map((wish) => {
    if (wish.id !== wishId) return wish;
    const byEmoji = new Map<Reaction, string[]>();
    for (const reaction of wish.reactions) {
      const userIds = reaction.userIds.filter((id) => id !== userId);
      if (userIds.length > 0) byEmoji.set(reaction.emoji, userIds);
    }
    if (emoji) byEmoji.set(emoji, [...(byEmoji.get(emoji) ?? []), userId]);
    const reactions = REACTIONS.flatMap(({ emoji: candidate }) => {
      const userIds = byEmoji.get(candidate);
      return userIds ? [{ emoji: candidate, userIds }] : [];
    });
    return { ...wish, reactions };
  });
}

/** Replaces one wish with the server's authoritative version. */
export function replaceWish(wishes: Wish[], wish: Wish): Wish[] {
  return wishes.map((candidate) =>
    candidate.id === wish.id ? wish : candidate,
  );
}
