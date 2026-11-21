import { Gift } from "lucide-solid";
import { Show } from "solid-js";
import { alertTone } from "./alertTone";
import UserSession from "./UserSession";
import type { useWishlist } from "./useWishlist";
import WishlistForm from "./WishlistForm";

export default function AddWishPanel(props: {
  wishlist: ReturnType<typeof useWishlist>;
  turnstileSiteKey?: string | undefined;
  onCreated?: (() => void) | undefined;
}) {
  const wishlist = props.wishlist;

  return (
    <>
      <div
        class="absolute top-0 left-1/2 hidden size-[67px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[6px] border-[#faf8f2] bg-primary text-[#e6c783] lg:grid"
        aria-hidden="true"
      >
        <Gift size={38} strokeWidth={1.6} />
      </div>

      <div class="text-center">
        <p class="m-0 mb-[7px] text-[10px] font-bold uppercase tracking-[2px] text-secondary">
          Make it merry
        </p>
        <h2
          id="form-title"
          class="font-display m-0 text-[30px] leading-[36px] tracking-[-0.5px] text-primary"
        >
          Add to the wishlist
        </h2>
        <p class="mt-2.5 mb-6 text-[13px] leading-5 text-[#7a817a]">
          What would make your Christmas a little brighter?
        </p>
      </div>

      <UserSession
        activeUser={wishlist.activeUser()}
        knownUsers={wishlist.knownUsers()}
        status={wishlist.status()}
        statusHasError={wishlist.statusHasError()}
        turnstileSiteKey={props.turnstileSiteKey}
        onAssume={wishlist.assume}
        onSelect={wishlist.selectUser}
        onSwitch={wishlist.switchUser}
        onForget={wishlist.forget}
        onRotate={wishlist.rotate}
      />
      <WishlistForm
        activeUser={wishlist.activeUser()}
        turnstileSiteKey={props.turnstileSiteKey}
        onCreate={wishlist.createWish}
        onInput={() => wishlist.report("")}
        onCreated={props.onCreated}
      />
      <Show when={wishlist.status()}>
        <div
          class="alert alert-soft mt-4 text-sm"
          classList={alertTone(wishlist.statusHasError())}
          role="status"
        >
          {wishlist.status()}
        </div>
      </Show>
      <p class="mt-5 -mr-2 -mb-1 -ml-2 flex items-center justify-center gap-1.5 border-t border-[#eeecd5] pt-4 text-center text-[9px] text-[#a0a29b]">
        Wishes are shared publicly. Your secret lets you manage them from any
        browser.
      </p>
    </>
  );
}
