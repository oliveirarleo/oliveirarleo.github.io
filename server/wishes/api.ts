import { Effect, Schema } from "effect";
import type { Context } from "hono";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ApiErrorCode } from "../../shared/api-errors.ts";
import { asHttpError, HttpError, jsonApiError } from "../http.ts";
import type { RateLimiter } from "../rate-limit.ts";
import { verifyTurnstile } from "../turnstile.ts";
import { validUserSecret } from "../user-secrets.ts";
import {
  reactionInputSchema,
  sessionInputSchema,
  wishInputSchema,
  wishUpdateSchema,
} from "../validation.ts";
import type { WishlistService } from "./service.ts";

export interface WishlistApiDeps {
  service: WishlistService;
  clientIp: (c: Context) => string;
  limiters: {
    add: RateLimiter;
    edit: RateLimiter;
    react: RateLimiter;
    assume: RateLimiter;
    remove: RateLimiter;
    globalAssume: RateLimiter;
  };
  turnstile?: { secret: string; hostname: string } | undefined;
}

const bearerToken = (header: string | undefined) => {
  const match = /^Bearer\s+(\S+)$/i.exec(header ?? "");
  return match?.[1];
};

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function createWishlistApi(deps: WishlistApiDeps) {
  const { service, limiters } = deps;
  const api = new Hono();

  const invalid = (message: string, code: ApiErrorCode = "invalid_request") =>
    new HttpError({ status: 400, code, message });

  const take = (limiter: RateLimiter, key: string, message: string) => {
    if (!limiter.take(key)) {
      throw new HttpError({ status: 429, code: "rate_limited", message });
    }
  };

  async function readJson(c: Context): Promise<unknown> {
    try {
      return await c.req.json();
    } catch {
      throw new HttpError({
        status: 400,
        code: "invalid_json",
        message: "Send a valid JSON body.",
      });
    }
  }

  function decode<S extends Schema.ConstraintDecoder<unknown>>(
    schema: S,
    value: unknown,
    message: string,
  ): S["Type"] {
    try {
      return Schema.decodeUnknownSync(schema)(value);
    } catch {
      throw invalid(message);
    }
  }

  function requireSession(c: Context) {
    const token = bearerToken(c.req.header("Authorization"));
    if (!token) {
      throw new HttpError({
        status: 401,
        code: "session_expired",
        message: "Use your secret to manage wishes.",
      });
    }
    return token;
  }

  async function requireTurnstile(token: string, ip: string) {
    if (!deps.turnstile) return;
    await Effect.runPromise(
      verifyTurnstile(
        token,
        ip,
        deps.turnstile.secret,
        deps.turnstile.hostname,
      ),
    );
  }

  /** Runs a handler and maps both success and failure onto the wire contract. */
  async function handle<A>(
    c: Context,
    run: () => Promise<A>,
    successStatus: ContentfulStatusCode = 200,
  ) {
    try {
      return c.json(await run(), successStatus);
    } catch (error) {
      const http = asHttpError(error);
      return jsonApiError(c, http.status, http.code, http.message);
    }
  }

  api.get("/wishes", (c) => {
    const requestedLimit = Number(c.req.query("limit") ?? "500");
    const requestedOffset = Number(c.req.query("offset") ?? "0");
    if (
      !Number.isInteger(requestedLimit) ||
      requestedLimit < 1 ||
      requestedLimit > 1000 ||
      !Number.isInteger(requestedOffset) ||
      requestedOffset < 0
    ) {
      return jsonApiError(
        c,
        400,
        "invalid_request",
        "Limit must be 1–1000 and offset must be a non-negative integer.",
      );
    }
    return handle(c, async () => ({
      wishes: await service.list(requestedLimit, requestedOffset),
      limit: requestedLimit,
      offset: requestedOffset,
    }));
  });

  api.post("/wishes", (c) =>
    handle(
      c,
      async () => {
        const ip = deps.clientIp(c);
        take(
          limiters.add,
          `add:${ip}`,
          "Too many wishes. Please try again later.",
        );
        take(
          limiters.globalAssume,
          "assume:global",
          "Too many wishes. Please try again later.",
        );
        const sessionToken = bearerToken(c.req.header("Authorization"));
        const input = decode(
          wishInputSchema,
          await readJson(c),
          "Check the author, wish, link, and verification fields.",
        );
        await requireTurnstile(input.turnstileToken, ip);
        return service.createWish({ ...input, sessionToken });
      },
      201,
    ),
  );

  api.patch("/wishes/:id", (c) =>
    handle(c, async () => {
      const sessionToken = requireSession(c);
      take(
        limiters.edit,
        `edit:${deps.clientIp(c)}`,
        "Too many changes. Please try again later.",
      );
      const input = decode(
        wishUpdateSchema,
        await readJson(c),
        "Check the wish name and link.",
      );
      return {
        wish: await service.updateWish(c.req.param("id"), sessionToken, input),
      };
    }),
  );

  api.delete("/wishes/:id", (c) =>
    handle(c, async () => {
      const ip = deps.clientIp(c);
      take(
        limiters.remove,
        `delete:${ip}`,
        "Too many changes. Please try again later.",
      );
      take(
        limiters.globalAssume,
        "assume:global",
        "Too many changes. Please try again later.",
      );
      return service.remove(c.req.param("id"), requireSession(c));
    }),
  );

  api.put("/wishes/:id/reaction", (c) =>
    handle(c, async () => {
      const sessionToken = requireSession(c);
      take(
        limiters.react,
        `react:${deps.clientIp(c)}`,
        "Too many reactions. Please try again later.",
      );
      const input = decode(
        reactionInputSchema,
        await readJson(c),
        "Choose one of the available reactions.",
      );
      return {
        wish: await service.setReaction(
          c.req.param("id"),
          sessionToken,
          input.emoji,
        ),
      };
    }),
  );

  api.delete("/wishes/:id/reaction", (c) =>
    handle(c, async () => {
      const sessionToken = requireSession(c);
      take(
        limiters.react,
        `react:${deps.clientIp(c)}`,
        "Too many reactions. Please try again later.",
      );
      return {
        wish: await service.clearReaction(c.req.param("id"), sessionToken),
      };
    }),
  );

  api.post("/session", (c) =>
    handle(c, async () => {
      const ip = deps.clientIp(c);
      take(
        limiters.assume,
        `assume:${ip}`,
        "Too many attempts. Please try again later.",
      );
      take(
        limiters.globalAssume,
        "assume:global",
        "Too many attempts. Please try again later.",
      );
      const input = decode(
        sessionInputSchema,
        await readJson(c),
        "A name and user secret are required.",
      );
      await requireTurnstile(input.turnstileToken ?? "", ip);
      return service.assume(input.name, input.secret);
    }),
  );

  api.post("/session/rotate", (c) =>
    handle(c, async () => {
      const ip = deps.clientIp(c);
      take(
        limiters.assume,
        `assume:${ip}`,
        "Too many attempts. Please try again later.",
      );
      take(
        limiters.globalAssume,
        "assume:global",
        "Too many attempts. Please try again later.",
      );
      const body = await readJson(c);
      if (!isJsonObject(body))
        throw invalid("Send a valid JSON body.", "invalid_json");
      const currentSecret =
        typeof body.currentSecret === "string" ? body.currentSecret : "";
      const sessionToken = bearerToken(c.req.header("Authorization"));
      if (!sessionToken || !validUserSecret(currentSecret)) {
        throw new HttpError({
          status: 401,
          code: "wrong_secret",
          message: "A valid user secret is required.",
        });
      }
      await requireTurnstile(
        typeof body.turnstileToken === "string" ? body.turnstileToken : "",
        ip,
      );
      return service.rotate({ sessionToken, currentSecret });
    }),
  );

  return api;
}
