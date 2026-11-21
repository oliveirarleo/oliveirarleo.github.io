import { Gift, RefreshCw, Sparkles } from "lucide-solid";
import { createEffect, createSignal, Show } from "solid-js";
import AddWishPanel from "./wishlist/AddWishPanel";
import { alertTone } from "./wishlist/alertTone";
import DialogClose from "./wishlist/DialogClose";
import { useMediaQuery } from "./wishlist/useMediaQuery";
import { useWishlist } from "./wishlist/useWishlist";
import WishlistList from "./wishlist/WishlistList";

interface WishlistProps {
  apiUrl: string;
  turnstileSiteKey?: string | undefined;
}

export default function Wishlist(props: WishlistProps) {
  const wishlist = useWishlist(props.apiUrl);
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const [mobilePanelOpen, setMobilePanelOpen] = createSignal(false);
  let panel: HTMLDialogElement | undefined;

  // One panel for both layouts: a sticky card on desktop (kept open as a plain
  // dialog) and a modal opened from the floating button on mobile.
  createEffect(() => {
    const mobile = isMobile();
    if (!panel) return;
    panel.close();
    if (mobile) setMobilePanelOpen(false);
    else panel.setAttribute("open", "");
  });

  return (
    <div class="grid grid-cols-1 items-start gap-12 pb-20 lg:grid-cols-[minmax(0,1fr)_365px] lg:gap-[50px]">
      <section aria-labelledby="wishes-title" class="min-w-0">
        <div class="mb-[23px] flex flex-wrap items-end justify-between gap-5">
          <div>
            <p class="m-0 mb-[7px] text-[10px] font-bold uppercase tracking-[2px] text-secondary">
              The good stuff
            </p>
            <h2
              id="wishes-title"
              class="font-display m-0 text-[30px] leading-[36px] tracking-[-0.5px] text-primary"
            >
              Everyone’s wishes
            </h2>
          </div>
          <div class="flex items-center gap-2.5">
            <Show when={wishlist.loaded()}>
              <span
                class="mb-[3px] text-[12px] whitespace-nowrap text-[#7c817a]"
                aria-live="polite"
              >
                {wishlist.wishes().length}{" "}
                {wishlist.wishes().length === 1 ? "gift idea" : "gift ideas"}
              </span>
            </Show>
            <button
              type="button"
              class="grid size-[30px] shrink-0 place-items-center rounded-full border border-[#dedbd1] text-[#68736b] transition-colors hover:bg-base-200"
              onClick={() => void wishlist.refresh()}
              aria-label="Refresh wishes"
              title="Refresh wishes"
            >
              <RefreshCw size={15} aria-hidden="true" />
            </button>
          </div>
        </div>

        <WishlistList
          wishes={wishlist.wishes()}
          activeUserId={wishlist.activeUser()?.id}
          onRemove={wishlist.remove}
        />
        <Show when={wishlist.listMessage()}>
          <div
            class="alert alert-soft mt-4 text-sm"
            classList={alertTone(wishlist.listHasError())}
            role="status"
          >
            {wishlist.listMessage()}
          </div>
        </Show>
        <Show when={wishlist.loaded() && wishlist.wishes().length === 0}>
          <div class="rounded-xl border border-dashed border-base-300 bg-white/60 px-6 py-12 text-center">
            <span class="text-accent" aria-hidden="true">
              <Sparkles size={30} />
            </span>
            <h3 class="font-display mt-2 mb-1 text-[24px] text-primary">
              No wishes just yet
            </h3>
            <p class="m-0 text-[13px] text-[#7c817a]">
              Be the first to add a little something to the list.
            </p>
          </div>
        </Show>
      </section>

      <div class="lg:sticky lg:top-7">
        <dialog
          ref={(element) => (panel = element)}
          class="modal lg:static lg:block lg:h-auto lg:overflow-visible lg:bg-transparent!"
          aria-labelledby="form-title"
          onClose={() => setMobilePanelOpen(false)}
        >
          <div class="modal-box relative max-h-[calc(100dvh-4rem)] rounded-[14px] border border-[#e0ded3] bg-[#fffefb] px-8 pt-8 pb-8 shadow-[0_12px_35px_rgba(42,55,45,0.06)] before:pointer-events-none before:absolute before:inset-[5px] before:rounded-[10px] before:border before:border-[#f0eee6] before:content-[''] lg:max-h-none lg:w-[365px] lg:max-w-[365px] lg:overflow-visible lg:pt-[58px]">
            <div class="lg:hidden">
              <DialogClose label="Close add wish dialog" />
            </div>
            <AddWishPanel
              wishlist={wishlist}
              turnstileSiteKey={props.turnstileSiteKey}
              onCreated={() => {
                if (mobilePanelOpen()) panel?.close();
              }}
            />
          </div>
          <form method="dialog" class="modal-backdrop lg:hidden">
            <button type="submit">close</button>
          </form>
        </dialog>
      </div>

      <div class="fab lg:hidden">
        <button
          type="button"
          class="btn btn-lg btn-circle btn-primary shadow-[0_10px_24px_rgba(23,63,53,0.35)]"
          aria-label="Add a wish"
          title="Add a wish"
          onClick={() => {
            panel?.showModal();
            setMobilePanelOpen(true);
          }}
        >
          <Gift size={26} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
