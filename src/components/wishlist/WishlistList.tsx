import { createEffect, createMemo, createSignal, For } from "solid-js";
import type { Wish } from "../../lib/wishlist-api";
import type { WishGroup } from "./AuthorCard";
import AuthorCard from "./AuthorCard";
import DialogClose from "./DialogClose";

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
      <div class="grid gap-[17px]">
        <For each={groups()}>
          {(group, index) => (
            <AuthorCard
              group={group}
              activeUserId={props.activeUserId}
              removingId={removingId()}
              alternate={index() % 2 === 1}
              onRemove={(wish) => setPending(wish)}
            />
          )}
        </For>
      </div>
      <dialog
        ref={dialog}
        class="modal"
        aria-labelledby="confirm-title"
        onCancel={(event) => {
          event.preventDefault();
          if (!removingId()) dialog?.close();
        }}
        onClose={() => setPending(null)}
      >
        <div class="modal-box relative max-w-sm">
          <DialogClose
            label="Close remove dialog"
            disabled={Boolean(removingId())}
          />
          <h3 id="confirm-title" class="font-display m-0 pr-10 text-xl">
            Remove this wish?
          </h3>
          <p class="mt-2 text-sm text-base-content/70">
            Remove “{pending()?.name}” from the wishlist?
          </p>
          <div class="modal-action">
            <button
              type="button"
              class="btn btn-ghost"
              disabled={Boolean(removingId())}
              onClick={() => dialog?.close()}
            >
              Keep wish
            </button>
            <button
              type="button"
              class="btn btn-error"
              disabled={Boolean(removingId())}
              onClick={() => void confirmRemove()}
            >
              {removingId() ? "Removing…" : "Remove wish"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
