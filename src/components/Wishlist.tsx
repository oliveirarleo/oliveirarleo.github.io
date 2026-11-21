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
              ↻
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
            <span aria-hidden="true">✧</span>
            <h3>No wishes just yet</h3>
            <p>Be the first to add a little something to the list.</p>
          </div>
        </Show>
      </section>

      <div class="form-column">
        <div class="form-decoration" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none">
            <title>Gift</title>
            <path
              d="M12 27h40v29H12zM8 19h48v12H8zM32 19v37"
              stroke="currentColor"
              stroke-width="2.2"
            />
            <path
              d="M32 19c-7 0-14-2.4-14-8 0-3 2.4-5 5.4-5C28.7 6 32 19 32 19Zm0 0c7 0 14-2.4 14-8 0-3-2.4-5-5.4-5C35.3 6 32 19 32 19Z"
              stroke="currentColor"
              stroke-width="2.2"
            />
            <path
              d="m53 4 1.2 3.8L58 9l-3.8 1.2L53 14l-1.2-3.8L48 9l3.8-1.2L53 4Z"
              fill="currentColor"
            />
          </svg>
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
