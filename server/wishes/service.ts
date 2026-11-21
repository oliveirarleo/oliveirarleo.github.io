import { randomUUID } from "node:crypto";
import { APIError } from "better-auth";
import { type createAuth, normalizeUsername } from "../auth.ts";
import { HttpError } from "../http.ts";
import { createUserSecret, normalizeUserSecret } from "../user-secrets.ts";
import { normalizeWebUrl } from "../validation.ts";
import {
  displayName,
  type PublicUser,
  WISH_LIMIT,
  WishLimitReached,
  type WishlistRepository,
} from "./repository.ts";

type Auth = ReturnType<typeof createAuth>;

interface AuthUser {
  id: string;
  name: string;
  displayUsername?: string | null;
}

type Owner =
  | { user: PublicUser; isNewUser: false }
  | {
      user: PublicUser;
      isNewUser: true;
      secret: string;
      sessionToken: string | undefined;
    };

const wrongSecret = () =>
  new HttpError({ status: 401, message: "That user secret is not valid." });

const sessionRequired = () =>
  new HttpError({ status: 401, message: "Use your secret to manage wishes." });

const nameTaken = () =>
  new HttpError({
    status: 409,
    message: "This name already exists; enter its secret.",
  });

const wishlistFull = () =>
  new HttpError({
    status: 409,
    message: `The wishlist is full (${WISH_LIMIT} links).`,
  });

// Better Auth reports a wrong name or secret with these codes. Any other error is a real failure.
function isWrongSecretError(error: unknown) {
  if (!(error instanceof APIError)) return false;
  const code = error.body?.code;
  return code === "INVALID_USERNAME_OR_PASSWORD" || code === "INVALID_PASSWORD";
}

// Only a wrong name or secret becomes 401; database and other failures stay 500.
async function mapWrongSecretTo401<A>(call: () => Promise<A>): Promise<A> {
  try {
    return await call();
  } catch (error) {
    if (isWrongSecretError(error)) throw wrongSecret();
    throw error;
  }
}

// Better Auth needs an email column value; it is never shown or used to sign in.
const placeholderEmail = () => `${randomUUID()}@wishlist.invalid`;

function publicUser(user: AuthUser): PublicUser {
  return { id: user.id, name: displayName(user) };
}

/**
 * Better Auth owns passwords (the user secret), sessions and bearer tokens.
 * See docs/adr/0001-user-secret-as-password.md.
 */
export function createWishlistService(
  repository: WishlistRepository,
  auth: Auth,
) {
  function bearer(sessionToken: string) {
    return new Headers({ authorization: `Bearer ${sessionToken}` });
  }

  async function sessionUser(sessionToken: string): Promise<PublicUser> {
    const session = await auth.api.getSession({
      headers: bearer(sessionToken),
    });
    if (!session) throw sessionRequired();
    return publicUser(session.user as AuthUser);
  }

  /**
   * With a session token the wish belongs to that session's user. Without one,
   * a new name is registered and its secret returned once. An existing name
   * must be assumed first, so it is never silently claimed.
   */
  async function resolveOwner(input: {
    author: string;
    sessionToken?: string | undefined;
  }): Promise<Owner> {
    if (input.sessionToken) {
      return { user: await sessionUser(input.sessionToken), isNewUser: false };
    }
    if (await repository.findUserByUsername(normalizeUsername(input.author))) {
      throw nameTaken();
    }
    const secret = createUserSecret();
    try {
      const signedUp = await auth.api.signUpEmail({
        body: {
          name: input.author.trim(),
          email: placeholderEmail(),
          password: secret,
          username: normalizeUsername(input.author),
          displayUsername: input.author.trim(),
        },
        returnHeaders: true,
      });
      return {
        user: publicUser(signedUp.response.user as AuthUser),
        isNewUser: true,
        secret,
        sessionToken: signedUp.headers.get("set-auth-token") ?? undefined,
      };
    } catch (error) {
      if (
        error instanceof APIError &&
        error.body?.code === "USERNAME_IS_ALREADY_TAKEN"
      ) {
        throw nameTaken();
      }
      throw error;
    }
  }

  async function addWish(
    user: PublicUser,
    input: { name: string; link: string },
  ) {
    try {
      return await repository.addWishWithinLimit(user, input);
    } catch (error) {
      if (error instanceof WishLimitReached) throw wishlistFull();
      throw error;
    }
  }

  // A brand-new name must not be left behind when its first wish fails.
  async function rollbackNewUser(userId: string) {
    await repository.deleteUser(userId).catch(() => undefined);
  }

  return {
    list: (limit: number, offset: number) =>
      repository.listWishes(limit, offset),

    async createWish(input: {
      author: string;
      name: string;
      link: string;
      sessionToken?: string | undefined;
    }) {
      const link = normalizeWebUrl(input.link);
      if (!link) {
        throw new HttpError({
          status: 400,
          message:
            "The gift link must be a valid HTTP or HTTPS URL without credentials.",
        });
      }

      const owner = await resolveOwner(input);
      try {
        const wish = await addWish(owner.user, { name: input.name, link });
        return {
          user: owner.user,
          wish,
          ...(owner.isNewUser
            ? { secret: owner.secret, sessionToken: owner.sessionToken }
            : {}),
        };
      } catch (error) {
        if (owner.isNewUser) await rollbackNewUser(owner.user.id);
        throw error;
      }
    },

    /** Signs in with name + secret and returns a bearer session token. */
    async assume(name: string, secret: string) {
      const signedIn = await mapWrongSecretTo401(() =>
        auth.api.signInUsername({
          body: {
            username: normalizeUsername(name),
            password: normalizeUserSecret(secret),
          },
          returnHeaders: true,
        }),
      );
      const token = signedIn.headers.get("set-auth-token");
      if (!token) throw wrongSecret();
      return {
        user: publicUser(signedIn.response.user as AuthUser),
        sessionToken: token,
      };
    },

    async remove(id: string, sessionToken: string) {
      const user = await sessionUser(sessionToken);
      if (!(await repository.deleteWish(id, user.id))) {
        throw new HttpError({ status: 404, message: "Wish not found." });
      }
      return { ok: true as const };
    },

    /**
     * Rotates the secret. Changing a password requires the current one, and
     * revokes every other session so an old device cannot keep posting.
     */
    async rotate({
      sessionToken,
      currentSecret,
    }: {
      sessionToken: string;
      currentSecret: string;
    }) {
      const user = await sessionUser(sessionToken);
      const nextSecret = createUserSecret();
      const changed = await mapWrongSecretTo401(() =>
        auth.api.changePassword({
          body: {
            currentPassword: normalizeUserSecret(currentSecret),
            newPassword: nextSecret,
            revokeOtherSessions: true,
          },
          headers: bearer(sessionToken),
          returnHeaders: true,
        }),
      );
      // Revoking all sessions also ends this one; issue a fresh token.
      const newToken = changed.headers.get("set-auth-token");
      if (!newToken) throw wrongSecret();
      return { user, secret: nextSecret, sessionToken: newToken };
    },
  };
}
