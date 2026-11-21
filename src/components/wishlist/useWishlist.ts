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
import type {
  CreateWishInput,
  Wish,
  WishlistUser,
} from "../../lib/wishlist-api";
import { createWishlistApi, isSessionRejection } from "../../lib/wishlist-api";

const POLL_INTERVAL_MS = 30_000;
const SESSION_ENDED_MESSAGE =
  "Your session has ended. Enter your user secret again to keep managing your wishes.";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useWishlist(apiUrl: string) {
  const api = createWishlistApi(apiUrl);
  const [wishes, setWishes] = createSignal<Wish[]>([]);
  const [loaded, setLoaded] = createSignal(false);
  const [listMessage, setListMessage] = createSignal(
    "Gathering Christmas wishes…",
  );
  const [listHasError, setListHasError] = createSignal(false);
  const [status, setStatus] = createSignal("");
  const [statusHasError, setStatusHasError] = createSignal(false);
  const [store, setStore] = createSignal<UserSecretStore>({
    activeUserId: null,
    users: {},
  });
  const activeUser = createMemo<StoredUser | null>(() => {
    const current = store();
    return current.activeUserId
      ? (current.users[current.activeUserId] ?? null)
      : null;
  });
  let loading = false;

  function report(message: string, isError = false) {
    setStatus(message);
    setStatusHasError(isError);
  }

  function updateStore(next: UserSecretStore) {
    setStore(next);
    writeUserSecrets(next);
  }

  /**
   * Reports a failed call. A rejected session (401) clears that session token
   * but keeps the secret, so the owner can enter it again from "Code".
   * Pass `clearOn401: false` when a 401 means a wrong secret, not a dead
   * session (rotation).
   */
  function reportFailure(
    user: StoredUser | null,
    error: unknown,
    fallback: string,
    clearOn401 = true,
  ) {
    if (user && clearOn401 && isSessionRejection(error)) {
      updateStore(clearSession(store(), user.id));
      report(SESSION_ENDED_MESSAGE, true);
      return;
    }
    report(errorMessage(error, fallback), true);
  }

  /** Returns the user's session token, or prompts to sign in again when it is gone. */
  function sessionTokenFor(user: StoredUser): string | null {
    if (user.sessionToken) return user.sessionToken;
    report(SESSION_ENDED_MESSAGE, true);
    return null;
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

  /** Single refresh path for mount, manual, visibility and polling. */
  async function loadWishes(quiet = false) {
    if (loading) return;
    loading = true;
    if (!quiet) {
      setListMessage("Gathering Christmas wishes…");
      setListHasError(false);
    }
    try {
      const data = await api.list();
      setWishes(data.wishes);
      setLoaded(true);
      setListMessage("");
    } catch (error) {
      if (!quiet) setLoaded(false);
      setListHasError(true);
      setListMessage(errorMessage(error, "Could not load wishes."));
    } finally {
      loading = false;
    }
  }

  async function createWish(input: CreateWishInput) {
    const active = activeUser();
    const activeToken = active ? sessionTokenFor(active) : null;
    if (active && !activeToken) return false;
    try {
      const result = await api.create({
        ...input,
        ...(activeToken ? { sessionToken: activeToken } : {}),
      });
      setWishes((current) => [...current, result.wish]);
      setLoaded(true);
      if (result.secret) {
        remember(result.user, result.secret, result.sessionToken ?? null);
        report(
          "Wish added. Your user secret is ready — select Code to view it.",
        );
      } else {
        report("Your wish has been added. Merry Christmas!");
      }
      return true;
    } catch (error) {
      reportFailure(active, error, "Could not add your wish.");
      return false;
    }
  }

  async function assume(name: string, secret: string, turnstileToken: string) {
    try {
      const result = await api.assume(name, secret, turnstileToken);
      remember(result.user, normalizeUserSecret(secret), result.sessionToken);
      report(`You are now managing ${result.user.name}’s wishes.`);
      return true;
    } catch (error) {
      report(errorMessage(error, "Could not use that secret."), true);
      return false;
    }
  }

  async function remove(wish: Wish) {
    const user = activeUser();
    if (!user || wish.userId !== user.id) return false;
    const sessionToken = sessionTokenFor(user);
    if (!sessionToken) return false;
    try {
      await api.remove(wish, sessionToken);
      setWishes((current) => current.filter((item) => item.id !== wish.id));
      report("Wish removed.");
      return true;
    } catch (error) {
      reportFailure(user, error, "Could not remove your wish.");
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
      report("Secret rotated. Select Code to view the new secret.");
      return true;
    } catch (error) {
      // A 401 here means the current secret was wrong, not a dead session.
      reportFailure(user, error, "Could not rotate the secret.", false);
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
    void loadWishes();
    const onStorage = (event: StorageEvent) => {
      const next = syncUserSecrets(event);
      if (next) setStore(next);
    };
    const onVisibility = () => {
      if (!document.hidden) void loadWishes(true);
    };
    const polling = window.setInterval(() => {
      if (!document.hidden) void loadWishes(true);
    }, POLL_INTERVAL_MS);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);
    onCleanup(() => {
      window.clearInterval(polling);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    });
  });

  return {
    wishes,
    loaded,
    listMessage,
    listHasError,
    status,
    statusHasError,
    activeUser,
    knownUsers: createMemo(() =>
      Object.values(store().users).filter((user) => user.sessionToken),
    ),
    report,
    refresh: () => loadWishes(),
    createWish,
    assume,
    remove,
    rotate,
    switchUser,
    selectUser,
    forget,
  };
}
