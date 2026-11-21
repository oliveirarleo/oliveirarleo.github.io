/**
 * Stable error codes shared by the API and the browser.
 *
 * Codes carry the meaning; the HTTP status and message are for transport and
 * display. The client decides what to do from the code, never from the status.
 */
export const API_ERROR_CODES = [
  "internal",
  "not_found",
  "invalid_json",
  "invalid_request",
  "invalid_link",
  "invalid_reaction",
  "session_expired",
  "wrong_secret",
  "name_taken",
  "wishlist_full",
  "wish_not_found",
  "rate_limited",
  "turnstile_failed",
  "turnstile_unavailable",
  "payload_too_large",
  "unsupported_media_type",
  "database_unavailable",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

const errorCodes: ReadonlySet<string> = new Set(API_ERROR_CODES);

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === "string" && errorCodes.has(value);
}
