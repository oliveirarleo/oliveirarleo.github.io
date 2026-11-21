import { randomUUID } from "node:crypto";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { REACTIONS, type Reaction } from "../../shared/reactions.ts";
import type { WishlistDatabase } from "../database.ts";
import { users, wishes, wishReactions } from "../schema.ts";

export const WISH_LIMIT = 100;

export interface PublicUser {
  id: string;
  name: string;
}

/** A wish as stored, before reactions are attached. */
export interface WishRecord {
  id: string;
  userId: string;
  author: string;
  name: string;
  link: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface WishReactionSummary {
  emoji: Reaction;
  userIds: string[];
}

/** A wish as the API exposes it, with one summary per emoji in use. */
export interface PublicWish extends WishRecord {
  reactions: WishReactionSummary[];
}

export class WishLimitReached extends Error {}

/** The display name, falling back to the stored name. Shared by wishes and users. */
export function displayName(user: {
  name: string;
  displayUsername?: string | null;
}) {
  return user.displayUsername ?? user.name;
}

const reactionOrder = new Map(
  REACTIONS.map(({ emoji }, index) => [emoji as string, index]),
);

/** Sorts reactions by the shared palette order, so responses are stable. */
export function byReactionOrder(
  a: { emoji: Reaction },
  b: { emoji: Reaction },
) {
  return (
    (reactionOrder.get(a.emoji) ?? Number.MAX_SAFE_INTEGER) -
    (reactionOrder.get(b.emoji) ?? Number.MAX_SAFE_INTEGER)
  );
}

function toWishRecord(row: {
  id: string;
  userId: string;
  name: string;
  link: string;
  createdAt: string;
  updatedAt: string | null;
  displayUsername: string | null;
  storedName: string;
}): WishRecord {
  const { displayUsername, storedName, ...wish } = row;
  return {
    ...wish,
    author: displayName({ name: storedName, displayUsername }),
  };
}

export function createWishlistRepository(db: WishlistDatabase) {
  const wishColumns = {
    id: wishes.id,
    userId: wishes.userId,
    name: wishes.name,
    link: wishes.link,
    createdAt: wishes.createdAt,
    updatedAt: wishes.updatedAt,
    displayUsername: users.displayUsername,
    storedName: users.name,
  };

  return {
    async listWishes(limit: number, offset: number): Promise<WishRecord[]> {
      const rows = await db
        .select(wishColumns)
        .from(wishes)
        .innerJoin(users, eq(wishes.userId, users.id))
        .orderBy(asc(wishes.createdAt), asc(wishes.id))
        .limit(limit)
        .offset(offset);
      return rows.map(toWishRecord);
    },

    async findWish(id: string): Promise<WishRecord | null> {
      const [row] = await db
        .select(wishColumns)
        .from(wishes)
        .innerJoin(users, eq(wishes.userId, users.id))
        .where(eq(wishes.id, id))
        .limit(1);
      return row ? toWishRecord(row) : null;
    },

    /** Reaction rows for a batch of wishes, so listing stays two queries, not N+1. */
    async listReactions(wishIds: string[]) {
      if (wishIds.length === 0) return [];
      const rows = await db
        .select({
          wishId: wishReactions.wishId,
          userId: wishReactions.userId,
          emoji: wishReactions.emoji,
        })
        .from(wishReactions)
        .where(inArray(wishReactions.wishId, wishIds));
      return rows.map((row) => ({ ...row, emoji: row.emoji as Reaction }));
    },

    async findUserByUsername(username: string) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);
      return user;
    },

    async deleteUser(userId: string) {
      await db.delete(users).where(eq(users.id, userId));
    },

    /**
     * Inserts a wish only while the list is under WISH_LIMIT. The count and
     * insert run in one transaction so concurrent posts cannot exceed the cap.
     */
    async addWishWithinLimit(
      user: PublicUser,
      input: { name: string; link: string },
    ): Promise<WishRecord> {
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      // node:sqlite is synchronous, so the transaction body must be too.
      db.transaction((tx) => {
        const total =
          tx.select({ total: count() }).from(wishes).get()?.total ?? 0;
        if (total >= WISH_LIMIT) throw new WishLimitReached();
        tx.insert(wishes)
          .values({ id, userId: user.id, ...input, createdAt })
          .run();
      });
      return {
        id,
        userId: user.id,
        author: user.name,
        ...input,
        createdAt,
        updatedAt: null,
      };
    },

    /**
     * Updates only the owner's wish, so authorization is one predicate instead
     * of a fetch-compare-write dance in the service.
     */
    async updateWish(
      id: string,
      userId: string,
      input: { name: string; link: string },
    ) {
      const updated = await db
        .update(wishes)
        .set({ ...input, updatedAt: new Date().toISOString() })
        .where(and(eq(wishes.id, id), eq(wishes.userId, userId)))
        .returning({ id: wishes.id });
      return updated.length > 0;
    },

    /** One reaction per user per wish: changing emoji replaces the old one. */
    async setReaction(wishId: string, userId: string, emoji: Reaction) {
      const createdAt = new Date().toISOString();
      await db
        .insert(wishReactions)
        .values({ wishId, userId, emoji, createdAt })
        .onConflictDoUpdate({
          target: [wishReactions.wishId, wishReactions.userId],
          set: { emoji, createdAt },
        });
    },

    async clearReaction(wishId: string, userId: string) {
      await db
        .delete(wishReactions)
        .where(
          and(
            eq(wishReactions.wishId, wishId),
            eq(wishReactions.userId, userId),
          ),
        );
    },

    async deleteWish(id: string, userId: string) {
      const deleted = await db
        .delete(wishes)
        .where(sql`${wishes.id} = ${id} and ${wishes.userId} = ${userId}`)
        .returning({ id: wishes.id });
      return deleted.length > 0;
    },
  };
}

export type WishlistRepository = ReturnType<typeof createWishlistRepository>;
