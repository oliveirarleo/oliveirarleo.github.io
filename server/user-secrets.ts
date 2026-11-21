import {
  createHmac,
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeUserSecret(value: string) {
  return value.trim().toUpperCase();
}

export function validUserSecret(value: string) {
  return /^[A-Z2-9]{6}$/.test(normalizeUserSecret(value));
}

export function createUserSecret() {
  return Array.from(
    { length: 6 },
    () => alphabet[randomInt(alphabet.length)],
  ).join("");
}

export function secretLookup(secret: string, pepper: string) {
  return createHmac("sha256", pepper)
    .update(normalizeUserSecret(secret))
    .digest("hex");
}

export async function hashUserSecret(secret: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(normalizeUserSecret(secret), salt, 32)) as Buffer;
  return { salt, hash: hash.toString("hex") };
}

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
