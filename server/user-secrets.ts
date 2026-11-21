import { randomInt } from "node:crypto";
import { SECRET_ALPHABET, SECRET_LENGTH } from "../shared/user-secrets.ts";

// The user secret is also the Better Auth password (see ADR 0001). The shape
// rules live in shared/user-secrets.ts so the browser cannot drift from the API.
export {
  normalizeUserSecret,
  SECRET_LENGTH,
  validUserSecret,
} from "../shared/user-secrets.ts";

/** Generates a secret with `randomInt`, so the alphabet is sampled without modulo bias. */
export function createUserSecret() {
  let secret = "";
  for (let index = 0; index < SECRET_LENGTH; index += 1) {
    secret += SECRET_ALPHABET.charAt(randomInt(SECRET_ALPHABET.length));
  }
  return secret;
}
