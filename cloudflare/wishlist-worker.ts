/**
 * Cloudflare Worker for wishlist.oliveirarleo.com.
 *
 * GitHub Pages serves the wishlist at /wishlist/ on the main domain. This
 * worker keeps the subdomain URL while proxying page and asset requests to
 * the existing GitHub Pages site.
 *
 * Route: wishlist.oliveirarleo.com/*
 * Origin: https://oliveirarleo.com
 */
export default {
  async fetch(request: Request): Promise<Response> {
    const incoming = new URL(request.url);
    const target = new URL(request.url);

    target.hostname = "oliveirarleo.com";
    if (incoming.pathname === "/") target.pathname = "/wishlist/";

    const headers = new Headers(request.headers);
    headers.delete("host");

    return fetch(
      new Request(target, {
        method: request.method,
        headers,
        body: request.body,
        redirect: "manual",
      }),
    );
  },
};
