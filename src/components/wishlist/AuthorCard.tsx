import { Sparkles } from "lucide-solid";
import { For } from "solid-js";
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
  onRemove: (wish: Wish) => void;
}) {
  return (
    <article class="author-card">
      <header class="author-header">
        <div class="avatar" aria-hidden="true">
          {props.group.author.charAt(0).toLocaleUpperCase()}
        </div>
        <div class="author-details">
          <h3>{props.group.author}</h3>
          <p>
            {props.group.wishes.length}{" "}
            {props.group.wishes.length === 1 ? "wish" : "wishes"}
          </p>
        </div>
        <span class="author-sparkle" aria-hidden="true">
          <Sparkles size={20} />
        </span>
      </header>
      <ul class="author-wishes">
        <For each={props.group.wishes}>
          {(wish) => (
            <WishItem
              wish={wish}
              canRemove={props.activeUserId === wish.userId}
              removing={props.removingId === wish.id}
              onRemove={() => props.onRemove(wish)}
            />
          )}
        </For>
      </ul>
    </article>
  );
}
