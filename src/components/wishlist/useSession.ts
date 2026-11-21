import { createMemo, createSignal, onCleanup, onMount } from "solid-js";
import type { StoredUser, UserSecretStore } from "../../lib/user-secrets";
import {
  clearSession,
  forgetUser,
  normalizeUserSecret,
  readUserSecrets,
  syncUserSecrets,
  writeUserSecrets,
} from "../../lib/user-secrets";
import {
  isSessionRejection,
  type WishlistApi,
  type WishlistUser,
} from "../../lib/wishlist-api";
import type { Notice, NoticeTone } from "./notice";

export const SESSION_ENDED_MESSAGE =
  "Your session has ended. Enter your user secret again to keep managing your wishes.";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/**
 * The browser's identity module: the vault of known users, the active user,
 * and the session lifecycle. It owns `notice` for session-level messages.
 */
export function useSession(api: WishlistApi) {
  const [store, setStore] = createSignal<UserSecretStore>({
    activeUserId: null,
    users: {},
  });
  const [notice, setNotice] = createSignal<Notice | null>(null);
  const activeUser = createMemo<StoredUser | null>(() => {
    const current = store();
    return current.activeUserId
      ? (current.users[current.activeUserId] ?? null)
      : null;
  });

  function report(message: string, tone: NoticeTone = "info") {
    setNotice(message ? { text: message, tone } : null);
  }

  function clearNotice() {
    setNotice(null);
  }

  function updateStore(next: UserSecretStore) {
    setStore(next);
    writeUserSecrets(next);
  }

  /** Returns the user's session token, or prompts to sign in again when it is gone. */
  function sessionTokenFor(user: StoredUser): string | null {
    if (user.sessionToken) return user.sessionToken;
    report(SESSION_ENDED_MESSAGE, "error");
    return null;
  }

  /**
   * Reports a failed call. A rejected session clears that token but keeps the
   * secret, so the owner can enter it again from "Code". A wrong secret is a
   * different code, so rotation no longer needs a special case.
   */
  function fail(user: StoredUser | null, error: unknown, fallback: string) {
    if (user && isSessionRejection(error)) {
      updateStore(clearSession(store(), user.id));
      report(SESSION_ENDED_MESSAGE, "error");
      return;
    }
    report(errorMessage(error, fallback), "error");
  }

  function remember(
    user: WishlistUser,
    secret: string,
    sessionToken: string | null,
  ) {
    const current = store();
    updateStore({
      activeUserId: user.id,
      users: {
        ...current.users,
        [user.id]: { ...user, secret, sessionToken },
      },
    });
  }

  async function assume(name: string, secret: string, turnstileToken: string) {
    try {
      const result = await api.assume(name, secret, turnstileToken);
      remember(result.user, normalizeUserSecret(secret), result.sessionToken);
      report(`You are now managing ${result.user.name}’s wishes.`);
      return true;
    } catch (error) {
      report(errorMessage(error, "Could not use that secret."), "error");
      return false;
    }
  }

  async function rotate(turnstileToken: string) {
    const user = activeUser();
    if (!user) return false;
    const sessionToken = sessionTokenFor(user);
    if (!sessionToken) return false;
    try {
      const result = await api.rotate({
        sessionToken,
        currentSecret: user.secret,
        turnstileToken,
      });
      remember(result.user, result.secret, result.sessionToken);
      report("Secret rotated. Select Code to view the new secret.", "success");
      return true;
    } catch (error) {
      fail(user, error, "Could not rotate the secret.");
      return false;
    }
  }

  function switchUser() {
    updateStore({ ...store(), activeUserId: null });
    report("Choose a saved user or enter another secret.");
  }

  function selectUser(userId: string) {
    const user = store().users[userId];
    if (!user) return;
    updateStore({ ...store(), activeUserId: userId });
    report(`You are now managing ${user.name}’s wishes.`);
  }

  function forget() {
    const user = activeUser();
    if (!user) return;
    updateStore(forgetUser(store(), user.id));
    report("This device has forgotten that user secret.");
  }

  onMount(() => {
    setStore(readUserSecrets());
    const onStorage = (event: StorageEvent) => {
      const next = syncUserSecrets(event);
      if (next) setStore(next);
    };
    window.addEventListener("storage", onStorage);
    onCleanup(() => window.removeEventListener("storage", onStorage));
  });

  return {
    activeUser,
    knownUsers: createMemo(() =>
      Object.values(store().users).filter((user) => user.sessionToken),
    ),
    notice,
    report,
    clearNotice,
    fail,
    remember,
    sessionTokenFor,
    assume,
    rotate,
    switchUser,
    selectUser,
    forget,
  };
}

export type WishlistSession = ReturnType<typeof useSession>;
