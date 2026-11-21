import { randomUUID } from "node:crypto";
import { asc, count, eq, sql } from "drizzle-orm";
import type { WishlistDatabase } from "../database.ts";
import { users, wishes } from "../schema.ts";

export const WISH_LIMIT = 100;

export interface PublicUser {
  id: string;
  name: string;
}

interface PublicWish {
  id: string;
  userId: string;
  author: string;
  name: string;
  link: string;
  createdAt: string;
}

export class WishLimitReached extends Error {}

/** The display name, falling back to the stored name. Shared by wishes and users. */
export function displayName(user: {
  name: string;
  displayUsername?: string | null;
}) {
  return user.displayUsername ?? user.name;
}

export function createWishlistRepository(db: WishlistDatabase) {
  const publicWish = {
    id: wishes.id,
    userId: wishes.userId,
    name: wishes.name,
    link: wishes.link,
    createdAt: wishes.createdAt,
    displayUsername: users.displayUsername,
    storedName: users.name,
  };

  return {
    async listWishes(limit: number, offset: number): Promise<PublicWish[]> {
      const rows = await db
        .select(publicWish)
        .from(wishes)
        .innerJoin(users, eq(wishes.userId, users.id))
        .orderBy(asc(wishes.createdAt), asc(wishes.id))
        .limit(limit)
        .offset(offset);
      return rows.map(({ displayUsername, storedName, ...wish }) => ({
        ...wish,
        author: displayName({ name: storedName, displayUsername }),
      }));
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
    ): Promise<PublicWish> {
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
      return { id, userId: user.id, author: user.name, ...input, createdAt };
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
