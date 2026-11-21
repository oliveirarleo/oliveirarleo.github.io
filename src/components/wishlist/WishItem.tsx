import { ArrowUpRight, ChevronDown, Pencil, Trash2 } from "lucide-solid";
import { createSignal, Show } from "solid-js";
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
  const [optionsOpen, setOptionsOpen] = createSignal(false);
  const optionsId = () => `wish-options-${props.wish.id}`;

  return (
    <li class="border-t border-[#ebe9e1] py-1.5">
      <div class="flex items-center gap-2.5">
        <a
          href={props.wish.link}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${props.wish.name} (opens in a new tab)`}
          class="group/link flex min-w-0 flex-1 items-center gap-3 py-2 no-underline"
        >
          <WishIcon link={props.wish.link} />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-[14px] text-[#414b44] transition-colors group-hover/link:text-secondary">
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
            class="shrink-0 text-[#89978d] transition-[color,transform] group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 group-hover/link:text-secondary"
            size={16}
            aria-hidden="true"
          />
        </a>
        <button
          type="button"
          class="btn btn-circle btn-ghost btn-xs relative shrink-0 text-[#89978d] after:absolute after:-inset-4 after:rounded-full after:content-['']"
          aria-expanded={optionsOpen()}
          aria-controls={optionsId()}
          aria-label={`${optionsOpen() ? "Hide" : "Show"} options for ${props.wish.name}`}
          title={optionsOpen() ? "Hide options" : "Edit, remove, or react"}
          onClick={() => setOptionsOpen((open) => !open)}
        >
          <ChevronDown
            class={
              optionsOpen()
                ? "rotate-180 transition-transform"
                : "transition-transform"
            }
            size={16}
            aria-hidden="true"
          />
        </button>
      </div>

      <div
        id={optionsId()}
        class="collapse"
        classList={{ "collapse-open": optionsOpen() }}
      >
        <div class="collapse-content px-0">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1.5 pt-1 pb-2 pl-[39px]">
            <div class="min-w-0">
              <ReactionBar
                wish={props.wish}
                activeUserId={props.activeUserId}
                onReact={props.onReact}
              />
            </div>
            <Show when={props.isOwner}>
              <div class="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  class="btn btn-ghost btn-xs h-6 min-h-0 rounded-full px-2 text-[11px] text-[#68736b]"
                  onClick={() => {
                    props.onEdit();
                  }}
                >
                  <Pencil size={13} aria-hidden="true" />
                  Edit
                </button>
                <button
                  type="button"
                  class="btn btn-ghost btn-xs h-6 min-h-0 rounded-full px-2 text-[11px] text-error"
                  disabled={props.removing}
                  onClick={() => {
                    props.onRemove();
                  }}
                >
                  <Trash2 size={13} aria-hidden="true" />
                  Remove
                </button>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </li>
  );
}
