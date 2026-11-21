import { createSignal, onCleanup, onMount, Show } from "solid-js";

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: "light" | "dark" | "auto";
      size?: "normal" | "flexible" | "compact";
      action?: string;
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove?: (widgetId?: string) => void;
  getResponse: (widgetId?: string) => string;
}

export interface TurnstileFieldHandle {
  token: () => string;
  reset: () => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | undefined;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      scriptPromise = undefined;
      reject(new Error("Verification could not load."));
    };
    document.head.append(script);
  });
  return scriptPromise;
}

export default function TurnstileField(props: {
  siteKey?: string | undefined;
  handleRef: (handle: TurnstileFieldHandle) => void;
}) {
  const [message, setMessage] = createSignal("");
  let container: HTMLDivElement | undefined;
  let widget: string | undefined;

  async function setup() {
    if (!props.siteKey || !container) return;
    setMessage("");
    try {
      await loadTurnstile();
      if (!container || !window.turnstile) return;
      widget = window.turnstile.render(container, {
        sitekey: props.siteKey,
        theme: "light",
        size: "flexible",
        action: "wishlist",
      });
    } catch {
      setMessage(
        "Verification could not load. Check your connection and retry.",
      );
    }
  }

  props.handleRef({
    token: () => window.turnstile?.getResponse(widget) ?? "",
    reset: () => window.turnstile?.reset(widget),
  });

  onMount(() => {
    void setup();
    onCleanup(() => window.turnstile?.remove?.(widget));
  });

  return (
    <>
      <div ref={container} class="turnstile-container" />
      <Show when={message()}>
        <p class="turnstile-error" role="status">
          {message()}{" "}
          <button
            type="button"
            class="text-button"
            onClick={() => void setup()}
          >
            Retry verification
          </button>
        </p>
      </Show>
    </>
  );
}
