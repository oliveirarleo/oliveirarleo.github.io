import { RefreshCw, Sparkles } from "lucide-solid";
import { createEffect, Show } from "solid-js";
import AddWishDialog from "./wishlist/AddWishDialog";
import AddWishFab from "./wishlist/AddWishFab";
import AddWishSidebar from "./wishlist/AddWishSidebar";
import StatusAlert from "./wishlist/StatusAlert";
import { useMediaQuery } from "./wishlist/useMediaQuery";
import { useWishlist } from "./wishlist/useWishlist";
import { useWishPanel } from "./wishlist/useWishPanel";
import WishlistList from "./wishlist/WishlistList";

interface WishlistProps {
  apiUrl: string;
  turnstileSiteKey?: string | undefined;
}

export default function Wishlist(props: WishlistProps) {
  const wishlist = useWishlist(props.apiUrl);
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const panel = useWishPanel();

  // Leaving the mobile breakpoint must not leave an orphan modal in the
  // top layer. The panel handle owns that state, not the page.
  createEffect(() => {
    if (!isMobile()) panel.close();
  });

  return (
    <>
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
            activeUserId={wishlist.session.activeUser()?.id}
            onRemove={wishlist.remove}
            onEdit={wishlist.edit}
            onReact={wishlist.react}
          />
          <Show when={wishlist.listNotice()}>
            {(notice) => <StatusAlert notice={notice()} class="mt-4" />}
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

        <Show when={!isMobile()}>
          <div class="lg:sticky lg:top-7">
            <AddWishSidebar
              session={wishlist.session}
              createWish={wishlist.createWish}
              turnstileSiteKey={props.turnstileSiteKey}
            />
          </div>
        </Show>
      </div>

      <Show when={isMobile()}>
        <AddWishDialog
          panel={panel}
          session={wishlist.session}
          createWish={wishlist.createWish}
          turnstileSiteKey={props.turnstileSiteKey}
        />
        <Show when={!panel.isOpen()}>
          <AddWishFab onPress={panel.open} />
        </Show>
      </Show>
    </>
  );
}
