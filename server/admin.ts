import { hashPassword, verifyPassword } from "better-auth/crypto";
import { and, eq, sql } from "drizzle-orm";
import { normalizeUsername } from "./auth.ts";
import { isMissingTable, type WishlistDatabase } from "./database.ts";
import { account, sessions, users } from "./schema.ts";
import {
  createUserSecret,
  normalizeUserSecret,
  validUserSecret,
} from "./user-secrets.ts";

export class ResetCodeError extends Error {}

export interface ResetCodeResult {
  user: { id: string; name: string };
  /** The new secret, returned once so an administrator can hand it over. */
  code: string;
  sessionsRevoked: number;
  legacyRowsRemoved: number;
}

/**
 * Replaces a user's six-character code (the Better Auth password), revokes
 * their sessions, and removes any pre-migration secret row. This is the
 * administrator recovery path from ADR 0001: no self-service reset exists
 * because the placeholder emails are not real.
 *
 * Runs in one transaction, so a failure leaves the account untouched.
 */
export async function resetUserCode(
  db: WishlistDatabase,
  username: string,
  code: string = createUserSecret(),
): Promise<ResetCodeResult> {
  if (!validUserSecret(code)) {
    throw new ResetCodeError(
      "The new code must be six characters from A–Z and 2–9.",
    );
  }
  const normalized = normalizeUserSecret(code);
  const [user] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.username, normalizeUsername(username)))
    .limit(1);
  if (!user) throw new ResetCodeError(`No user named "${username}".`);

  const passwordHash = await hashPassword(normalized);
  if (!(await verifyPassword({ hash: passwordHash, password: normalized }))) {
    throw new ResetCodeError("The generated password hash does not verify.");
  }

  let sessionsRevoked = 0;
  let legacyRowsRemoved = 0;
  db.transaction((tx) => {
    const updated = tx
      .update(account)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(
        and(eq(account.userId, user.id), eq(account.providerId, "credential")),
      )
      .returning({ id: account.id })
      .all();
    if (updated.length !== 1) {
      throw new ResetCodeError(
        `Expected one credential row for "${username}", found ${updated.length}.`,
      );
    }

    sessionsRevoked = tx
      .delete(sessions)
      .where(eq(sessions.userId, user.id))
      .returning({ id: sessions.id })
      .all().length;

    try {
      const removed = tx.run(
        sql`delete from legacy_wishlist_secrets where user_id = ${user.id}`,
      );
      legacyRowsRemoved = Number(removed.changes ?? 0);
    } catch (error) {
      // Fresh databases never had the pre-migration table.
      if (!isMissingTable(error)) throw error;
    }
  });

  return { user, code: normalized, sessionsRevoked, legacyRowsRemoved };
}
