import { APIError } from "better-auth";
import { expect, it } from "vitest";
import type { createAuth } from "../auth.ts";
import { HttpError } from "../http.ts";
import type { WishlistRepository } from "./repository.ts";
import { createWishlistService } from "./service.ts";

type Auth = ReturnType<typeof createAuth>;

// Better Auth is an external collaborator, so these stubs only choose the error
// it throws. The repository is unused by the sign-in and rotation paths.
const unusedRepository = {} as WishlistRepository;
const session = { user: { id: "user-1", name: "Leo", displayUsername: "Leo" } };

function serviceWithAuth(api: Partial<Auth["api"]>) {
  return createWishlistService(unusedRepository, { api } as unknown as Auth);
}

function invalidCredentials(code: string) {
  return new APIError("UNAUTHORIZED", {
    code,
    message: "Invalid username or password",
  });
}

it("assume maps invalid credentials to 401", async () => {
  const service = serviceWithAuth({
    signInUsername: async () => {
      throw invalidCredentials("INVALID_USERNAME_OR_PASSWORD");
    },
  } as unknown as Partial<Auth["api"]>);
  await expect(service.assume("Leo", "AAAAAA")).rejects.toSatisfy((error) => {
    expect(error instanceof HttpError).toBeTruthy();
    expect(error.status).toBe(401);
    return true;
  });
});

it("assume lets unexpected failures propagate instead of reporting 401", async () => {
  const failure = new Error("database is locked");
  const service = serviceWithAuth({
    signInUsername: async () => {
      throw failure;
    },
  } as unknown as Partial<Auth["api"]>);
  await expect(service.assume("Leo", "AAAAAA")).rejects.toBe(failure);
});

it("rotate maps an incorrect current secret to 401", async () => {
  const service = serviceWithAuth({
    getSession: async () => session,
    changePassword: async () => {
      throw new APIError("BAD_REQUEST", {
        code: "INVALID_PASSWORD",
        message: "Invalid password",
      });
    },
  } as unknown as Partial<Auth["api"]>);
  await expect(
    service.rotate({ sessionToken: "token", currentSecret: "AAAAAA" }),
  ).rejects.toSatisfy((error) => {
    expect(error instanceof HttpError).toBeTruthy();
    expect(error.status).toBe(401);
    return true;
  });
});

it("rotate lets unexpected failures propagate instead of reporting 401", async () => {
  const failure = new Error("database is locked");
  const service = serviceWithAuth({
    getSession: async () => session,
    changePassword: async () => {
      throw failure;
    },
  } as unknown as Partial<Auth["api"]>);
  await expect(
    service.rotate({ sessionToken: "token", currentSecret: "AAAAAA" }),
  ).rejects.toBe(failure);
});
