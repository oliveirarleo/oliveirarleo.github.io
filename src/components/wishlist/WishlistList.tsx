import { createEffect, createMemo, createSignal, For } from "solid-js";
import type { Wish } from "../../lib/wishlist-api";
import type { WishGroup } from "./AuthorCard";
import AuthorCard from "./AuthorCard";

export default function WishlistList(props: {
  wishes: Wish[];
  activeUserId: string | undefined;
  onRemove: (wish: Wish) => Promise<boolean>;
}) {
  const [pending, setPending] = createSignal<Wish | null>(null);
  const [removingId, setRemovingId] = createSignal<string | null>(null);
  let dialog: HTMLDialogElement | undefined;
  const groups = createMemo<WishGroup[]>(() => {
    const grouped = new Map<string, WishGroup>();
    for (const wish of props.wishes) {
      const key = wish.userId;
      const group = grouped.get(key);
      if (group) group.wishes.push(wish);
      else
        grouped.set(key, {
          author: wish.author,
          userId: wish.userId,
          wishes: [wish],
        });
    }
    return [...grouped.values()];
  });

  createEffect(() => {
    if (pending() && !dialog?.open) dialog?.showModal();
  });

  async function confirmRemove() {
    const wish = pending();
    if (!wish) return;
    setRemovingId(wish.id);
    await props.onRemove(wish);
    setRemovingId(null);
    dialog?.close();
    setPending(null);
  }

  return (
    <>
      <div class="wishlist">
        <For each={groups()}>
          {(group) => (
            <AuthorCard
              group={group}
              activeUserId={props.activeUserId}
              removingId={removingId()}
              onRemove={(wish) => setPending(wish)}
            />
          )}
        </For>
      </div>
      <dialog
        ref={dialog}
        class="confirm-dialog"
        aria-labelledby="confirm-title"
        onCancel={(event) => {
          event.preventDefault();
          if (!removingId()) dialog?.close();
        }}
        onClose={() => setPending(null)}
      >
        <h3 id="confirm-title">Remove this wish?</h3>
        <p>Remove “{pending()?.name}” from the wishlist?</p>
        <div class="dialog-actions">
          <button
            type="button"
            class="secondary-button"
            disabled={Boolean(removingId())}
            onClick={() => dialog?.close()}
          >
            Keep wish
          </button>
          <button
            type="button"
            class="danger-button"
            disabled={Boolean(removingId())}
            onClick={() => void confirmRemove()}
          >
            {removingId() ? "Removing…" : "Remove wish"}
          </button>
        </div>
      </dialog>
    </>
  );
}
