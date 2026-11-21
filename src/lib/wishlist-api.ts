export interface Wish {
  id: string;
  userId: string;
  author: string;
  name: string;
  link: string;
  createdAt: string;
}

export interface WishlistUser {
  id: string;
  name: string;
}

export interface CreateWishInput {
  author: string;
  name: string;
  link: string;
  turnstileToken: string;
  secret?: string;
}

export interface CreateWishResponse {
  wish: Wish;
  user: WishlistUser;
  secret?: string;
}

export function createWishlistApi(baseUrl: string) {
  const apiUrl = baseUrl.replace(/\/$/, "");

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    try {
      const response = await fetch(`${apiUrl}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => ({}))) as T & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(
          payload.error ?? "Something went wrong. Please try again.",
        );
      return payload;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(
          "The server took too long to respond. Please try again.",
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  const json = (
    method: string,
    body: unknown,
    secret?: string,
  ): RequestInit => ({
    method,
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "X-Wishlist-Secret": secret } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  return {
    list: () => request<{ wishes: Wish[] }>("/api/wishes"),
    create: (input: CreateWishInput) =>
      request<CreateWishResponse>("/api/wishes", json("POST", input)),
    assume: (secret: string, turnstileToken: string) =>
      request<{ user: WishlistUser }>(
        "/api/session",
        json("POST", { secret, turnstileToken }),
      ),
    remove: (wish: Wish, secret: string) =>
      request<{ ok: true }>(
        `/api/wishes/${encodeURIComponent(wish.id)}`,
        json("DELETE", undefined, secret),
      ),
    rotate: (secret: string) =>
      request<{ user: WishlistUser; secret: string }>(
        "/api/session/rotate",
        json("POST", {}, secret),
      ),
  };
}
