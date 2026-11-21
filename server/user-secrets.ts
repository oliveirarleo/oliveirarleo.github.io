import {
  createHmac,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import {
  SECRET_ALPHABET,
  SECRET_LENGTH,
  normalizeUserSecret,
} from "../shared/user-secrets.ts";

const scrypt = promisify(scryptCallback);

// The user secret is also the Better Auth password (see ADR 0001). The shape
// rules live in shared/user-secrets.ts so the browser cannot drift from the API.
export {
  normalizeUserSecret,
  SECRET_LENGTH,
  validUserSecret,
} from "../shared/user-secrets.ts";

/**
 * Pre-ADR-0001 lookup key: an HMAC of the normalized secret with the server
 * pepper, so the store never needs the plaintext to find a row.
 */
export function secretLookup(secret: string, pepper: string) {
  return createHmac("sha256", pepper)
    .update(normalizeUserSecret(secret))
    .digest("hex");
}

/** Verifies a secret against the scrypt hash written before the Better Auth migration. */
export async function verifyUserSecret(
  secret: string,
  salt: string,
  expectedHex: string,
) {
  const actual = (await scrypt(
    normalizeUserSecret(secret),
    salt,
    32,
  )) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Generates a secret with `randomInt`, so the alphabet is sampled without modulo bias. */
export function createUserSecret() {
  let secret = "";
  for (let index = 0; index < SECRET_LENGTH; index += 1) {
    secret += SECRET_ALPHABET.charAt(randomInt(SECRET_ALPHABET.length));
  }
  return secret;
}
