import { createMemo, createSignal, Show } from "solid-js";

export function domainFrom(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "View gift";
  }
}

export default function WishIcon(props: { link: string }) {
  const [failed, setFailed] = createSignal(false);
  const hostname = createMemo(() => {
    try {
      return new URL(props.link).hostname;
    } catch {
      return "";
    }
  });
  return (
    <span class="wish-icon" aria-hidden="true">
      <Show
        when={hostname() && !failed()}
        fallback={
          <svg viewBox="0 0 24 24" fill="none">
            <title>Website</title>
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M3 12h18M12 3c2.2 2.4 3.3 5.4 3.3 9S14.2 18.6 12 21c-2.2-2.4-3.3-5.4-3.3-9S9.8 5.4 12 3Z"
              stroke="currentColor"
              stroke-width="1.5"
            />
          </svg>
        }
      >
        <img
          src={`https://icons.duckduckgo.com/ip3/${encodeURIComponent(hostname())}.ico`}
          alt=""
          loading="lazy"
          referrerpolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </Show>
    </span>
  );
}
