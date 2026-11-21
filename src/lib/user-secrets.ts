import type { WishlistUser } from "./wishlist-api";

export interface StoredUser extends WishlistUser {
  secret: string;
}

export interface UserSecretStore {
  activeUserId: string | null;
  users: Record<string, StoredUser>;
}

const STORAGE_KEY = "wishlist-user-secrets-v1";
const emptyStore = (): UserSecretStore => ({ activeUserId: null, users: {} });

export function normalizeUserSecret(secret: string) {
  return secret.trim().toUpperCase();
}

export function validUserSecret(secret: string) {
  return /^[A-Z2-9]{6}$/.test(normalizeUserSecret(secret));
}

function parseStore(value: unknown): UserSecretStore {
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
    // The current in-memory session remains usable when storage is unavailable.
  }
}

export function syncUserSecrets(event: StorageEvent) {
  if (event.key !== STORAGE_KEY) return null;
  try {
    return parseStore(JSON.parse(event.newValue ?? "null"));
  } catch {
    return emptyStore();
  }
}
