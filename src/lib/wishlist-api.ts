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
}

interface CreateWishResponse {
  wish: Wish;
  user: WishlistUser;
  /** Returned once, when a new name is registered, with its session. */
  secret?: string;
  sessionToken?: string;
}

interface AssumeResponse {
  user: WishlistUser;
  sessionToken: string;
}

interface RotateResponse {
  user: WishlistUser;
  secret: string;
  sessionToken: string;
}

/** A failed API call. Keeps the HTTP status so a rejected session can be told apart. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** True when the server rejected the bearer session, so the stored token is dead. */
export function isSessionRejection(error: unknown) {
  return error instanceof ApiError && error.status === 401;
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
        throw new ApiError(
          payload.error ?? "Something went wrong. Please try again.",
          response.status,
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
    sessionToken?: string,
  ): RequestInit => ({
    method,
    headers: {
      "Content-Type": "application/json",
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  return {
    list: () => request<{ wishes: Wish[] }>("/api/wishes"),
    create: (input: CreateWishInput & { sessionToken?: string }) => {
      const { sessionToken, ...body } = input;
      return request<CreateWishResponse>(
        "/api/wishes",
        json("POST", body, sessionToken),
      );
    },
    assume: (name: string, secret: string, turnstileToken: string) =>
      request<AssumeResponse>(
        "/api/session",
        json("POST", { name, secret, turnstileToken }),
      ),
    remove: (wish: Wish, sessionToken: string) =>
      request<{ ok: true }>(
        `/api/wishes/${encodeURIComponent(wish.id)}`,
        json("DELETE", undefined, sessionToken),
      ),
    rotate: ({
      sessionToken,
      currentSecret,
      turnstileToken,
    }: {
      sessionToken: string;
      currentSecret: string;
      turnstileToken: string;
    }) =>
      request<RotateResponse>(
        "/api/session/rotate",
        json("POST", { currentSecret, turnstileToken }, sessionToken),
      ),
  };
}
