/**
 * Reactions shared by the API and the browser. The order is the display order.
 *
 * The set is deliberately small and fixed: it keeps the UI predictable, makes
 * validation a set-membership check, and lets the API store a plain string.
 * Adding an emoji here needs no migration; removing one needs a data decision.
 */
export const REACTIONS = [
  { emoji: "❤️", label: "Love it" },
  { emoji: "🎁", label: "Perfect gift" },
  { emoji: "🎄", label: "Festive" },
  { emoji: "👀", label: "Noticed it" },
  { emoji: "😂", label: "Funny" },
  { emoji: "🫠", label: "Too much" },
  { emoji: "🧦", label: "Socks again" },
] as const;

export type Reaction = (typeof REACTIONS)[number]["emoji"];

const reactionSet: ReadonlySet<string> = new Set(
  REACTIONS.map(({ emoji }) => emoji),
);

export function isReaction(value: string): value is Reaction {
  return reactionSet.has(value);
}
