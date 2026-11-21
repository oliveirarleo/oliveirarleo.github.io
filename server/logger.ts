import { pino } from "pino";

export const logger = pino({
  base: null,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "secret",
      "secretPepper",
      "authSecret",
      "req.headers.x-wishlist-secret",
      "headers.x-wishlist-secret",
      "err.config.BETTER_AUTH_SECRET",
      "err.config.WISHLIST_SECRET_PEPPER",
      "err.config.TURNSTILE_SECRET",
    ],
    censor: "[Redacted]",
  },
});
