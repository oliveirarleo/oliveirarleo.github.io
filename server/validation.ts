import { Schema } from "effect";

const trimmedString = (maximum: number) =>
  Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(maximum));

export const wishInputSchema = Schema.Struct({
  author: trimmedString(60),
  name: trimmedString(120),
  link: trimmedString(2000),
  turnstileToken: Schema.String.check(Schema.isMaxLength(4096)),
});

export const deleteWishSchema = Schema.Struct({
  deleteToken: Schema.NonEmptyString.check(Schema.isMaxLength(4096)),
});

export function validWebUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}
