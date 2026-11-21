import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { Effect, pipe, Schema } from "effect";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { createAuth } from "./auth.ts";
import type { WishlistDatabase } from "./database.ts";
import { HttpError, respond } from "./http.ts";
import { logger } from "./logger.ts";
import { createRateLimiter } from "./rate-limit.ts";
import { verifyTurnstile } from "./turnstile.ts";
import { normalizeUserSecret, validUserSecret } from "./user-secrets.ts";
import { sessionInputSchema, wishInputSchema } from "./validation.ts";
import { createWishlistRepository } from "./wishes/repository.ts";
import { createWishlistService } from "./wishes/service.ts";

export interface AppOptions {
  allowedOrigin: string;
  authSecret: string;
  secretPepper: string;
  nodeEnv?: "development" | "production" | "test";
  turnstileSecret?: string | undefined;
  turnstileHostname?: string;
  rateLimit?: number;
  assumeRateLimit?: number;
  globalAssumeRateLimit?: number;
  rateWindowMs?: number;
  now?: () => number;
}

const serviceCall = <A>(try_: () => Promise<A>) =>
  Effect.tryPromise({
    try: try_,
    catch: (error) =>
      error instanceof HttpError
        ? error
        : new HttpError({
            status: 500,
            message: "The request could not be completed.",
          }),
  });

