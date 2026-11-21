import { Gift, RefreshCw, Sparkles } from "lucide-solid";
import { Show } from "solid-js";
import UserSession from "./wishlist/UserSession";
import { useWishlist } from "./wishlist/useWishlist";
import WishlistForm from "./wishlist/WishlistForm";
import WishlistList from "./wishlist/WishlistList";

interface WishlistProps {
  apiUrl: string;
  turnstileSiteKey?: string | undefined;
}

export default function Wishlist(props: WishlistProps) {
  const wishlist = useWishlist(props.apiUrl);

  return (
    <div class="wishlist-layout">
      <section class="wishes-section" aria-labelledby="wishes-title">
        <div class="section-heading">
          <div>
            <p class="section-kicker">The good stuff</p>
            <h2 id="wishes-title">Everyone’s wishes</h2>
          </div>
          <div class="list-tools">
            <Show when={wishlist.loaded()}>
              <span class="wish-count" aria-live="polite">
                {wishlist.wishes().length}{" "}
                {wishlist.wishes().length === 1 ? "gift idea" : "gift ideas"}
              </span>
            </Show>
            <button
              type="button"
              class="refresh-button"
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
          <p
            class="list-status"
            classList={{ error: wishlist.listHasError() }}
            role="status"
          >
            {wishlist.listMessage()}
          </p>
        </Show>
        <Show when={wishlist.loaded() && wishlist.wishes().length === 0}>
          <div class="empty-state">
            <span aria-hidden="true">
              <Sparkles size={30} />
            </span>
            <h3>No wishes just yet</h3>
            <p>Be the first to add a little something to the list.</p>
          </div>
        </Show>
      </section>

      <div class="form-column">
        <div class="form-decoration" aria-hidden="true">
          <Gift size={38} strokeWidth={1.7} />
        </div>
        <aside class="form-card" aria-labelledby="form-title">
          <p class="section-kicker">Make it merry</p>
          <h2 id="form-title">Add to the wishlist</h2>
          <p class="form-intro">
            What would make your Christmas a little brighter?
          </p>

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
          />
          <Show when={wishlist.status()}>
            <p
              class="form-status"
              classList={{ error: wishlist.statusHasError() }}
              role="status"
            >
              {wishlist.status()}
            </p>
          </Show>
          <p class="storage-note">
            Wishes are shared publicly. Your secret lets you manage them from
            any browser.
          </p>
        </aside>
      </div>
    </div>
  );
}
