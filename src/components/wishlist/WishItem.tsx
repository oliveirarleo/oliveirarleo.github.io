import { Show } from "solid-js";
import type { Wish } from "../../lib/wishlist-api";
import WishIcon, { domainFrom } from "./WishIcon";

export default function WishItem(props: {
  wish: Wish;
  canRemove: boolean;
  removing: boolean;
  onRemove: () => void;
}) {
  return (
    <li class="wish-item">
      <a
        href={props.wish.link}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${props.wish.name} (opens in a new tab)`}
      >
        <WishIcon link={props.wish.link} />
        <span class="wish-copy">
          <span class="wish-name">{props.wish.name}</span>
          <span class="wish-domain">{domainFrom(props.wish.link)}</span>
        </span>
        <svg
          class="wish-arrow"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 15 15 5m-8 0h8v8"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </a>
      <Show when={props.canRemove}>
        <button
          class="remove-wish"
          type="button"
          title="Remove wish"
          aria-label={`Remove ${props.wish.name}`}
          disabled={props.removing}
          onClick={props.onRemove}
        >
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path
              d="M4 6h12M8 3h4M6 6l.7 10h6.6L14 6M8 9v4M12 9v4"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </Show>
    </li>
  );
}