export function createApp(
  db: WishlistDatabase,
  {
    allowedOrigin,
    authSecret,
    secretPepper,
    nodeEnv = "development",
    turnstileSecret,
    turnstileHostname = new URL(allowedOrigin).hostname,
    rateLimit = 5,
    assumeRateLimit = 10,
    globalAssumeRateLimit = 30,
    rateWindowMs = 10 * 60 * 1000,
    now,
  }: AppOptions,
) {
  const addLimiter = createRateLimiter({
    limit: rateLimit,
    windowMs: rateWindowMs,
    now,
  });
  const deleteLimiter = createRateLimiter({
    limit: rateLimit,
    windowMs: rateWindowMs,
    now,
  });
  const assumeLimiter = createRateLimiter({
    limit: assumeRateLimit,
    windowMs: rateWindowMs,
    now,
  });
  const globalAssumeLimiter = createRateLimiter({
    limit: globalAssumeRateLimit,
    windowMs: rateWindowMs,
    now,
  });
  const auth = createAuth(db, authSecret, allowedOrigin);
  const service = createWishlistService(
    createWishlistRepository(db),
    auth,
    secretPepper,
  );
  const localOrigins = new Set([
    "http://localhost:4321",
    "http://127.0.0.1:4321",
  ]);
  const app = new Hono();

  app.onError((_error, c) => c.json({ error: "Internal server error." }, 500));
  app.notFound((c) => c.json({ error: "Not found." }, 404));

  app.use("/api/*", async (c, next) => {
    const supplied = c.req.header("X-Request-Id");
    const requestId =
      supplied && /^[A-Za-z0-9._-]{1,128}$/.test(supplied)
        ? supplied
        : randomUUID();
    const started = performance.now();
    c.header("X-Request-Id", requestId);
    c.header("Cache-Control", "no-store");
    await next();
    logger.info({
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Math.round(performance.now() - started),
    });
  });
  app.use("*", secureHeaders());
  app.use(
    "/api/*",
    cors({
      origin: (origin) =>
        origin === allowedOrigin ||
        (nodeEnv !== "production" && localOrigins.has(origin))
          ? origin
          : "",
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "X-Wishlist-Secret", "X-Request-Id"],
      maxAge: 86400,
    }),
  );
  app.use(
    "/api/*",
    bodyLimit({
      maxSize: 8 * 1024,
      onError: (c) => c.json({ error: "Request body is too large." }, 413),
    }),
  );
  app.use("/api/*", async (c, next) => {
    if (
      c.req.method === "POST" &&
      !c.req.header("Content-Type")?.startsWith("application/json")
    ) {
      return c.json(
        { error: "Send a JSON body with Content-Type: application/json." },
        415,
      );
    }
    return next();
  });

  app.get("/api/health", (c) =>
    respond(
      c,
      pipe(
        Effect.tryPromise({
          try: async () => db.run(sql`SELECT 1`),
          catch: () =>
            new HttpError({ status: 503, message: "Database unavailable." }),
        }),
        Effect.map(() => ({ ok: true })),
      ),
    ),
  );

  app.get("/api/wishes", (c) => {
    const requestedLimit = Number(c.req.query("limit") ?? "500");
    const requestedOffset = Number(c.req.query("offset") ?? "0");
    if (
      !Number.isInteger(requestedLimit) ||
      requestedLimit < 1 ||
      requestedLimit > 1000 ||
      !Number.isInteger(requestedOffset) ||
      requestedOffset < 0
    ) {
      return c.json(
        {
          error:
            "Limit must be 1–1000 and offset must be a non-negative integer.",
        },
        400,
      );
    }
    return respond(
      c,
      pipe(
        serviceCall(() => service.list(requestedLimit, requestedOffset)),
        Effect.map((wishes) => ({
          wishes,
          limit: requestedLimit,
          offset: requestedOffset,
        })),
      ),
    );
  });

  app.post("/api/wishes", async (c) => {
    const ip = requestIp(
      c.req.header("CF-Connecting-IP"),
      c.req.header("X-Forwarded-For"),
    );
    if (
      !addLimiter.take(`add:${ip}`) ||
      !globalAssumeLimiter.take("assume:global")
    ) {
      return c.json({ error: "Too many wishes. Please try again later." }, 429);
    }
    const program = pipe(
      jsonBody(c.req.json()),
      Effect.flatMap((body) =>
        pipe(
          Schema.decodeUnknownEffect(wishInputSchema)(body),
          Effect.mapError(
            () =>
              new HttpError({
                status: 400,
                message:
                  "Check the author, wish, link, and verification fields.",
              }),
          ),
          Effect.flatMap((input) =>
            pipe(
              turnstileSecret
                ? verifyTurnstile(
                    input.turnstileToken,
                    ip,
                    turnstileSecret,
                    turnstileHostname,
                  )
                : Effect.void,
              Effect.flatMap(() =>
                serviceCall(() => service.createWish(input)),
              ),
            ),
          ),
        ),
      ),
    );
    return respond(c, program, 201);
  });

  app.post("/api/session", async (c) => {
    const ip = requestIp(
      c.req.header("CF-Connecting-IP"),
      c.req.header("X-Forwarded-For"),
    );
    if (
      !assumeLimiter.take(`assume:${ip}`) ||
      !globalAssumeLimiter.take("assume:global")
    ) {
      return c.json(
        { error: "Too many attempts. Please try again later." },
        429,
      );
    }
    const program = pipe(
      jsonBody(c.req.json()),
      Effect.flatMap((body) =>
        pipe(
          Schema.decodeUnknownEffect(sessionInputSchema)(body),
          Effect.mapError(
            () =>
              new HttpError({
                status: 400,
                message: "A user secret is required.",
              }),
          ),
          Effect.flatMap((input) =>
            pipe(
              turnstileSecret
                ? verifyTurnstile(
                    input.turnstileToken ?? "",
                    ip,
                    turnstileSecret,
                    turnstileHostname,
                  )
                : Effect.void,
              Effect.flatMap(() =>
                serviceCall(() => service.assume(input.secret)),
              ),
            ),
          ),
        ),
      ),
    );
    return respond(c, program);
  });

  app.post("/api/session/rotate", async (c) => {
    const ip = requestIp(
      c.req.header("CF-Connecting-IP"),
      c.req.header("X-Forwarded-For"),
    );
    if (
      !assumeLimiter.take(`assume:${ip}`) ||
      !globalAssumeLimiter.take("assume:global")
    ) {
      return c.json(
        { error: "Too many attempts. Please try again later." },
        429,
      );
    }
    const secret = c.req.header("X-Wishlist-Secret");
    if (!secret || !validUserSecret(secret)) {
      return c.json({ error: "A valid user secret is required." }, 401);
    }
    return respond(
      c,
      serviceCall(() => service.rotate(secret)),
    );
  });

  app.delete("/api/wishes/:id", async (c) => {
    const ip = requestIp(
      c.req.header("CF-Connecting-IP"),
      c.req.header("X-Forwarded-For"),
    );
    if (
      !deleteLimiter.take(`delete:${ip}`) ||
      !globalAssumeLimiter.take("assume:global")
    ) {
      return c.json(
        { error: "Too many changes. Please try again later." },
        429,
      );
    }
    const secret = c.req.header("X-Wishlist-Secret");
    if (!secret || !validUserSecret(normalizeUserSecret(secret))) {
      return c.json({ error: "A valid user secret is required." }, 401);
    }
    return respond(
      c,
      serviceCall(() => service.remove(c.req.param("id"), secret)),
    );
  });

  return app;
}

function jsonBody(input: Promise<unknown>) {
  return Effect.tryPromise({
    try: () => input,
    catch: () =>
      new HttpError({ status: 400, message: "Send a valid JSON body." }),
  });
}

function requestIp(
  cloudflareIp: string | undefined,
  forwarded: string | undefined,
) {
  return cloudflareIp ?? forwarded?.split(",")[0]?.trim() ?? "local";
}
