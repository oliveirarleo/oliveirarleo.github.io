import { randomUUID } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import type { WishlistDatabase } from "../database.ts";
import { users, wishes, wishlistSecrets } from "../schema.ts";

export interface PublicUser {
  id: string;
  name: string;
}

export interface PublicWish {
  id: string;
  userId: string;
  author: string;
  name: string;
  link: string;
  createdAt: string;
}

export function createWishlistRepository(db: WishlistDatabase) {
  const publicWish = {
    id: wishes.id,
    userId: wishes.userId,
    author: users.name,
    name: wishes.name,
    link: wishes.link,
    createdAt: wishes.createdAt,
  };

  return {
    async listWishes(limit: number, offset: number): Promise<PublicWish[]> {
      return db
        .select(publicWish)
        .from(wishes)
        .innerJoin(users, eq(wishes.userId, users.id))
        .orderBy(asc(wishes.createdAt))
        .limit(limit)
        .offset(offset);
    },

    async findUserByName(nameKey: string) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.nameKey, nameKey))
        .limit(1);
      return user;
    },

    async findUserById(id: string) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return user;
    },

    async setNameKey(userId: string, nameKey: string) {
      await db.update(users).set({ nameKey }).where(eq(users.id, userId));
    },

    async deleteUser(userId: string) {
      await db.delete(users).where(eq(users.id, userId));
    },

    async createSecret(credentials: {
      userId: string;
      lookup: string;
      hash: string;
      salt: string;
    }) {
      const id = randomUUID();
      await db.insert(wishlistSecrets).values({
        id,
        userId: credentials.userId,
        secretLookup: credentials.lookup,
        secretHash: credentials.hash,
        secretSalt: credentials.salt,
        createdAt: new Date().toISOString(),
      });
      return id;
    },

    async findSecretByLookup(lookup: string) {
      const [secret] = await db
        .select()
        .from(wishlistSecrets)
        .where(eq(wishlistSecrets.secretLookup, lookup))
        .limit(1);
      return secret;
    },

    async deleteSecret(id: string) {
      await db.delete(wishlistSecrets).where(eq(wishlistSecrets.id, id));
    },

    async addWish(
      user: PublicUser,
      input: { name: string; link: string },
    ): Promise<PublicWish> {
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      await db
        .insert(wishes)
        .values({ id, userId: user.id, ...input, createdAt });
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
