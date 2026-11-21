import { expect, it } from "vitest";
import {
  clearSession,
  forgetUser,
  normalizeUserSecret,
  parseStore,
  readUserSecrets,
  STORAGE_KEY,
  syncUserSecrets,
  validUserSecret,
  writeUserSecrets,
} from "./user-secrets.ts";

const stored = {
  id: "user-1",
  name: "Leo",
  secret: "ABC234",
  sessionToken: "token-1",
};

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: (key: string) => (key === STORAGE_KEY ? value : null),
    setItem: (key: string, next: string) => {
      if (key === STORAGE_KEY) value = next;
    },
  };
}

it("secrets are normalized and validated", () => {
  expect(normalizeUserSecret("  abc234 ")).toBe("ABC234");
  expect(validUserSecret("abc234")).toBe(true);
  expect(validUserSecret("ABC23")).toBe(false);
  expect(validUserSecret("ABC0O1")).toBe(false);
  expect(validUserSecret("ABC-23")).toBe(false);
});

it("round-trips a store through storage", () => {
  const storage = memoryStorage();
  const store = {
    activeUserId: "user-1",
    users: { "user-1": stored },
  };
  writeUserSecrets(store, storage);
  expect(readUserSecrets(storage)).toEqual(store);
});

it("keeps users without a session token but drops invalid secrets", () => {
  const parsed = parseStore({
    activeUserId: "user-1",
    users: {
      "user-1": { ...stored, sessionToken: undefined },
      "user-2": { ...stored, id: "user-2", secret: "bad" },
      "user-3": { ...stored, id: "user-3" },
    },
  });
  expect(Object.keys(parsed.users)).toEqual(["user-1", "user-3"]);
  expect(parsed.users["user-1"]?.sessionToken).toBe(null);
  expect(parsed.activeUserId).toBe("user-1");
});

it("corrupt storage falls back to an empty store", () => {
  expect(readUserSecrets(memoryStorage("{not json"))).toEqual({
    activeUserId: null,
    users: {},
  });
});

it("cross-tab storage events only apply to the vault key", () => {
  expect(syncUserSecrets({ key: "unrelated", newValue: "{}" })).toBe(null);
  const next = syncUserSecrets({
    key: STORAGE_KEY,
    newValue: JSON.stringify({
      activeUserId: "user-1",
      users: { "user-1": stored },
    }),
  });
  expect(next?.activeUserId).toBe("user-1");
});

it("an expired session keeps the secret and clears only the token", () => {
  const other = {
    ...stored,
    id: "user-2",
    name: "Ana",
    sessionToken: "token-2",
  };
  const store = {
    activeUserId: "user-1",
    users: { "user-1": stored, "user-2": other },
  };
  expect(clearSession(store, "user-1")).toEqual({
    activeUserId: "user-1",
    users: {
      "user-1": { ...stored, sessionToken: null },
      "user-2": other,
    },
  });
});

it("a rejected session forgets its user and clears it as the active user", () => {
  const other = {
    ...stored,
    id: "user-2",
    name: "Ana",
    sessionToken: "token-2",
  };
  const store = {
    activeUserId: "user-1",
    users: { "user-1": stored, "user-2": other },
  };
  expect(forgetUser(store, "user-1")).toEqual({
    activeUserId: null,
    users: { "user-2": other },
  });
});

it("forgetting a user that is not active keeps the active user", () => {
  const other = {
    ...stored,
    id: "user-2",
    name: "Ana",
    sessionToken: "token-2",
  };
  const store = {
    activeUserId: "user-2",
    users: { "user-1": stored, "user-2": other },
  };
  expect(forgetUser(store, "user-1")).toEqual({
    activeUserId: "user-2",
    users: { "user-2": other },
  });
});
