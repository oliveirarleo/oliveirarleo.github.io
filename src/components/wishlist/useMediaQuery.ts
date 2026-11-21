import { createSignal, onCleanup, onMount } from "solid-js";

/** Tracks a media query, defaulting to `false` during server rendering. */
export function useMediaQuery(query: string) {
  const supported =
    typeof window !== "undefined" && typeof window.matchMedia === "function";
  const [matches, setMatches] = createSignal(
    supported ? window.matchMedia(query).matches : false,
  );

  onMount(() => {
    if (!supported) return;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    onCleanup(() => list.removeEventListener("change", update));
  });

  return matches;
}
