import { randomBytes, randomUUID } from "node:crypto";
import type { createAuth } from "../auth.ts";
import { HttpError } from "../http.ts";
import {
  createUserSecret,
  hashUserSecret,
  secretLookup,
  verifyUserSecret,
} from "../user-secrets.ts";
import { normalizeWebUrl } from "../validation.ts";
import type { PublicUser, WishlistRepository } from "./repository.ts";

type Auth = ReturnType<typeof createAuth>;

export function nameKey(name: string) {
  return name.trim().toLocaleLowerCase();
}

export function createWishlistService(
  repository: WishlistRepository,
  auth: Auth,
  pepper: string,
) {
  async function publicUser(id: string): Promise<PublicUser> {
    const user = await repository.findUserById(id);
    if (!user)
      throw new HttpError({
        status: 401,
        message: "That user secret is not valid.",
      });
    return { id: user.id, name: user.name };
  }

  async function authenticate(secret: string) {
    const credentials = await repository.findSecretByLookup(
      secretLookup(secret, pepper),
    );
    if (
      !credentials ||
      !(await verifyUserSecret(
        secret,
        credentials.secretSalt,
        credentials.secretHash,
      ))
    ) {
      throw new HttpError({
        status: 401,
        message: "That user secret is not valid.",
      });
    }
    return {
      user: await publicUser(credentials.userId),
      credentialId: credentials.id,
    };
  }

  async function issueSecret(userId: string) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const secret = createUserSecret();
      const credentials = await hashUserSecret(secret);
      try {
        await repository.createSecret({
          userId,
          ...credentials,
          lookup: secretLookup(secret, pepper),
        });
        return secret;
      } catch {
        // A unique lookup collision is retried with a fresh secret.
      }
    }
    throw new HttpError({
      status: 500,
      message: "Could not create a unique user secret.",
    });
  }

  return {
    list: (limit: number, offset: number) =>
      repository.listWishes(limit, offset),

    async createWish(input: {
      author: string;
      name: string;
      link: string;
      secret?: string | undefined;
    }) {
      const link = normalizeWebUrl(input.link);
      if (!link) {
        throw new HttpError({
          status: 400,
          message:
            "The gift link must be a valid HTTP or HTTPS URL without credentials.",
        });
      }
      const key = nameKey(input.author);
      const existing = await repository.findUserByName(key);

      if (existing) {
        if (!input.secret) {
          throw new HttpError({
            status: 409,
            message: "This name already exists; enter its secret.",
          });
        }
        const assumed = await authenticate(input.secret);
        if (assumed.user.id !== existing.id) {
          throw new HttpError({
            status: 401,
            message: "That user secret is not valid.",
          });
        }
        return {
          user: assumed.user,
          wish: await repository.addWish(assumed.user, {
            name: input.name,
            link,
          }),
        };
      }

      const registered = await auth.api.signUpEmail({
        body: {
          name: input.author.trim(),
          email: `${randomUUID()}@wishlist.invalid`,
          password: randomBytes(32).toString("base64url"),
        },
      });
      try {
        await repository.setNameKey(registered.user.id, key);
        const secret = await issueSecret(registered.user.id);
        const user = { id: registered.user.id, name: registered.user.name };
        const wish = await repository.addWish(user, { name: input.name, link });
        return { user, secret, wish };
      } catch (error) {
        // Do not strand a name when any step after Better Auth signup fails.
        await repository.deleteUser(registered.user.id).catch(() => undefined);
        throw error;
      }
    },

    async assume(secret: string) {
      return { user: (await authenticate(secret)).user };
    },

    async remove(id: string, secret: string) {
      const { user } = await authenticate(secret);
      if (!(await repository.deleteWish(id, user.id))) {
        throw new HttpError({ status: 404, message: "Wish not found." });
      }
      return { ok: true as const };
    },

    async rotate(secret: string) {
      const { user, credentialId } = await authenticate(secret);
      const nextSecret = await issueSecret(user.id);
      await repository.deleteSecret(credentialId);
      return { user, secret: nextSecret };
    },
  };
}
