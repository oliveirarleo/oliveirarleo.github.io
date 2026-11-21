import { Schema } from "effect";

const trimmedString = (maximum: number) =>
  Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(maximum));

const optionalSecret = Schema.optional(
  Schema.String.check(Schema.isMaxLength(64)),
);

export const wishInputSchema = Schema.Struct({
  author: trimmedString(60),
  name: trimmedString(120),
  link: trimmedString(2000),
  turnstileToken: Schema.String.check(Schema.isMaxLength(4096)),
  secret: optionalSecret,
});

export const sessionInputSchema = Schema.Struct({
  secret: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(64)),
  turnstileToken: Schema.optional(
    Schema.String.check(Schema.isMaxLength(4096)),
  ),
});

export function normalizeWebUrl(value: string) {
  try {
    const url = new URL(value.trim());
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username !== "" ||
      url.password !== ""
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}
