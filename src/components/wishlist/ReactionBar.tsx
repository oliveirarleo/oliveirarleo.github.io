import { createMemo, For, Show } from "solid-js";
import { REACTIONS, type Reaction } from "../../../shared/reactions";
import type { Wish } from "../../lib/wishlist-api";
import { type ReactionSummary, reactionSummary } from "./reactions";

export default function ReactionBar(props: {
  wish: Wish;
  activeUserId: string | undefined;
  onReact: (emoji: Reaction) => void;
}) {
  const items = createMemo(() => {
    const byEmoji = new Map<Reaction, ReactionSummary>(
      reactionSummary(props.wish, props.activeUserId).map((summary) => [
        summary.emoji,
        summary,
      ]),
    );
    return REACTIONS.map(({ emoji, label }) => ({
      ...(byEmoji.get(emoji) ?? { emoji, count: 0, mine: false }),
      label,
    }));
  });

  return (
    <fieldset class="flex min-w-0 flex-wrap items-center gap-1 border-0 p-0">
      <legend class="sr-only">Reactions to {props.wish.name}</legend>
      <For each={items()}>
        {(item) => (
          <button
            type="button"
            class="btn btn-ghost btn-xs h-6 min-h-0 rounded-full border border-transparent px-2 text-[11px] font-normal"
            classList={{
              "border-[#d8e3d7] bg-[#eef4ee] text-[#355a4a]": item.mine,
              "opacity-60": item.count === 0 && !item.mine,
            }}
            aria-pressed={item.mine}
            aria-label={`${item.label}: ${item.emoji}${item.count > 0 ? `, ${item.count}` : ""}`}
            title={
              props.activeUserId
                ? `${item.label}${item.count > 0 ? ` (${item.count})` : ""}`
                : `${item.label} — use a secret to react`
            }
            disabled={!props.activeUserId}
            onClick={() => props.onReact(item.emoji)}
          >
            <span aria-hidden="true">{item.emoji}</span>
            <Show when={item.count > 0}>
              <span>{item.count}</span>
            </Show>
          </button>
        )}
      </For>
    </fieldset>
  );
}
