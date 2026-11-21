import { Globe } from "lucide-solid";
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
    <span
      class="grid size-[27px] shrink-0 place-items-center overflow-hidden rounded-md border border-[#e3e1d8] bg-white text-[#68736b]"
      aria-hidden="true"
    >
      <Show
        when={hostname() && !failed()}
        fallback={<Globe size={18} aria-hidden="true" />}
      >
        <img
          class="size-[18px]"
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
