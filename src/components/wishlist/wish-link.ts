export const INVALID_LINK_MESSAGE =
  "Enter a valid http or https link without credentials.";

/** The browser-side mirror of the server's link rule. */
export function validWishLink(value: string) {
  try {
    const url = new URL(value.trim());
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}
