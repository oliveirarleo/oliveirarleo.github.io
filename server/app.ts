import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { Effect, pipe } from "effect";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { createAuth } from "./auth.ts";
import type { WishlistDatabase } from "./database.ts";
import { HttpError, jsonApiError, respond } from "./http.ts";
import { logger } from "./logger.ts";
import { createRateLimiter } from "./rate-limit.ts";
import { createWishlistApi } from "./wishes/api.ts";
import { createWishlistRepository } from "./wishes/repository.ts";
import { createWishlistService } from "./wishes/service.ts";

export interface AppOptions {
  allowedOrigin: string;
  authSecret: string;
  nodeEnv?: "development" | "production" | "test";
  turnstileSecret?: string | undefined;
  turnstileHostname?: string;
  rateLimit?: number;
  editRateLimit?: number;
  reactionRateLimit?: number;
  assumeRateLimit?: number;
  globalAssumeRateLimit?: number;
  rateWindowMs?: number;
  trustProxy?: boolean;
}

const JSON_METHODS = new Set(["POST", "PATCH", "PUT"]);

export function createApp(
  db: WishlistDatabase,
  {
    allowedOrigin,
    authSecret,
    nodeEnv = "development",
    turnstileSecret,
    turnstileHostname = new URL(allowedOrigin).hostname,
    rateLimit = 5,
    editRateLimit = 30,
    reactionRateLimit = 120,
    assumeRateLimit = 10,
    globalAssumeRateLimit = 30,
    rateWindowMs = 10 * 60 * 1000,
    trustProxy = false,
  }: AppOptions,
) {
  const limiter = (limit: number) =>
    createRateLimiter({ limit, windowMs: rateWindowMs });
  const limiters = {
    add: limiter(rateLimit),
    edit: limiter(editRateLimit),
    react: limiter(reactionRateLimit),
    remove: limiter(rateLimit),
    assume: limiter(assumeRateLimit),
    globalAssume: limiter(globalAssumeRateLimit),
  };
  const auth = createAuth(db, authSecret, allowedOrigin);
  const service = createWishlistService(createWishlistRepository(db), auth);
  const localOrigins = new Set([
    "http://localhost:4321",
    "http://127.0.0.1:4321",
  ]);
  const app = new Hono();

  // Client IP is only read from proxy headers when the API sits behind the
  // trusted tunnel (TRUST_PROXY=true). Otherwise every request shares "direct".
  const clientIp = (c: {
    req: { header: (name: string) => string | undefined };
  }) => {
    if (!trustProxy) return "direct";
    return (
      c.req.header("CF-Connecting-IP") ??
      c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
      "direct"
    );
  };

  app.onError((_error, c) =>
    jsonApiError(c, 500, "internal", "Internal server error."),
  );
  app.notFound((c) => jsonApiError(c, 404, "not_found", "Not found."));

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
      allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
      maxAge: 86400,
    }),
  );
  app.use(
    "/api/*",
    bodyLimit({
      maxSize: 8 * 1024,
      onError: (c) =>
        jsonApiError(c, 413, "payload_too_large", "Request body is too large."),
    }),
  );
  app.use("/api/*", async (c, next) => {
    if (
      JSON_METHODS.has(c.req.method) &&
      !c.req.header("Content-Type")?.startsWith("application/json")
    ) {
      return jsonApiError(
        c,
        415,
        "unsupported_media_type",
        "Send a JSON body with Content-Type: application/json.",
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
            new HttpError({
              status: 503,
              code: "database_unavailable",
              message: "Database unavailable.",
            }),
        }),
        Effect.map(() => ({ ok: true })),
      ),
    ),
  );

  app.route(
    "/api",
    createWishlistApi({
      service,
      clientIp,
      limiters,
      turnstile:
        turnstileSecret === undefined
          ? undefined
          : { secret: turnstileSecret, hostname: turnstileHostname },
    }),
  );

  return app;
}
