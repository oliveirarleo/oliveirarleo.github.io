import { ArrowUpRight, Trash2 } from "lucide-solid";
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
        <ArrowUpRight class="wish-arrow" size={16} aria-hidden="true" />
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
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </Show>
    </li>
  );
}
