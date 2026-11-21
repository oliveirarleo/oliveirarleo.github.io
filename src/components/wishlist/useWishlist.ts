import { createMemo, createSignal, onCleanup, onMount } from "solid-js";
import type { StoredUser, UserSecretStore } from "../../lib/user-secrets";
import {
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
import { createWishlistApi } from "../../lib/wishlist-api";

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

  function remember(user: WishlistUser, secret: string) {
    const current = store();
    updateStore({
      activeUserId: user.id,
      users: {
        ...current.users,
        [user.id]: { ...user, secret: normalizeUserSecret(secret) },
      },
    });
  }

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

  async function createWish(input: Omit<CreateWishInput, "secret">) {
    try {
      const secret = activeUser()?.secret;
      const result = await api.create({
        ...input,
        ...(secret ? { secret } : {}),
      });
      setWishes((current) => [...current, result.wish]);
      setLoaded(true);
      if (result.secret) {
        remember(result.user, result.secret);
        report(
          "Wish added. Your user secret is ready — select Code to view it.",
        );
      } else {
        report("Your wish has been added. Merry Christmas!");
      }
      return true;
    } catch (error) {
      report(errorMessage(error, "Could not add your wish."), true);
      return false;
    }
  }

  async function assume(secret: string, turnstileToken: string) {
    try {
      const normalized = normalizeUserSecret(secret);
      const result = await api.assume(normalized, turnstileToken);
      remember(result.user, normalized);
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
    try {
      await api.remove(wish, user.secret);
      setWishes((current) => current.filter((item) => item.id !== wish.id));
      report("Wish removed.");
      return true;
    } catch (error) {
      report(errorMessage(error, "Could not remove your wish."), true);
      return false;
    }
  }

  async function rotate() {
    const user = activeUser();
    if (!user) return false;
    try {
      const result = await api.rotate(user.secret);
      remember(result.user, result.secret);
      report("Secret rotated. Select Code to view the new secret.");
      return true;
    } catch (error) {
      report(errorMessage(error, "Could not rotate the secret."), true);
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
    const current = store();
    const user = activeUser();
    if (!user) return;
    const users = { ...current.users };
    delete users[user.id];
    updateStore({ users, activeUserId: null });
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
    }, 30_000);
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
    knownUsers: createMemo(() => Object.values(store().users)),
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
