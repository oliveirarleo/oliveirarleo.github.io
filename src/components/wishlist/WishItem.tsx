import { ArrowUpRight, Pencil, Trash2 } from "lucide-solid";
import { Show } from "solid-js";
import type { Reaction } from "../../../shared/reactions";
import type { Wish } from "../../lib/wishlist-api";
import ReactionBar from "./ReactionBar";
import WishIcon, { domainFrom } from "./WishIcon";

export default function WishItem(props: {
  wish: Wish;
  isOwner: boolean;
  removing: boolean;
  activeUserId: string | undefined;
  onEdit: () => void;
  onRemove: () => void;
  onReact: (emoji: Reaction) => void;
}) {
  return (
    <li class="group border-t border-[#ebe9e1] py-1.5">
      <div class="flex items-center gap-2">
        <a
          href={props.wish.link}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${props.wish.name} (opens in a new tab)`}
          class="flex min-w-0 flex-1 items-center gap-3 py-2 no-underline"
        >
          <WishIcon link={props.wish.link} />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[14px] text-[#414b44] transition-colors group-hover:text-secondary">
              {props.wish.name}
            </span>
            <span class="mt-[3px] block truncate text-[10px] text-[#93978f]">
              {domainFrom(props.wish.link)}
              <Show when={props.wish.updatedAt}>
                <span class="ml-1.5 text-[#b0b3ab]">· edited</span>
              </Show>
            </span>
          </span>
          <ArrowUpRight
            class="shrink-0 text-[#89978d] transition-[color,transform] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-secondary"
            size={16}
            aria-hidden="true"
          />
        </a>
        <Show when={props.isOwner}>
          <button
            class="btn btn-circle btn-ghost btn-xs shrink-0 text-[#68736b]"
            type="button"
            title="Edit wish"
            aria-label={`Edit ${props.wish.name}`}
            onClick={props.onEdit}
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
          <button
            class="btn btn-circle btn-ghost btn-xs shrink-0 text-error"
            type="button"
            title="Remove wish"
            aria-label={`Remove ${props.wish.name}`}
            disabled={props.removing}
            onClick={props.onRemove}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </Show>
      </div>
      <ReactionBar
        wish={props.wish}
        activeUserId={props.activeUserId}
        onReact={props.onReact}
      />
    </li>
  );
}
