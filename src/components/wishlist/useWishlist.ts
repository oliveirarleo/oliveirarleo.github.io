import { createWishlistApi } from "../../lib/wishlist-api";
import { useSession } from "./useSession";
import { useWishes } from "./useWishes";

/**
 * Composition only: the identity module and the wishes module are independent
 * and each tested through its own interface. Components receive the slice
 * they use (`session`, list actions) instead of this whole object.
 */
export function useWishlist(apiUrl: string) {
  const api = createWishlistApi(apiUrl);
  const session = useSession(api);
  const wishes = useWishes({
    api,
    activeUser: session.activeUser,
    sessionTokenFor: session.sessionTokenFor,
    remember: session.remember,
    fail: session.fail,
    report: session.report,
  });

  return {
    wishes: wishes.wishes,
    loaded: wishes.loaded,
    listNotice: wishes.listNotice,
    refresh: wishes.refresh,
    createWish: wishes.createWish,
    remove: wishes.remove,
    edit: wishes.edit,
    react: wishes.react,
    session,
  };
}
