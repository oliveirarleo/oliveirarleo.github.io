import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { Data, Effect, Schema, pipe } from "effect";
import { asc, eq } from "drizzle-orm";
import type { WishlistDatabase } from "./database.ts";
import { wishes } from "./schema.ts";
import { deleteWishSchema, validWebUrl, wishInputSchema } from "./validation.ts";

class HttpError extends Data.TaggedError("HttpError")<{
  status: ContentfulStatusCode;
  message: string;
}> {}

export interface AppOptions {
  allowedOrigin: string;
  turnstileSecret?: string | undefined;
  rateLimit?: number;
  rateWindowMs?: number;
}

interface TurnstileResponse {
  success: boolean;
  action?: string;
}

const jsonError = (status: ContentfulStatusCode, message: string) =>
  Effect.fail(new HttpError({ status, message }));

const createDeleteToken = () => randomBytes(32).toString("base64url");

const hashDeleteToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

function tokenMatches(storedHash: string | null, token: string) {
  if (!storedHash) return false;
  const expected = Buffer.from(storedHash, "hex");
  const actual = Buffer.from(hashDeleteToken(token), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function takeRateLimit(
  attempts: Map<string, number[]>,
  key: string,
  limit: number,
  windowMs: number,
) {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) return false;
  attempts.set(key, [...recent, now]);

  if (attempts.size > 5_000) {
    for (const [entry, times] of attempts) {
      if (times.every((time) => now - time >= windowMs)) attempts.delete(entry);
    }
  }

  return true;
}

const verifyTurnstile = (token: string, ip: string, secret: string) =>
  pipe(
    Effect.tryPromise({
      try: async () => {
        const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ secret, response: token, remoteip: ip }),
          signal: AbortSignal.timeout(10_000),
        });
        return (await response.json()) as TurnstileResponse;
      },
      catch: () => new HttpError({ status: 502, message: "Verification is temporarily unavailable." }),
    }),
    Effect.flatMap((result) =>
      result.success && result.action === "wishlist"
        ? Effect.void
        : jsonError(400, "Verification failed. Please try again."),
    ),
  );

export function createApp(
  db: WishlistDatabase,
  { allowedOrigin, turnstileSecret, rateLimit = 5, rateWindowMs = 10 * 60 * 1000 }: AppOptions,
) {
  const attempts = new Map<string, number[]>();
  const localOrigins = new Set(["http://localhost:4321", "http://127.0.0.1:4321"]);
  const app = new Hono();

  app.onError((error, c) => {
    console.error(error);
    return c.json({ error: "Internal server error." }, 500);
  });
  app.notFound((c) => c.json({ error: "Not found." }, 404));

  app.use("*", secureHeaders());
  app.use(
    "/api/*",
    cors({
      origin: (origin) => (origin === allowedOrigin || localOrigins.has(origin) ? origin : ""),
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type"],
      maxAge: 86400,
    }),
  );
  app.use("/api/*", bodyLimit({ maxSize: 8 * 1024, onError: (c) => c.json({ error: "Request body is too large." }, 413) }));

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.get("/api/wishes", async (c) => {
    const program = pipe(
      Effect.tryPromise({
        try: () =>
          db
            .select({
              id: wishes.id,
              author: wishes.author,
              name: wishes.name,
              link: wishes.link,
              createdAt: wishes.createdAt,
            })
            .from(wishes)
            .orderBy(asc(wishes.createdAt)),
        catch: () => new HttpError({ status: 500, message: "Could not load wishes." }),
      }),
      Effect.map((items) => ({ wishes: items })),
    );
    return respond(c, program);
  });

  app.post("/api/wishes", async (c) => {
    const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ?? "local";
    if (!takeRateLimit(attempts, `add:${ip}`, rateLimit, rateWindowMs)) {
      return c.json({ error: "Too many wishes. Please try again later." }, 429);
    }

    const program = pipe(
      Effect.tryPromise({
        try: () => c.req.json(),
        catch: () => new HttpError({ status: 400, message: "Send a valid JSON body." }),
      }),
      Effect.flatMap((body) =>
        pipe(
          Schema.decodeUnknownEffect(wishInputSchema)(body),
          Effect.mapError(
            () =>
              new HttpError({
                status: 400,
                message: "Check the author, wish, link, and verification fields.",
              }),
          ),
          Effect.flatMap((input) => {
            if (!validWebUrl(input.link)) {
              return jsonError(400, "The gift link must be a valid HTTP or HTTPS URL.");
            }

            const wish = {
              id: randomUUID(),
              author: input.author,
              name: input.name,
              link: input.link,
              createdAt: new Date().toISOString(),
            };
            const deleteToken = createDeleteToken();

            return pipe(
              turnstileSecret
                ? verifyTurnstile(input.turnstileToken, ip, turnstileSecret)
                : Effect.void,
              Effect.flatMap(() =>
                Effect.tryPromise({
                  try: () =>
                    db.insert(wishes).values({
                      ...wish,
                      deleteTokenHash: hashDeleteToken(deleteToken),
                    }),
                  catch: () => new HttpError({ status: 500, message: "Could not save your wish." }),
                }),
              ),
              Effect.map(() => ({ wish, deleteToken })),
            );
          }),
        ),
      ),
    );

    return respond(c, program, 201);
  });

  app.delete("/api/wishes/:id", async (c) => {
    const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ?? "local";
    if (!takeRateLimit(attempts, `delete:${ip}`, rateLimit, rateWindowMs)) {
      return c.json({ error: "Too many changes. Please try again later." }, 429);
    }

    const id = c.req.param("id");
    const program = pipe(
      Effect.tryPromise({
        try: () => c.req.json(),
        catch: () => new HttpError({ status: 400, message: "Send a valid JSON body." }),
      }),
      Effect.flatMap((body) =>
        pipe(
          Schema.decodeUnknownEffect(deleteWishSchema)(body),
          Effect.mapError(
            () => new HttpError({ status: 400, message: "A delete token is required." }),
          ),
          Effect.flatMap((input) =>
            pipe(
              Effect.tryPromise({
                try: () =>
                  db
                    .select({ deleteTokenHash: wishes.deleteTokenHash })
                    .from(wishes)
                    .where(eq(wishes.id, id))
                    .limit(1),
                catch: () => new HttpError({ status: 500, message: "Could not load the wish." }),
              }),
              Effect.flatMap(([existing]) => {
                if (!existing || !tokenMatches(existing.deleteTokenHash, input.deleteToken)) {
                  return jsonError(404, "Wish not found.");
                }

                return pipe(
                  Effect.tryPromise({
                    try: () => db.delete(wishes).where(eq(wishes.id, id)),
                    catch: () => new HttpError({ status: 500, message: "Could not remove the wish." }),
                  }),
                  Effect.map(() => ({ ok: true })),
                );
              }),
            ),
          ),
        ),
      ),
    );

    return respond(c, program);
  });

  return app;
}

async function respond<A>(
  c: Context,
  effect: Effect.Effect<A, HttpError>,
  successStatus: ContentfulStatusCode = 200,
) {
  return Effect.runPromise(
    pipe(
      effect,
      Effect.match({
        onFailure: (error) => c.json({ error: error.message }, error.status),
        onSuccess: (value) => c.json(value, successStatus),
      }),
    ),
  );
}
