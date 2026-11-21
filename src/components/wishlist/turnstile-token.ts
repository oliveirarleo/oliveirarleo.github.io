import type { TurnstileFieldHandle } from "./TurnstileField";

/** Reads the widget token, or "" when Turnstile is not configured for this build. */
export function readTurnstileToken(
  siteKey: string | undefined,
  field: TurnstileFieldHandle | undefined,
) {
  return siteKey ? (field?.token() ?? "") : "";
}

/** True when Turnstile is configured but the widget has not produced a token. */
export function turnstileTokenMissing(
  siteKey: string | undefined,
  token: string,
) {
  return Boolean(siteKey) && !token;
}
