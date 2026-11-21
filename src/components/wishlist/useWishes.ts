import { createSignal, onCleanup, onMount } from "solid-js";
import type { Reaction } from "../../../shared/reactions";
import type { StoredUser } from "../../lib/user-secrets";
import type {
  CreateWishInput,
  Wish,
  WishDraft,
  WishlistApi,
  WishlistUser,
} from "../../lib/wishlist-api";
import type { Notice, NoticeTone } from "./notice";
import { applyReaction, reactionSummary, replaceWish } from "./reactions";

const POLL_INTERVAL_MS = 30_000;

type ListState = "loading" | "ready" | "error";

export interface UseWishesDeps {
  api: WishlistApi;
  activeUser: () => StoredUser | null;
  sessionTokenFor: (user: StoredUser) => string | null;
  remember: (
    user: WishlistUser,
    secret: string,
    sessionToken: string | null,
  ) => void;
  fail: (user: StoredUser | null, error: unknown, fallback: string) => void;
  report: (message: string, tone?: NoticeTone) => void;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/**
 * The wishlist read model and its mutations. It owns the polling policy and
 * the list's loading/error state; identity and notices are injected.
 */
export function useWishes(deps: UseWishesDeps) {
  const [wishes, setWishes] = createSignal<Wish[]>([]);
  const [state, setState] = createSignal<ListState>("loading");
  const [listError, setListError] = createSignal<string | null>(null);
  let loading = false;

  const loaded = () => state() === "ready";

  /** One derived message channel for the list: loading, error, or nothing. */
  const listNotice = (): Notice | null => {
    const error = listError();
    if (error) return { text: error, tone: "error" };
    if (state() === "loading")
      return { text: "Gathering Christmas wishes…", tone: "info" };
    return null;
  };

  /** Single refresh path for mount, manual, visibility and polling. */
  async function loadWishes(quiet = false) {
    if (loading) return;
    loading = true;
    if (!quiet) {
      setState("loading");
      setListError(null);
    }
    try {
      const data = await deps.api.list();
      setWishes(data.wishes);
      setState("ready");
      setListError(null);
    } catch (error) {
      setListError(errorMessage(error, "Could not load wishes."));
      if (!quiet) setState("error");
    } finally {
      loading = false;
    }
  }

  async function createWish(input: CreateWishInput) {
    const active = deps.activeUser();
    const activeToken = active ? deps.sessionTokenFor(active) : null;
    if (active && !activeToken) return false;
    try {
      const result = await deps.api.create({
        ...input,
        ...(activeToken ? { sessionToken: activeToken } : {}),
      });
      setWishes((current) => [...current, result.wish]);
      setState("ready");
      if (result.secret) {
        deps.remember(result.user, result.secret, result.sessionToken ?? null);
        deps.report(
          "Wish added. Your user secret is ready — select Code to view it.",
          "success",
        );
      } else {
        deps.report("Your wish has been added. Merry Christmas!", "success");
      }
      return true;
    } catch (error) {
      deps.fail(active, error, "Could not add your wish.");
      return false;
    }
  }

  async function remove(wish: Wish) {
    const user = deps.activeUser();
    if (!user || wish.userId !== user.id) return false;
    const sessionToken = deps.sessionTokenFor(user);
    if (!sessionToken) return false;
    try {
      await deps.api.remove(wish.id, sessionToken);
      setWishes((current) => current.filter((item) => item.id !== wish.id));
      deps.report("Wish removed.", "success");
      return true;
    } catch (error) {
      deps.fail(user, error, "Could not remove your wish.");
      return false;
    }
  }

  /** Owner-only edit, optimistic and rolled back from the previous value. */
  async function edit(wish: Wish, draft: WishDraft) {
    const user = deps.activeUser();
    if (!user || wish.userId !== user.id) return false;
    const sessionToken = deps.sessionTokenFor(user);
    if (!sessionToken) return false;
    const previous = wishes().find((item) => item.id === wish.id);
    setWishes((current) =>
      current.map((item) =>
        item.id === wish.id
          ? { ...item, ...draft, updatedAt: new Date().toISOString() }
          : item,
      ),
    );
    try {
      const result = await deps.api.update(wish.id, draft, sessionToken);
      setWishes((current) => replaceWish(current, result.wish));
      deps.report("Wish updated.", "success");
      return true;
    } catch (error) {
      if (previous) {
        setWishes((current) => replaceWish(current, previous));
      }
      deps.fail(user, error, "Could not update your wish.");
      return false;
    }
  }

  /** One reaction per user per wish; pressing the current emoji clears it. */
  async function react(wish: Wish, emoji: Reaction) {
    const user = deps.activeUser();
    if (!user) return false;
    const sessionToken = deps.sessionTokenFor(user);
    if (!sessionToken) return false;
    const mine = reactionSummary(wish, user.id).find(
      (reaction) => reaction.emoji === emoji,
    )?.mine;
    const next = mine ? null : emoji;
    const before = wishes();
    setWishes(applyReaction(before, wish.id, user.id, next));
    try {
      const result = next
        ? await deps.api.setReaction(wish.id, next, sessionToken)
        : await deps.api.clearReaction(wish.id, sessionToken);
      setWishes((current) => replaceWish(current, result.wish));
      return true;
    } catch (error) {
      setWishes(before);
      deps.fail(user, error, "Could not save your reaction.");
      return false;
    }
  }

  onMount(() => {
    void loadWishes();
    const onVisibility = () => {
      if (!document.hidden) void loadWishes(true);
    };
    const polling = window.setInterval(() => {
      if (!document.hidden) void loadWishes(true);
    }, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibility);
    onCleanup(() => {
      window.clearInterval(polling);
      document.removeEventListener("visibilitychange", onVisibility);
    });
  });

  return {
    wishes,
    loaded,
    listNotice,
    refresh: () => loadWishes(),
    createWish,
    remove,
    edit,
    react,
  };
}
