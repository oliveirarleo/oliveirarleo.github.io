import { pino } from "pino";

export const logger = pino({
  base: null,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "secret",
      "password",
      "authSecret",
      "req.headers.authorization",
      "headers.authorization",
      "err.config.BETTER_AUTH_SECRET",
      "err.config.TURNSTILE_SECRET",
    ],
    censor: "[Redacted]",
  },
});
