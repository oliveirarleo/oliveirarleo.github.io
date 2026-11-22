import { pino } from "pino";

// Test output should read as assertions, not as server traffic. Setting
// LOG_LEVEL (e.g. LOG_LEVEL=info) while running a single test brings the logs
// back for debugging.
const enabled =
  process.env.NODE_ENV !== "test" || Boolean(process.env.LOG_LEVEL);

export const logger = pino({
  enabled,
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
