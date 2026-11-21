import { createEffect, createSignal, Show } from "solid-js";
import type { Wish, WishDraft } from "../../lib/wishlist-api";
import DialogClose from "./DialogClose";
import WishFields from "./WishFields";
import { INVALID_LINK_MESSAGE, validWishLink } from "./wish-link";

export default function WishEditor(props: {
  wish: Wish | null;
  onSave: (wish: Wish, draft: WishDraft) => Promise<boolean>;
  onClose: () => void;
}) {
  const [saving, setSaving] = createSignal(false);
  const [message, setMessage] = createSignal("");
  let dialog: HTMLDialogElement | undefined;
  let form: HTMLFormElement | undefined;

  createEffect(() => {
    if (props.wish && !dialog?.open) {
      setMessage("");
      dialog?.showModal();
    }
    if (!props.wish && dialog?.open) dialog?.close();
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const wish = props.wish;
    if (!wish || !form?.reportValidity()) return;
    const data = new FormData(form);
    const linkInput = form.querySelector<HTMLInputElement>('[name="link"]');
    const link = String(data.get("link")).trim();
    if (!validWishLink(link)) {
      linkInput?.setCustomValidity(INVALID_LINK_MESSAGE);
      form.reportValidity();
      return;
    }
    linkInput?.setCustomValidity("");
    setMessage("");
    setSaving(true);
    const saved = await props.onSave(wish, {
      name: String(data.get("name")).trim(),
      link,
    });
    setSaving(false);
    if (saved) dialog?.close();
    else setMessage("Could not update this wish. Please try again.");
  }

  return (
    <dialog
      ref={dialog}
      class="modal"
      aria-labelledby="edit-wish-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving()) dialog?.close();
      }}
      onClose={props.onClose}
    >
      <div class="modal-box relative max-w-md">
        <DialogClose label="Close edit dialog" disabled={saving()} />
        <Show when={props.wish} keyed>
          {(wish) => (
            <>
              <h3 id="edit-wish-title" class="font-display m-0 pr-10 text-xl">
                Edit wish
              </h3>
              <p class="mt-2 text-sm text-base-content/70">
                Update the wish’s name or link. The author stays the same.
              </p>
              <form ref={form} class="mt-4" onSubmit={submit}>
                <WishFields
                  idPrefix="edit-wish"
                  name={wish.name}
                  link={wish.link}
                />
                <Show when={message()}>
                  <div
                    class="alert alert-error alert-soft mt-3 text-sm"
                    role="status"
                  >
                    {message()}
                  </div>
                </Show>
                <div class="modal-action">
                  <button
                    type="button"
                    class="btn btn-ghost"
                    disabled={saving()}
                    onClick={() => dialog?.close()}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    class="btn btn-primary"
                    disabled={saving()}
                  >
                    {saving() ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
            </>
          )}
        </Show>
      </div>
    </dialog>
  );
}
