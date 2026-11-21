import assert from "node:assert/strict";
import { test } from "node:test";
import type { AppOptions } from "./app.ts";
import { createApp } from "./app.ts";
import { createDatabase } from "./database.ts";

export function testApp(rateLimit = 20, options: Partial<AppOptions> = {}) {
  const { db, client } = createDatabase(":memory:");
  const app = createApp(db, {
    allowedOrigin: "https://wishlist.example.com",
    rateLimit,
    authSecret: "test-only-auth-secret-at-least-32-characters",
    secretPepper: "test-only-secret-pepper",
    ...options,
  });
  return Object.assign(app, { close: () => client.close() });
}

function postJson(
  app: ReturnType<typeof testApp>,
  path: string,
  value: unknown,
  secret?: string,
) {
  return app.request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": "192.0.2.1",
      ...(secret ? { "X-Wishlist-Secret": secret } : {}),
    },
    body: JSON.stringify(value),
  });
}

function deleteWish(
  app: ReturnType<typeof testApp>,
  id: string,
  secret: string,
) {
  return app.request(`/api/wishes/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "X-Wishlist-Secret": secret, "CF-Connecting-IP": "192.0.2.1" },
  });
}

export function postWish(
  app: ReturnType<typeof testApp>,
  wish: Record<string, string>,
) {
  return postJson(app, "/api/wishes", wish);
}

test("creates a user with a six-character secret and lists its wish", async () => {
  const app = testApp();
  const response = await postWish(app, {
    author: "  Leonardo  ",
    name: "A good book",
    link: "HTTPS://Example.COM:443/book",
    turnstileToken: "",
  });
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.match(created.secret, /^[A-Z2-9]{6}$/);
  assert.equal(created.user.name, "Leonardo");
  assert.equal(created.wish.userId, created.user.id);
  assert.equal(created.wish.author, "Leonardo");
  assert.equal(created.wish.link, "https://example.com/book");
  assert.equal(created.wish.deleteTokenHash, undefined);

  const list = await app.request("/api/wishes");
  const body = await list.json();
  assert.equal(body.wishes.length, 1);
  assert.equal(body.wishes[0].author, "Leonardo");
  assert.equal(JSON.stringify(body).includes(created.secret), false);
  assert.equal(JSON.stringify(body).includes("Hash"), false);
  app.close();
});

test("existing names require their own secret", async () => {
  const app = testApp();
  const first = await (
    await postWish(app, {
      author: "Leo",
      name: "First wish",
      link: "https://example.com",
      turnstileToken: "",
    })
  ).json();
  const input = {
    author: " leo ",
    name: "Second wish",
    link: "https://example.com/second",
    turnstileToken: "",
  };

  assert.equal((await postWish(app, input)).status, 409);
  assert.equal(
    (await postWish(app, { ...input, secret: "AAAAAA" })).status,
    401,
  );
  const created = await postWish(app, {
    ...input,
    secret: first.secret.toLowerCase(),
  });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).secret, undefined);
  app.close();
});

test("secrets assume users and authorize only their own wishes", async () => {
  const app = testApp();
  const leo = await (
    await postWish(app, {
      author: "Leo",
      name: "Book",
      link: "https://example.com",
      turnstileToken: "",
    })
  ).json();
  const ana = await (
    await postWish(app, {
      author: "Ana",
      name: "Game",
      link: "https://example.com",
      turnstileToken: "",
    })
  ).json();

  const assumed = await postJson(app, "/api/session", {
    secret: leo.secret.toLowerCase(),
  });
  assert.equal(assumed.status, 200);
  assert.deepEqual((await assumed.json()).user, leo.user);
  assert.equal((await deleteWish(app, ana.wish.id, leo.secret)).status, 404);
  assert.equal((await deleteWish(app, leo.wish.id, ana.secret)).status, 404);
  assert.equal((await deleteWish(app, leo.wish.id, leo.secret)).status, 200);
  assert.equal((await deleteWish(app, ana.wish.id, ana.secret)).status, 200);
  app.close();
});

test("rotation invalidates the old secret", async () => {
  const app = testApp();
  const created = await (
    await postWish(app, {
      author: "Leo",
      name: "Book",
      link: "https://example.com",
      turnstileToken: "",
    })
  ).json();
  const rotated = await postJson(
    app,
    "/api/session/rotate",
    {},
    created.secret,
  );
  assert.equal(rotated.status, 200);
  const next = await rotated.json();
  assert.match(next.secret, /^[A-Z2-9]{6}$/);
  assert.equal(
    (await postJson(app, "/api/session", { secret: created.secret })).status,
    401,
  );
  assert.equal(
    (await postJson(app, "/api/session", { secret: next.secret })).status,
    200,
  );
  app.close();
});

test("API responses are uncached and carry request IDs", async () => {
  const app = testApp();
  const response = await app.request("/api/wishes", {
    headers: { "X-Request-Id": "test-request-1" },
  });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(response.headers.get("X-Request-Id"), "test-request-1");
  app.close();
});

test("health reports database failures", async () => {
  const app = testApp();
  assert.equal((await app.request("/api/health")).status, 200);
  app.close();
  const response = await app.request("/api/health");
  assert.equal(response.status, 503);
});

test("localhost CORS is development-only", async () => {
  for (const [nodeEnv, expected] of [
    ["development", "http://localhost:4321"],
    ["production", null],
  ] as const) {
    const app = testApp(20, { nodeEnv });
    const response = await app.request("/api/wishes", {
      headers: { Origin: "http://localhost:4321" },
    });
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), expected);
    app.close();
  }
});

test("Turnstile verification requires the page hostname", async () => {
  const originalFetch = globalThis.fetch;
  let hostname = "attacker.example";
  globalThis.fetch = async () =>
    Response.json({ success: true, action: "wishlist", hostname });
  const app = testApp(20, { turnstileSecret: "turnstile-test-secret" });
  const input = {
    author: "Leo",
    name: "Book",
    link: "https://example.com",
    turnstileToken: "token",
  };
  try {
    assert.equal((await postWish(app, input)).status, 400);
    hostname = "wishlist.example.com";
    assert.equal((await postWish(app, input)).status, 201);
  } finally {
    globalThis.fetch = originalFetch;
    app.close();
  }
});

test("wish listing supports bounded pagination", async () => {
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
  assert.equal(body.wishes.length, 1);
  assert.equal(body.wishes[0].author, "Two");
  assert.equal((await app.request("/api/wishes?limit=1001")).status, 400);
  app.close();
});

test("JSON POST routes reject other content types", async () => {
  const app = testApp();
  const response = await app.request("/api/session", {
    method: "POST",
    body: "secret",
  });
  assert.equal(response.status, 415);
  app.close();
});

test("global guessing limits are shared across secret-verifying routes", async () => {
  const app = testApp(20, { globalAssumeRateLimit: 1 });
  const created = await (
    await postWish(app, {
      author: "Leo",
      name: "Book",
      link: "https://example.com",
      turnstileToken: "",
    })
  ).json();
  assert.equal(
    (await postJson(app, "/api/session", { secret: created.secret })).status,
    429,
  );
  assert.equal(
    (await deleteWish(app, created.wish.id, created.secret)).status,
    429,
  );
  app.close();
});

test("assume-session attempts are strictly rate limited", async () => {
  const app = testApp(20, { assumeRateLimit: 2 });
  assert.equal(
    (await postJson(app, "/api/session", { secret: "AAAAAA" })).status,
    401,
  );
  assert.equal(
    (await postJson(app, "/api/session", { secret: "BBBBBB" })).status,
    401,
  );
  assert.equal(
    (await postJson(app, "/api/session", { secret: "CCCCCC" })).status,
    429,
  );
  app.close();
});
