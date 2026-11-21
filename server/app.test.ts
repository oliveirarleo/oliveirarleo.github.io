import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "./app.ts";
import { createDatabase } from "./database.ts";

function testApp(rateLimit = 5) {
  const { db } = createDatabase(":memory:");
  return createApp(db, { allowedOrigin: "https://wishlist.example.com", rateLimit });
}

function postWish(app: ReturnType<typeof testApp>, wish: Record<string, string>) {
  const body = JSON.stringify(wish);
  return app.request("/api/wishes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": String(new TextEncoder().encode(body).length),
      "CF-Connecting-IP": "192.0.2.1",
    },
    body,
  });
}

function deleteWish(app: ReturnType<typeof testApp>, id: string, token: string) {
  const body = JSON.stringify({ deleteToken: token });
  return app.request(`/api/wishes/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": String(new TextEncoder().encode(body).length),
      "CF-Connecting-IP": "192.0.2.1",
    },
    body,
  });
}

test("creates and lists a wish", async () => {
  const app = testApp();
  const response = await postWish(app, {
    author: "  Leonardo  ",
    name: "A good book",
    link: "https://example.com/book",
    turnstileToken: "",
  });
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.ok(created.deleteToken);
  assert.equal(created.wish.deleteTokenHash, undefined);

  const list = await app.request("/api/wishes");
  const body = await list.json();
  assert.equal(body.wishes.length, 1);
  assert.equal(body.wishes[0].author, "Leonardo");
  assert.equal(body.wishes[0].deleteTokenHash, undefined);
});

test("deletes a wish only with its creator token", async () => {
  const app = testApp();
  const created = await (
    await postWish(app, {
      author: "Leo",
      name: "Wish",
      link: "https://example.com",
      turnstileToken: "",
    })
  ).json();

  assert.equal((await deleteWish(app, created.wish.id, "wrong-token")).status, 404);
  assert.equal((await deleteWish(app, created.wish.id, created.deleteToken)).status, 200);

  const list = await app.request("/api/wishes");
  const body = await list.json();
  assert.equal(body.wishes.length, 0);
});

test("rejects unsafe links", async () => {
  const response = await postWish(testApp(), {
    author: "Leo",
    name: "Wish",
    link: "javascript:alert(1)",
    turnstileToken: "",
  });
  assert.equal(response.status, 400);
});

test("limits repeated submissions", async () => {
  const app = testApp(1);
  const wish = { author: "Leo", name: "Wish", link: "https://example.com", turnstileToken: "" };
  assert.equal((await postWish(app, wish)).status, 201);
  assert.equal((await postWish(app, wish)).status, 429);
});
