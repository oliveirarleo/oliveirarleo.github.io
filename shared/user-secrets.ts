/**
 * Secret rules shared by the API and the browser. No Node built-ins live here,
 * so the frontend can import this module directly (see ADR 0001).
 */

/** Symbols in a user secret. Better Auth's minimum password length uses it too. */
export const SECRET_LENGTH = 6;

/**
 * 34 symbols: A–Z plus digits 2–9 (no 0 or 1, to avoid ambiguity).
 * 34^6 is about 1.54 billion secrets, roughly 30.5 bits.
 */
export const SECRET_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789";

/** Unanchored character class; the HTML input pattern and the validator both use it. */
export const SECRET_PATTERN = `[${SECRET_ALPHABET}]{${SECRET_LENGTH}}`;

const secretRegExp = new RegExp(`^${SECRET_PATTERN}$`);

export function normalizeUserSecret(value: string) {
  return value.trim().toUpperCase();
}

export function validUserSecret(value: string) {
  return secretRegExp.test(normalizeUserSecret(value));
}
