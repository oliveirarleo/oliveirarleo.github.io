import type { ApiErrorCode } from "../../shared/api-errors.ts";
import { isApiErrorCode } from "../../shared/api-errors.ts";
import type { Reaction } from "../../shared/reactions.ts";

export interface WishReaction {
  emoji: Reaction;
  userIds: string[];
}

export interface Wish {
  id: string;
  userId: string;
  author: string;
  name: string;
  link: string;
  createdAt: string;
  /** Null until the owner first edits the wish. */
  updatedAt: string | null;
  /** One summary per emoji currently in use. */
  reactions: WishReaction[];
}

export interface WishlistUser {
  id: string;
  name: string;
}

export interface WishDraft {
  name: string;
  link: string;
}

export interface CreateWishInput extends WishDraft {
  author: string;
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

interface WishResponse {
  wish: Wish;
}

/** A failed API call. Keeps the stable code and the HTTP status. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;

  constructor(message: string, status: number, code: ApiErrorCode) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * True only when the server rejected the bearer session. Using the error code
 * (not the status) leaves 401 free for a wrong secret during rotation.
 */
export function isSessionRejection(error: unknown) {
  return error instanceof ApiError && error.code === "session_expired";
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
        error?: { code?: unknown; message?: unknown };
      };
      if (!response.ok) {
        const failure = payload.error;
        throw new ApiError(
          typeof failure?.message === "string"
            ? failure.message
            : "Something went wrong. Please try again.",
          response.status,
          isApiErrorCode(failure?.code) ? failure.code : "internal",
        );
      }
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
    list: (limit = 500) =>
      request<{ wishes: Wish[] }>(
        `/api/wishes?limit=${encodeURIComponent(String(limit))}`,
      ),
    create: (input: CreateWishInput & { sessionToken?: string }) => {
      const { sessionToken, ...body } = input;
      return request<CreateWishResponse>(
        "/api/wishes",
        json("POST", body, sessionToken),
      );
    },
    update: (wishId: string, draft: WishDraft, sessionToken: string) =>
      request<WishResponse>(
        `/api/wishes/${encodeURIComponent(wishId)}`,
        json("PATCH", draft, sessionToken),
      ),
    remove: (wishId: string, sessionToken: string) =>
      request<{ ok: true }>(
        `/api/wishes/${encodeURIComponent(wishId)}`,
        json("DELETE", undefined, sessionToken),
      ),
    setReaction: (wishId: string, emoji: Reaction, sessionToken: string) =>
      request<WishResponse>(
        `/api/wishes/${encodeURIComponent(wishId)}/reaction`,
        json("PUT", { emoji }, sessionToken),
      ),
    clearReaction: (wishId: string, sessionToken: string) =>
      request<WishResponse>(
        `/api/wishes/${encodeURIComponent(wishId)}/reaction`,
        json("DELETE", undefined, sessionToken),
      ),
    assume: (name: string, secret: string, turnstileToken: string) =>
      request<AssumeResponse>(
        "/api/session",
        json("POST", { name, secret, turnstileToken }),
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

export type WishlistApi = ReturnType<typeof createWishlistApi>;
