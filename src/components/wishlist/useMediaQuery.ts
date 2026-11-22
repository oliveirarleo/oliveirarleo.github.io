import { createSignal, onCleanup, onMount } from "solid-js";

/**
 * Tracks a media query.
 *
 * The signal always starts at `false`, on the server *and* on the client, so
 * the first client render produces the same DOM as the server one. Reading
 * `matchMedia` while creating the signal would make a phone's first render
 * pick the mobile branch while the markup holds the server branch, and Solid's
 * hydration walks nodes structurally: the island would throw and never mount.
 * The real value is applied in `onMount`, after hydration has settled.
 */
export function useMediaQuery(query: string) {
  const supported =
    typeof window !== "undefined" && typeof window.matchMedia === "function";
  const [matches, setMatches] = createSignal(false);

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
