import type { CreateWishInput } from "../../lib/wishlist-api";
import AddWishPanel from "./AddWishPanel";
import DialogClose from "./DialogClose";
import type { WishlistSession } from "./useSession";
import type { WishPanel } from "./useWishPanel";

/** Mobile adapter: the same panel content inside a modal. */
export default function AddWishDialog(props: {
  panel: WishPanel;
  session: WishlistSession;
  createWish: (input: CreateWishInput) => Promise<boolean>;
  turnstileSiteKey?: string | undefined;
}) {
  return (
    <dialog
      id="add-wish-dialog"
      ref={props.panel.attach}
      class="modal"
      aria-labelledby="form-title"
      onCancel={(event) => {
        event.preventDefault();
        props.panel.close();
      }}
      onClose={props.panel.handleClose}
    >
      <div class="modal-box relative max-h-[calc(100dvh-4rem)] w-full max-w-[365px] rounded-[14px] border border-[#e0ded3] bg-[#fffefb] px-8 pt-8 pb-8 shadow-[0_12px_35px_rgba(42,55,45,0.06)] before:pointer-events-none before:absolute before:inset-[5px] before:rounded-[10px] before:border before:border-[#f0eee6] before:content-['']">
        <DialogClose label="Close add wish dialog" />
        <AddWishPanel
          session={props.session}
          createWish={props.createWish}
          turnstileSiteKey={props.turnstileSiteKey}
          onCreated={props.panel.close}
        />
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>
  );
}
