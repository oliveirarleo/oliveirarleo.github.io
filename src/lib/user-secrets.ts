import {
  normalizeUserSecret,
  validUserSecret,
} from "../../shared/user-secrets.ts";
import type { WishlistUser } from "./wishlist-api";

// The secret rules are shared with the API, so the browser and server cannot drift.
export * from "../../shared/user-secrets.ts";

/**
 * Per-browser vault of users this device can manage. The secret is kept so
 * the owner can show it again ("Code"); the session token authorizes requests.
 * Plain localStorage is a deliberate trade-off — see docs/adr/0001.
 */
export interface StoredUser extends WishlistUser {
  secret: string;
  /** Null once the server rejects the session; the secret is kept for re-entry. */
  sessionToken: string | null;
}

export interface UserSecretStore {
  activeUserId: string | null;
  users: Record<string, StoredUser>;
}

export const STORAGE_KEY = "wishlist-user-secrets-v1";
const emptyStore = (): UserSecretStore => ({ activeUserId: null, users: {} });

/** Parses untrusted storage contents, dropping anything malformed. */
export function parseStore(value: unknown): UserSecretStore {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return emptyStore();
  const candidate = value as Partial<UserSecretStore>;
  const users: Record<string, StoredUser> = {};
  if (
    candidate.users &&
    typeof candidate.users === "object" &&
    !Array.isArray(candidate.users)
  ) {
    for (const [id, user] of Object.entries(candidate.users)) {
      if (
        user &&
        typeof user.id === "string" &&
        user.id === id &&
        typeof user.name === "string" &&
        typeof user.secret === "string" &&
        validUserSecret(user.secret)
      ) {
        users[id] = {
          id,
          name: user.name,
          secret: normalizeUserSecret(user.secret),
          sessionToken:
            typeof user.sessionToken === "string" &&
            user.sessionToken.length > 0
              ? user.sessionToken
              : null,
        };
      }
    }
  }
  const activeUserId =
    typeof candidate.activeUserId === "string" && users[candidate.activeUserId]
      ? candidate.activeUserId
      : null;
  return { activeUserId, users };
}

export function readUserSecrets(
  storage: Pick<Storage, "getItem"> = localStorage,
): UserSecretStore {
  try {
    return parseStore(JSON.parse(storage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return emptyStore();
  }
}

export function writeUserSecrets(
  store: UserSecretStore,
  storage: Pick<Storage, "setItem"> = localStorage,
) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // The in-memory session remains usable when storage is unavailable.
  }
}

/**
 * Drops a user entirely, including their secret (the explicit "Forget" action).
 */
export function forgetUser(
  store: UserSecretStore,
  userId: string,
): UserSecretStore {
  const users = { ...store.users };
  delete users[userId];
  return {
    activeUserId: store.activeUserId === userId ? null : store.activeUserId,
    users,
  };
}

/**
 * Clears a rejected session token but keeps the secret, so the owner can enter
 * it again (or view it via "Code") instead of losing their only copy.
 */
export function clearSession(
  store: UserSecretStore,
  userId: string,
): UserSecretStore {
  const user = store.users[userId];
  if (!user) return store;
  return {
    activeUserId: store.activeUserId,
    users: { ...store.users, [userId]: { ...user, sessionToken: null } },
  };
}

/** Applies a cross-tab `storage` event, or returns null if it is unrelated. */
export function syncUserSecrets(event: Pick<StorageEvent, "key" | "newValue">) {
  if (event.key !== STORAGE_KEY) return null;
  try {
    return parseStore(JSON.parse(event.newValue ?? "null"));
  } catch {
    return emptyStore();
  }
}
