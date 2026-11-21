import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import { ResetCodeError, resetUserCode } from "./admin.ts";
import { createAuth } from "./auth.ts";
import { createDatabase } from "./database.ts";
import { account, sessions } from "./schema.ts";

const authOptions = {
  authSecret: "test-only-auth-secret-at-least-32-characters",
  origin: "https://wishlist.example.com",
};

async function fixture() {
  const { db, client } = createDatabase(":memory:");
  const auth = createAuth(db, authOptions.authSecret, authOptions.origin);
  const signedUp = await auth.api.signUpEmail({
    body: {
      name: "Leonardo",
      email: `${randomUUID()}@wishlist.invalid`,
      password: "OLD234",
      username: "leonardo",
      displayUsername: "Leonardo",
    },
    returnHeaders: true,
  });
  const userId = signedUp.response.user.id;

  async function addLegacyRow() {
    db.run(sql`
      insert into legacy_wishlist_secrets
        (id, user_id, secret_lookup, secret_hash, secret_salt, created_at)
      values (${randomUUID()}, ${userId}, ${randomUUID()}, 'ab', 'cd', ${new Date().toISOString()})
    `);
  }

  async function countSessions() {
    const rows = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.userId, userId));
    return rows.length;
  }

  return { db, client, auth, userId, addLegacyRow, countSessions };
}

it("resets the code, revokes sessions, and removes the legacy row", async () => {
  const { db, client, auth, userId, addLegacyRow, countSessions } =
    await fixture();
  await addLegacyRow();
  const sessionsBefore = await countSessions();
  expect(sessionsBefore).toBeGreaterThan(0);

  const result = await resetUserCode(db, "  Leonardo ", "abc234");

  expect(result.user.id).toBe(userId);
  expect(result.code).toBe("ABC234");
  expect(result.sessionsRevoked).toBe(sessionsBefore);
  expect(result.legacyRowsRemoved).toBe(1);
  expect(await countSessions()).toBe(0);

  const legacy = db.get(
    sql`select 1 from legacy_wishlist_secrets where user_id = ${userId}`,
  );
  expect(legacy).toBeUndefined();

  // The new code signs in; the old one does not.
  const signedIn = await auth.api.signInUsername({
    body: { username: "leonardo", password: "ABC234" },
  });
  expect(signedIn.user.id).toBe(userId);
  await expect(
    auth.api.signInUsername({
      body: { username: "leonardo", password: "OLD234" },
    }),
  ).rejects.toThrow();
  client.close();
});

it("generates a code when none is supplied", async () => {
  const { db, client, auth } = await fixture();
  const result = await resetUserCode(db, "leonardo");
  expect(result.code).toMatch(/^[A-Z2-9]{6}$/);
  const signedIn = await auth.api.signInUsername({
    body: { username: "leonardo", password: result.code },
  });
  expect(signedIn.user.username).toBe("leonardo");
  client.close();
});

it("rejects an unknown name and an invalid code without changing anything", async () => {
  const { db, client, auth } = await fixture();

  await expect(resetUserCode(db, "nobody")).rejects.toBeInstanceOf(
    ResetCodeError,
  );
  await expect(resetUserCode(db, "leonardo", "nope")).rejects.toBeInstanceOf(
    ResetCodeError,
  );

  // The original password still works, so nothing was written.
  const signedIn = await auth.api.signInUsername({
    body: { username: "leonardo", password: "OLD234" },
  });
  expect(signedIn.user.username).toBe("leonardo");

  const [row] = await db
    .select({ password: account.password })
    .from(account)
    .where(eq(account.userId, signedIn.user.id));
  expect(row?.password).not.toBeNull();
  client.close();
});

it("works on a database that never had the legacy table", async () => {
  const { db, client, auth } = await fixture();
  db.run(sql`drop table legacy_wishlist_secrets`);

  const result = await resetUserCode(db, "leonardo", "XYZ789");
  expect(result.legacyRowsRemoved).toBe(0);
  const signedIn = await auth.api.signInUsername({
    body: { username: "leonardo", password: "XYZ789" },
  });
  expect(signedIn.user.username).toBe("leonardo");
  client.close();
});
