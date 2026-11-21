import { Gift } from "lucide-solid";
import { Show } from "solid-js";
import type { CreateWishInput } from "../../lib/wishlist-api";
import StatusAlert from "./StatusAlert";
import UserSession from "./UserSession";
import type { WishlistSession } from "./useSession";
import WishlistForm from "./WishlistForm";

export default function AddWishPanel(props: {
  session: WishlistSession;
  createWish: (input: CreateWishInput) => Promise<boolean>;
  turnstileSiteKey?: string | undefined;
  onCreated?: (() => void) | undefined;
}) {
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
        activeUser={props.session.activeUser()}
        knownUsers={props.session.knownUsers()}
        notice={props.session.notice()}
        turnstileSiteKey={props.turnstileSiteKey}
        onAssume={props.session.assume}
        onSelect={props.session.selectUser}
        onSwitch={props.session.switchUser}
        onForget={props.session.forget}
        onRotate={props.session.rotate}
      />
      <WishlistForm
        activeUser={props.session.activeUser()}
        turnstileSiteKey={props.turnstileSiteKey}
        onCreate={props.createWish}
        onInput={props.session.clearNotice}
        onCreated={props.onCreated}
      />
      <Show when={props.session.notice()}>
        {(notice) => <StatusAlert notice={notice()} class="mt-4" />}
      </Show>
      <p class="mt-5 -mr-2 -mb-1 -ml-2 flex items-center justify-center gap-1.5 border-t border-[#eeecd5] pt-4 text-center text-[9px] text-[#a0a29b]">
        Wishes are shared publicly. Your secret lets you manage them from any
        browser.
      </p>
    </>
  );
}
