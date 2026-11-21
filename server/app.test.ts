import { createHmac, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import type { AppOptions } from "./app.ts";
import { createApp } from "./app.ts";
import { createDatabase } from "./database.ts";
import { WISH_LIMIT } from "./wishes/repository.ts";

const scrypt = promisify(scryptCallback);
const LEGACY_PEPPER = "test-only-legacy-pepper";

function testApp(rateLimit = 20, options: Partial<AppOptions> = {}) {
  const { db, client } = createDatabase(":memory:");
  const app = createApp(db, {
    allowedOrigin: "https://wishlist.example.com",
    rateLimit,
    authSecret: "test-only-auth-secret-at-least-32-characters",
    ...options,
  });
  return Object.assign(app, { close: () => client.close(), client });
}

type TestApp = ReturnType<typeof testApp>;

const ip = { "CF-Connecting-IP": "192.0.2.1" };

function postJson(
  app: TestApp,
  path: string,
  value: unknown,
  sessionToken?: string,
) {
  return app.request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...ip,
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    },
    body: JSON.stringify(value),
  });
}

function deleteWish(app: TestApp, id: string, sessionToken: string) {
  return app.request(`/api/wishes/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${sessionToken}`, ...ip },
  });
}

function patchWish(
  app: TestApp,
  id: string,
  value: unknown,
  sessionToken?: string,
) {
  return app.request(`/api/wishes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...ip,
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    },
    body: JSON.stringify(value),
  });
}

function putReaction(
  app: TestApp,
  id: string,
  emoji: unknown,
  sessionToken?: string,
) {
  return app.request(`/api/wishes/${encodeURIComponent(id)}/reaction`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...ip,
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    },
    body: JSON.stringify({ emoji }),
  });
}

function deleteReaction(app: TestApp, id: string, sessionToken?: string) {
  return app.request(`/api/wishes/${encodeURIComponent(id)}/reaction`, {
    method: "DELETE",
    headers: {
      ...ip,
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    },
  });
}

function postWish(
  app: TestApp,
  wish: Record<string, string>,
  sessionToken?: string,
) {
  return postJson(app, "/api/wishes", wish, sessionToken);
}

/** Creates a new name and returns the body plus its session token. */
async function registerName(app: TestApp, author: string, name = "A wish") {
  const response = await postWish(app, {
    author,
    name,
    link: "https://example.com",
    turnstileToken: "",
  });
  expect(response.status).toBe(201);
  return (await response.json()) as {
    user: { id: string; name: string };
    secret: string;
    wish: { id: string; userId: string; author: string };
  };
}

async function signIn(app: TestApp, name: string, secret: string) {
  return postJson(app, "/api/session", { name, secret });
}

it("creates a user with a six-character secret and lists its wish", async () => {
  const app = testApp();
  const response = await postWish(app, {
    author: "  Leonardo  ",
    name: "A good book",
    link: "HTTPS://Example.COM:443/book",
    turnstileToken: "",
  });
  expect(response.status).toBe(201);
  const created = await response.json();
  expect(created.secret).toMatch(/^[A-Z2-9]{6}$/);
  expect(created.user.name).toBe("Leonardo");
  expect(created.wish.userId).toBe(created.user.id);
  expect(created.wish.author).toBe("Leonardo");
  expect(created.wish.link).toBe("https://example.com/book");

  const body = await (await app.request("/api/wishes")).json();
  expect(body.wishes.length).toBe(1);
  expect(body.wishes[0].author).toBe("Leonardo");
  expect(JSON.stringify(body).includes(created.secret)).toBe(false);
  expect(JSON.stringify(body).includes("password")).toBe(false);
  app.close();
});

it("registering a wish signs its new owner in", async () => {
  const app = testApp();
  const response = await postWish(app, {
    author: "Teste",
    name: "Wish",
    link: "https://example.com",
    turnstileToken: "",
  });
  expect(response.status).toBe(201);
  const created = await response.json();
  expect(created.secret).toMatch(/^[A-Z2-9]{6}$/);
  // The browser stores this token to show "Posting as Teste" and manage wishes.
  expect(typeof created.sessionToken).toBe("string");
  expect(created.sessionToken.length > 0).toBeTruthy();

  const deleted = await deleteWish(app, created.wish.id, created.sessionToken);
  expect(deleted.status).toBe(200);
  app.close();
});

it("names are unique case-insensitively and require their secret", async () => {
  const app = testApp();
  const first = await registerName(app, "Leo", "First wish");
  const input = {
    author: " leo ",
    name: "Second wish",
    link: "https://example.com/second",
    turnstileToken: "",
  };

  expect((await postWish(app, input)).status).toBe(409);
  const wrong = await signIn(app, "leo", "AAAAAA");
  expect(wrong.status).toBe(401);

  const signedIn = await signIn(app, " LEO ", first.secret.toLowerCase());
  expect(signedIn.status).toBe(200);
  const { sessionToken } = await signedIn.json();
  const created = await postWish(app, input, sessionToken);
  expect(created.status).toBe(201);
  expect((await created.json()).secret).toBe(undefined);
  app.close();
});

it("sessions authorize only their own wishes", async () => {
  const app = testApp();
  const leo = await registerName(app, "Leo", "Book");
  const ana = await registerName(app, "Ana", "Game");

  const leoSession = await (
    await signIn(app, "Leo", leo.secret.toLowerCase())
  ).json();
  expect(leoSession.user.id).toEqual(leo.user.id);

  const anaSession = await (await signIn(app, "Ana", ana.secret)).json();
  expect(
    (await deleteWish(app, ana.wish.id, leoSession.sessionToken)).status,
  ).toBe(404);
  expect(
    (await deleteWish(app, leo.wish.id, anaSession.sessionToken)).status,
  ).toBe(404);
  expect(
    (await deleteWish(app, leo.wish.id, leoSession.sessionToken)).status,
  ).toBe(200);
  expect(
    (await deleteWish(app, ana.wish.id, anaSession.sessionToken)).status,
  ).toBe(200);
  app.close();
});

it("rotation rejects a JSON body that is not an object", async () => {
  const app = testApp();
  const created = await registerName(app, "Leo", "Book");
  const session = (await (await signIn(app, "Leo", created.secret)).json())
    .sessionToken as string;
  for (const value of [null, 42, "secret", []]) {
    const response = await postJson(app, "/api/session/rotate", value, session);
    expect(response.status, JSON.stringify(value)).toBe(400);
  }
  app.close();
});

it("database failures during sign-in are server errors, not wrong secrets", async () => {
  const app = testApp();
  await registerName(app, "Leo", "Book");
  app.close();
  expect((await signIn(app, "Leo", "AAAAAA")).status).toBe(500);
});

it("deleting requires a valid session", async () => {
  const app = testApp();
  const leo = await registerName(app, "Leo");
  const response = await app.request(`/api/wishes/${leo.wish.id}`, {
    method: "DELETE",
    headers: ip,
  });
  expect(response.status).toBe(401);
  expect((await deleteWish(app, leo.wish.id, "not-a-session")).status).toBe(
    401,
  );
  app.close();
});

it("rotation requires the current secret and invalidates the old one", async () => {
  const app = testApp();
  const created = await registerName(app, "Leo", "Book");
  const session = (await (await signIn(app, "Leo", created.secret)).json())
    .sessionToken as string;

  const wrongCurrent = await postJson(
    app,
    "/api/session/rotate",
    { currentSecret: "BBBBBB" },
    session,
  );
  expect(wrongCurrent.status).toBe(401);

  const rotated = await postJson(
    app,
    "/api/session/rotate",
    { currentSecret: created.secret },
    session,
  );
  expect(rotated.status).toBe(200);
  const next = await rotated.json();
  expect(next.secret).toMatch(/^[A-Z2-9]{6}$/);
  // The fresh token from the rotation is usable for the user's own wishes.
  expect(
    (await deleteWish(app, created.wish.id, next.sessionToken)).status,
  ).toBe(200);
  expect((await signIn(app, "Leo", created.secret)).status).toBe(401);
  expect((await signIn(app, "Leo", next.secret)).status).toBe(200);
  app.close();
});

it("rotation revokes sessions on other devices", async () => {
  const app = testApp();
  const created = await registerName(app, "Leo", "Book");
  const first = (await (await signIn(app, "Leo", created.secret)).json())
    .sessionToken as string;
  const second = (await (await signIn(app, "Leo", created.secret)).json())
    .sessionToken as string;

  const rotated = await postJson(
    app,
    "/api/session/rotate",
    { currentSecret: created.secret },
    first,
  );
  expect(rotated.status).toBe(200);
  expect((await deleteWish(app, created.wish.id, second)).status).toBe(401);
  app.close();
});

it("the wishlist refuses wishes past the shared limit", async () => {
  const app = testApp(1000, { globalAssumeRateLimit: 1000 });
  for (let index = 0; index < WISH_LIMIT; index += 1) {
    const response = await postWish(app, {
      author: `Person ${index}`,
      name: "Wish",
      link: "https://example.com",
      turnstileToken: "",
    });
    expect(response.status, `wish ${index}`).toBe(201);
  }
  const overflow = await postWish(app, {
    author: "Late Person",
    name: "Too late",
    link: "https://example.com",
    turnstileToken: "",
  });
  expect(overflow.status).toBe(409);
  expect((await overflow.json()).error.message).toMatch(/full/);
  expect(
    (await (await app.request("/api/wishes?limit=1000")).json()).wishes.length,
  ).toBe(WISH_LIMIT);
  app.close();
});

it("a rejected wish does not strand a brand-new name", async () => {
  const app = testApp(1000, { globalAssumeRateLimit: 1000 });
  for (let index = 0; index < WISH_LIMIT; index += 1) {
    await registerName(app, `Filler ${index}`);
  }
  const rejected = await postWish(app, {
    author: "Stranded",
    name: "Nope",
    link: "https://example.com",
    turnstileToken: "",
  });
  expect(rejected.status).toBe(409);
  const again = await postWish(app, {
    author: "Stranded",
    name: "Nope",
    link: "https://example.com",
    turnstileToken: "",
  });
  expect(again.status).toBe(409);
  expect((await again.json()).error.message).toMatch(/full/);
  app.close();
});

it("API responses are uncached and carry request IDs", async () => {
  const app = testApp();
  const response = await app.request("/api/wishes", {
    headers: { "X-Request-Id": "test-request-1" },
  });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("X-Request-Id")).toBe("test-request-1");
  app.close();
});

it("health reports database failures", async () => {
  const app = testApp();
  expect((await app.request("/api/health")).status).toBe(200);
  app.close();
  const response = await app.request("/api/health");
  expect(response.status).toBe(503);
});

it("localhost CORS is development-only", async () => {
  for (const [nodeEnv, expected] of [
    ["development", "http://localhost:4321"],
    ["production", null],
  ] as const) {
    const app = testApp(20, { nodeEnv });
    const response = await app.request("/api/wishes", {
      headers: { Origin: "http://localhost:4321" },
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(expected);
    app.close();
  }
});

it("Turnstile verification requires the page hostname", async () => {
  const originalFetch = globalThis.fetch;
  let hostname = "attacker.example";
  globalThis.fetch = async () =>
    Response.json({ success: true, action: "wishlist", hostname });
  const app = testApp(20, {
    turnstileSecret: "turnstile-test-secret",
    nodeEnv: "test",
  });
  const input = {
    author: "Leo",
    name: "Book",
    link: "https://example.com",
    turnstileToken: "token",
  };
  try {
    expect((await postWish(app, input)).status).toBe(400);
    hostname = "wishlist.example.com";
    expect((await postWish(app, input)).status).toBe(201);
  } finally {
    globalThis.fetch = originalFetch;
    app.close();
  }
});

it("a configured Turnstile secret is enforced in development too", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({ success: false, action: "wishlist" });
  const app = testApp(20, { turnstileSecret: "turnstile-test-secret" });
  try {
    const response = await postWish(app, {
      author: "Leo",
      name: "Book",
      link: "https://example.com",
      turnstileToken: "",
    });
    expect(response.status).toBe(400);
  } finally {
    globalThis.fetch = originalFetch;
    app.close();
  }
});

it("development works without a Turnstile secret", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Turnstile must not be contacted without a secret");
  };
  const app = testApp(20, { nodeEnv: "development" });
  try {
    const response = await postWish(app, {
      author: "Leo",
      name: "Book",
      link: "https://example.com",
      turnstileToken: "",
    });
    expect(response.status).toBe(201);
  } finally {
    globalThis.fetch = originalFetch;
    app.close();
  }
});

it("session-authenticated wish posts also require Turnstile", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = init?.body;
    const token = body instanceof URLSearchParams ? body.get("response") : null;
    return Response.json({
      success: token === "valid-token",
      action: "wishlist",
      hostname: "wishlist.example.com",
    });
  };
  const app = testApp(20, { turnstileSecret: "turnstile-test-secret" });
  const wish = { author: "Leo", name: "Book", link: "https://example.com" };
  try {
    const registered = await postWish(app, {
      ...wish,
      turnstileToken: "valid-token",
    });
    expect(registered.status).toBe(201);
    const { sessionToken } = await registered.json();

    const unverified = await postWish(
      app,
      { ...wish, turnstileToken: "" },
      sessionToken,
    );
    expect(unverified.status).toBe(400);

    const verified = await postWish(
      app,
      { ...wish, turnstileToken: "valid-token" },
      sessionToken,
    );
    expect(verified.status).toBe(201);
  } finally {
    globalThis.fetch = originalFetch;
    app.close();
  }
});

it("rotation requires Turnstile when a secret is configured", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = init?.body;
    const token = body instanceof URLSearchParams ? body.get("response") : null;
    return Response.json({
      success: token === "valid-token",
      action: "wishlist",
      hostname: "wishlist.example.com",
    });
  };
  const app = testApp(20, { turnstileSecret: "turnstile-test-secret" });
  try {
    const created = await postWish(app, {
      author: "Leo",
      name: "Book",
      link: "https://example.com",
      turnstileToken: "valid-token",
    });
    expect(created.status).toBe(201);
    const body = await created.json();
    const session = body.sessionToken as string;

    const unverified = await postJson(
      app,
      "/api/session/rotate",
      { currentSecret: body.secret },
      session,
    );
    expect(unverified.status).toBe(400);

    const verified = await postJson(
      app,
      "/api/session/rotate",
      { currentSecret: body.secret, turnstileToken: "valid-token" },
      session,
    );
    expect(verified.status).toBe(200);
  } finally {
    globalThis.fetch = originalFetch;
    app.close();
  }
});

it("wish listing supports bounded pagination", async () => {
  const app = testApp();
  for (const name of ["One", "Two"]) {
    await postWish(app, {
      author: name,
      name: "Wish",
      link: "https://example.com",
      turnstileToken: "",
    });
  }
  const response = await app.request("/api/wishes?limit=1&offset=1");
  const body = await response.json();
  expect(body.wishes.length).toBe(1);
  expect(body.wishes[0].author).toBe("Two");
  expect((await app.request("/api/wishes?limit=1001")).status).toBe(400);
  app.close();
});

it("JSON POST routes reject other content types", async () => {
  const app = testApp();
  const response = await app.request("/api/session", {
    method: "POST",
    body: "secret",
  });
  expect(response.status).toBe(415);
  app.close();
});

it("global guessing limits are shared across secret-verifying routes", async () => {
  const app = testApp(20, { globalAssumeRateLimit: 1 });
  const created = await registerName(app, "Leo", "Book");
  expect((await signIn(app, "Leo", created.secret)).status).toBe(429);
  app.close();
});

it("assume-session attempts are strictly rate limited", async () => {
  const app = testApp(20, { assumeRateLimit: 2 });
  expect((await signIn(app, "Nobody", "AAAAAA")).status).toBe(401);
  expect((await signIn(app, "Nobody", "BBBBBB")).status).toBe(401);
  expect((await signIn(app, "Nobody", "CCCCCC")).status).toBe(429);
  app.close();
});

it("client IPs are only read from proxy headers when trusted", async () => {
  // Untrusted: every request shares one bucket, so forged headers cannot reset it.
  const untrusted = testApp(1, { assumeRateLimit: 1 });
  expect(
    (
      await untrusted.request("/api/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "10.0.0.1",
        },
        body: JSON.stringify({ name: "x", secret: "AAAAAA" }),
      })
    ).status,
  ).toBe(401);
  expect(
    (
      await untrusted.request("/api/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "10.0.0.2",
        },
        body: JSON.stringify({ name: "x", secret: "AAAAAA" }),
      })
    ).status,
  ).toBe(429);
  untrusted.close();
});

it("an owner can edit a wish, and only the owner", async () => {
  const app = testApp();
  const leo = await registerName(app, "Leo", "Book");
  const leoSession = (await (await signIn(app, "Leo", leo.secret)).json())
    .sessionToken as string;
  const ana = await registerName(app, "Ana", "Socks");
  const anaSession = (await (await signIn(app, "Ana", ana.secret)).json())
    .sessionToken as string;

  const updated = await patchWish(
    app,
    leo.wish.id,
    { name: "A better book", link: "https://example.com/better" },
    leoSession,
  );
  expect(updated.status).toBe(200);
  const body = await updated.json();
  expect(body.wish.name).toBe("A better book");
  expect(body.wish.link).toBe("https://example.com/better");
  expect(typeof body.wish.updatedAt).toBe("string");
  expect(body.wish.reactions).toEqual([]);

  // Another signed-in user cannot edit someone else's wish.
  expect(
    (
      await patchWish(
        app,
        leo.wish.id,
        { name: "Hijack", link: "https://example.com" },
        anaSession,
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await patchWish(app, leo.wish.id, {
        name: "No session",
        link: "https://example.com",
      })
    ).status,
  ).toBe(401);

  const invalid = await patchWish(
    app,
    leo.wish.id,
    { name: "Bad", link: "javascript:alert(1)" },
    leoSession,
  );
  expect(invalid.status).toBe(400);
  expect((await invalid.json()).error.code).toBe("invalid_link");
  app.close();
});

it("reactions are one per user per wish and can be cleared", async () => {
  const app = testApp();
  const leo = await registerName(app, "Leo", "Book");
  const ana = await registerName(app, "Ana", "Socks");
  const leoSession = (await (await signIn(app, "Leo", leo.secret)).json())
    .sessionToken as string;
  const anaSession = (await (await signIn(app, "Ana", ana.secret)).json())
    .sessionToken as string;

  const first = await putReaction(app, leo.wish.id, "❤️", anaSession);
  expect(first.status).toBe(200);
  expect((await first.json()).wish.reactions).toEqual([
    { emoji: "❤️", userIds: [ana.user.id] },
  ]);

  // Changing emoji replaces the user's old reaction.
  const replaced = await putReaction(app, leo.wish.id, "🧦", anaSession);
  expect((await replaced.json()).wish.reactions).toEqual([
    { emoji: "🧦", userIds: [ana.user.id] },
  ]);

  await putReaction(app, leo.wish.id, "❤️", leoSession);
  const listed = await (await app.request("/api/wishes")).json();
  const listedWish = listed.wishes.find(
    (wish: { id: string }) => wish.id === leo.wish.id,
  );
  expect(listedWish.reactions).toEqual([
    { emoji: "❤️", userIds: [leo.user.id] },
    { emoji: "🧦", userIds: [ana.user.id] },
  ]);

  const cleared = await deleteReaction(app, leo.wish.id, anaSession);
  expect((await cleared.json()).wish.reactions).toEqual([
    { emoji: "❤️", userIds: [leo.user.id] },
  ]);

  const invalid = await putReaction(app, leo.wish.id, "🍕", leoSession);
  expect(invalid.status).toBe(400);
  expect((await invalid.json()).error.code).toBe("invalid_reaction");
  expect((await putReaction(app, "missing", "❤️", leoSession)).status).toBe(404);
  expect((await putReaction(app, leo.wish.id, "❤️")).status).toBe(401);
  app.close();
});

it("API failures use the shared error envelope", async () => {
  const app = testApp();
  const notFound = await app.request("/api/nope");
  expect(notFound.status).toBe(404);
  expect(await notFound.json()).toMatchObject({
    error: { code: "not_found" },
  });

  const wrongType = await app.request("/api/session", {
    method: "POST",
    body: "secret",
  });
  expect(wrongType.status).toBe(415);
  expect(await wrongType.json()).toMatchObject({
    error: { code: "unsupported_media_type" },
  });
  app.close();
});

/**
 * Recreates a pre-ADR-0001 account: the secret lives in the legacy store and
 * Better Auth holds a random password nobody knows, exactly like production.
 */
async function makeLegacyAccount(
  app: TestApp,
  name: string,
  secret: string,
) {
  const registered = await registerName(app, name);
  const userId = registered.user.id;
  const salt = "0123456789abcdef0123456789abcdef";
  const hash = ((await scrypt(secret, salt, 32)) as Buffer).toString("hex");
  const lookup = createHmac("sha256", LEGACY_PEPPER)
    .update(secret)
    .digest("hex");
  app.client
    .prepare(
      `insert into legacy_wishlist_secrets
         (id, user_id, secret_lookup, secret_hash, secret_salt, created_at)
       values (?, ?, ?, ?, ?, ?)`,
    )
    .run(randomUUID(), userId, lookup, hash, salt, new Date().toISOString());
  app.client
    .prepare("update account set password = ? where user_id = ?")
    .run(`${salt}:${"0".repeat(128)}`, userId);
  return { userId, lookup };
}

const legacyRow = (app: TestApp, lookup: string) =>
  app.client
    .prepare(
      "select 1 from legacy_wishlist_secrets where secret_lookup = ? limit 1",
    )
    .get(lookup);

it("upgrades a pre-ADR-0001 secret to a Better Auth password on first sign-in", async () => {
  const app = testApp(20, { secretPepper: LEGACY_PEPPER });
  const { lookup } = await makeLegacyAccount(app, "Legacy Leo", "ABCDEF");

  const response = await signIn(app, "Legacy Leo", "ABCDEF");
  expect(response.status).toBe(200);
  expect((await response.json()).user.name).toBe("Legacy Leo");
  // Drained, so the next sign-in must go through Better Auth.
  expect(legacyRow(app, lookup)).toBeUndefined();
  expect((await signIn(app, "Legacy Leo", "ABCDEF")).status).toBe(200);
  app.close();
});

it("keeps the legacy row when the secret is wrong or the name does not match", async () => {
  const app = testApp(20, { secretPepper: LEGACY_PEPPER });
  const { lookup } = await makeLegacyAccount(app, "Legacy Leo", "ABCDEF");
  await registerName(app, "Someone Else");

  expect((await signIn(app, "Legacy Leo", "ZZZZZZ")).status).toBe(401);
  expect(legacyRow(app, lookup)).toBeDefined();

  // A valid secret must not upgrade a name it does not belong to.
  expect((await signIn(app, "Someone Else", "ABCDEF")).status).toBe(401);
  expect(legacyRow(app, lookup)).toBeDefined();

  expect((await signIn(app, "Legacy Leo", "ABCDEF")).status).toBe(200);
  expect(legacyRow(app, lookup)).toBeUndefined();
  app.close();
});

it("refuses legacy secrets when no pepper is configured", async () => {
  const app = testApp();
  const { lookup } = await makeLegacyAccount(app, "Legacy Leo", "ABCDEF");

  expect((await signIn(app, "Legacy Leo", "ABCDEF")).status).toBe(401);
  expect(legacyRow(app, lookup)).toBeDefined();
  app.close();
});
