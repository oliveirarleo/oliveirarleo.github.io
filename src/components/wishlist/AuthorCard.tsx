import { createMemo, For } from "solid-js";
import type { Reaction } from "../../../shared/reactions";
import type { Wish } from "../../lib/wishlist-api";
import WishItem from "./WishItem";

export interface WishGroup {
  author: string;
  userId: string;
  wishes: Wish[];
}

export default function AuthorCard(props: {
  group: WishGroup;
  activeUserId: string | undefined;
  removingId: string | null;
  alternate?: boolean;
  onRemove: (wish: Wish) => void;
  onEdit: (wish: Wish) => void;
  onReact: (wish: Wish, emoji: Reaction) => void;
}) {
  const wishCount = () => props.group.wishes.length;
  // Key rows by id so a new wish object from polling, editing, or reacting
  // does not remount the row and collapse its options panel.
  const wishIds = createMemo(() => props.group.wishes.map(({ id }) => id));
  const wishFor = (id: string) =>
    props.group.wishes.find((wish) => wish.id === id) as Wish;

  return (
    <article class="overflow-hidden rounded-xl border border-[#e3e1d8] bg-white/60 shadow-[0_3px_12px_rgba(34,52,43,0.024)]">
      <header class="flex items-center gap-[13px] px-[23px] py-[17px]">
        <div
          class="grid size-[45px] shrink-0 place-items-center rounded-full border font-serif text-[20px]"
          classList={{
            "border-[#eadbd0] bg-[#f3e8df] text-[#a24b3e]": Boolean(
              props.alternate,
            ),
            "border-[#d8e3d7] bg-[#e6eee6] text-[#355a4a]": !props.alternate,
          }}
          aria-hidden="true"
        >
          {props.group.author.charAt(0).toLocaleUpperCase()}
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="font-display m-0 mb-px truncate text-[22px] leading-[26px] text-[#27493e]">
            {props.group.author}
          </h3>
          <p class="m-0 text-[11px] leading-[18px] text-[#858980]">
            {wishCount()} {wishCount() === 1 ? "wish" : "wishes"}
          </p>
        </div>
      </header>
      <ul class="m-0 px-[23px] pb-2">
        <For each={wishIds()}>
          {(wishId) => {
            const wish = () => wishFor(wishId);
            return (
              <WishItem
                wish={wish()}
                isOwner={props.activeUserId === wish().userId}
                activeUserId={props.activeUserId}
                removing={props.removingId === wish().id}
                onEdit={() => props.onEdit(wish())}
                onRemove={() => props.onRemove(wish())}
                onReact={(emoji) => props.onReact(wish(), emoji)}
              />
            );
          }}
        </For>
      </ul>
    </article>
  );
}
