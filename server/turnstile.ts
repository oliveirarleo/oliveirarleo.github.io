import { Effect, pipe } from "effect";
import { HttpError, jsonError } from "./http.ts";

interface TurnstileResponse {
  success: boolean;
  action?: string;
  hostname?: string;
}

export const verifyTurnstile = (
  token: string,
  ip: string,
  secret: string,
  expectedHostname: string,
) =>
  pipe(
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              secret,
              response: token,
              remoteip: ip,
            }),
            signal: AbortSignal.timeout(10_000),
          },
        );
        return (await response.json()) as TurnstileResponse;
      },
      catch: () =>
        new HttpError({
          status: 502,
          code: "turnstile_unavailable",
          message: "Verification is temporarily unavailable.",
        }),
    }),
    Effect.flatMap((result) =>
      result.success &&
      result.action === "wishlist" &&
      result.hostname === expectedHostname
        ? Effect.void
        : jsonError(
            400,
            "turnstile_failed",
            "Verification failed. Please try again.",
          ),
    ),
  );
