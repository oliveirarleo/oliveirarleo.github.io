import { For, Show, createMemo, createSignal, onMount } from "solid-js";

interface Wish {
  id: string;
  author: string;
  name: string;
  link: string;
  createdAt: string;
}

interface WishGroup {
  author: string;
  wishes: Wish[];
}

interface WishlistProps {
  apiUrl: string;
  turnstileSiteKey?: string | undefined;
}

interface CreateWishResponse {
  wish: Wish;
  deleteToken: string;
}

const DELETE_TOKENS_KEY = "wishlist-delete-tokens-v1";

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
  getResponse: (widgetId?: string) => string;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function domainFrom(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "View gift";
  }
}

export default function Wishlist(props: WishlistProps) {
  const apiUrl = props.apiUrl.replace(/\/$/, "");
  const [wishes, setWishes] = createSignal<Wish[]>([]);
  const [loaded, setLoaded] = createSignal(false);
  const [listMessage, setListMessage] = createSignal("");
  const [listHasError, setListHasError] = createSignal(false);
  const [status, setStatus] = createSignal("");
  const [statusHasError, setStatusHasError] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const [deleteTokens, setDeleteTokens] = createSignal<Record<string, string>>({});
  const [removingId, setRemovingId] = createSignal<string | null>(null);

  let form: HTMLFormElement | undefined;
  let turnstileContainer: HTMLDivElement | undefined;
  let turnstileWidget: string | undefined;

  const groups = createMemo<WishGroup[]>(() => {
    const grouped = new Map<string, WishGroup>();
    for (const wish of wishes()) {
      const key = wish.author.trim().toLocaleLowerCase();
      const group = grouped.get(key);
      if (group) group.wishes.push(wish);
      else grouped.set(key, { author: wish.author, wishes: [wish] });
    }
    return [...grouped.values()];
  });

  async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");

    try {
      const response = await fetch(`${apiUrl}${path}`, { ...init, headers, signal: controller.signal });
      const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Something went wrong. Please try again.");
      return payload;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("The server took too long to respond. Please try again.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function loadWishes() {
    setListMessage("Gathering Christmas wishes…");
    setListHasError(false);
    try {
      const data = await api<{ wishes: Wish[] }>("/api/wishes");
      setWishes(data.wishes);
      setLoaded(true);
      setListMessage("");
    } catch (error) {
      setLoaded(false);
      setListHasError(true);
      setListMessage(errorMessage(error, "Could not load wishes."));
    }
  }

  async function setupTurnstile() {
    if (!props.turnstileSiteKey || !turnstileContainer) return;
    try {
      if (!window.turnstile) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Verification could not load."));
          document.head.append(script);
        });
      }
      turnstileWidget = window.turnstile?.render(turnstileContainer, {
        sitekey: props.turnstileSiteKey,
        theme: "light",
        size: "flexible",
        action: "wishlist",
      });
    } catch (error) {
      setStatusHasError(true);
      setStatus(errorMessage(error, "Verification could not load."));
    }
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!form?.reportValidity()) return;

    const data = new FormData(form);
    const link = String(data.get("link")).trim();
    try {
      const url = new URL(link);
      if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    } catch {
      const linkInput = form.querySelector<HTMLInputElement>("#link");
      linkInput?.setCustomValidity("Enter a valid http or https link.");
      form.reportValidity();
      return;
    }
    form.querySelector<HTMLInputElement>("#link")?.setCustomValidity("");

    const turnstileToken = props.turnstileSiteKey
      ? (window.turnstile?.getResponse(turnstileWidget) ?? "")
      : "";
    if (props.turnstileSiteKey && !turnstileToken) {
      setStatusHasError(true);
      setStatus("Please complete the verification first.");
      return;
    }

    setStatus("");
    setStatusHasError(false);
    setSubmitting(true);

    try {
      const result = await api<CreateWishResponse>("/api/wishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author: String(data.get("author")).trim(),
          name: String(data.get("name")).trim(),
          link,
          turnstileToken,
        }),
      });
      setWishes((current) => [...current, result.wish]);
      const nextTokens = {
        ...deleteTokens(),
        [result.wish.id]: result.deleteToken,
      };
      setDeleteTokens(nextTokens);
      storeDeleteTokens(nextTokens);
      setLoaded(true);
      form.reset();
      window.turnstile?.reset(turnstileWidget);
      setStatus("Your wish has been added. Merry Christmas!");
      form.querySelector<HTMLInputElement>("#name")?.focus();
    } catch (error) {
      window.turnstile?.reset(turnstileWidget);
      setStatusHasError(true);
      setStatus(errorMessage(error, "Could not add your wish."));
    } finally {
      setSubmitting(false);
    }
  }

  function clearStatus() {
    setStatus("");
    setStatusHasError(false);
  }

  function readDeleteTokens() {
    try {
      const stored = JSON.parse(localStorage.getItem(DELETE_TOKENS_KEY) ?? "{}");
      if (stored && typeof stored === "object" && !Array.isArray(stored)) {
        return stored as Record<string, string>;
      }
    } catch {
      // Ignore malformed or unavailable browser storage.
    }
    return {};
  }

  function storeDeleteTokens(tokens: Record<string, string>) {
    try {
      localStorage.setItem(DELETE_TOKENS_KEY, JSON.stringify(tokens));
    } catch {
      // The wish is still removable until the browser session ends.
    }
  }

  async function handleRemove(wish: Wish) {
    const token = deleteTokens()[wish.id];
    if (!token) return;
    if (!window.confirm(`Remove “${wish.name}” from the wishlist?`)) return;

    clearStatus();
    setRemovingId(wish.id);

    try {
      await api<{ ok: true }>(`/api/wishes/${encodeURIComponent(wish.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteToken: token }),
      });
      setWishes((current) => current.filter((item) => item.id !== wish.id));
      const next = { ...deleteTokens() };
      delete next[wish.id];
      setDeleteTokens(next);
      storeDeleteTokens(next);
      setStatus("Wish removed.");
    } catch (error) {
      setStatusHasError(true);
      setStatus(errorMessage(error, "Could not remove your wish."));
    } finally {
      setRemovingId(null);
    }
  }

  onMount(() => {
    setDeleteTokens(readDeleteTokens());
    void loadWishes();
    void setupTurnstile();
  });

  return (
    <div class="wishlist-layout">
      <section class="wishes-section" aria-labelledby="wishes-title">
        <div class="section-heading">
          <div>
            <p class="section-kicker">The good stuff</p>
            <h2 id="wishes-title">Everyone’s wishes</h2>
          </div>
          <Show when={loaded()}>
            <span class="wish-count" aria-live="polite">
              {wishes().length} {wishes().length === 1 ? "gift idea" : "gift ideas"}
            </span>
          </Show>
        </div>

        <div class="wishlist">
          <For each={groups()}>
            {(group) => (
              <article class="author-card">
                <header class="author-header">
                  <div class="avatar" aria-hidden="true">
                    {group.author.charAt(0).toLocaleUpperCase()}
                  </div>
                  <div class="author-details">
                    <h3>{group.author}</h3>
                    <p>
                      {group.wishes.length} {group.wishes.length === 1 ? "wish" : "wishes"}
                    </p>
                  </div>
                  <span class="author-sparkle" aria-hidden="true">
                    ✧
                  </span>
                </header>
                <ul class="author-wishes">
                  <For each={group.wishes}>
                    {(wish) => (
                      <li class="wish-item">
                        <a
                          href={wish.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${wish.name} (opens in a new tab)`}
                        >
                          <span class="wish-bullet" aria-hidden="true" />
                          <span class="wish-copy">
                            <span class="wish-name">{wish.name}</span>
                            <span class="wish-domain">{domainFrom(wish.link)}</span>
                          </span>
                          <svg
                            class="wish-arrow"
                            viewBox="0 0 20 20"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M5 15 15 5m-8 0h8v8"
                              stroke="currentColor"
                              stroke-width="1.5"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                          </svg>
                        </a>
                        <Show when={deleteTokens()[wish.id]}>
                          <button
                            class="remove-wish"
                            type="button"
                            title="Remove wish"
                            aria-label={`Remove ${wish.name}`}
                            disabled={removingId() === wish.id}
                            onClick={() => void handleRemove(wish)}
                          >
                            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                              <path
                                d="M4 6h12M8 3h4M6 6l.7 10h6.6L14 6M8 9v4M12 9v4"
                                stroke="currentColor"
                                stroke-width="1.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              />
                            </svg>
                          </button>
                        </Show>
                      </li>
                    )}
                  </For>
                </ul>
              </article>
            )}
          </For>
        </div>

        <Show when={listMessage()}>
          <p class="list-status" classList={{ error: listHasError() }} role="status">
            {listMessage()}
          </p>
        </Show>

        <Show when={loaded() && wishes().length === 0}>
          <div class="empty-state">
            <span aria-hidden="true">✧</span>
            <h3>No wishes just yet</h3>
            <p>Be the first to add a little something to the list.</p>
          </div>
        </Show>
      </section>

      <div class="form-column">
        <div class="form-decoration" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none">
            <path
              d="M12 27h40v29H12zM8 19h48v12H8zM32 19v37"
              stroke="currentColor"
              stroke-width="2.2"
            />
            <path
              d="M32 19c-7 0-14-2.4-14-8 0-3 2.4-5 5.4-5C28.7 6 32 19 32 19Zm0 0c7 0 14-2.4 14-8 0-3-2.4-5-5.4-5C35.3 6 32 19 32 19Z"
              stroke="currentColor"
              stroke-width="2.2"
            />
            <path d="m53 4 1.2 3.8L58 9l-3.8 1.2L53 14l-1.2-3.8L48 9l3.8-1.2L53 4Z" fill="currentColor" />
          </svg>
        </div>
        <aside class="form-card" aria-labelledby="form-title">
          <p class="section-kicker">Make it merry</p>
          <h2 id="form-title">Add to the wishlist</h2>
          <p class="form-intro">What would make your Christmas a little brighter?</p>

        <form
          id="wish-form"
          aria-busy={submitting()}
          ref={(element) => {
            form = element;
          }}
          onSubmit={handleSubmit}
          onInput={(event) => {
            if (event.target instanceof HTMLInputElement) event.target.setCustomValidity("");
            clearStatus();
          }}
        >
          <label for="author">Your name</label>
          <input
            id="author"
            name="author"
            type="text"
            placeholder="e.g. Charlie"
            autocomplete="name"
            maxlength="60"
            required
          />

          <label for="name">What are you wishing for?</label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="e.g. A really good book"
            maxlength="120"
            required
          />

          <label for="link">Gift link</label>
          <div class="link-input">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="m10 13.8 4-4m-6.5 7.7-1.2 1.2a3.8 3.8 0 0 1-5.4-5.4l4.6-4.6a3.8 3.8 0 0 1 5.4 0m5.6-2.2 1.2-1.2a3.8 3.8 0 0 1 5.4 5.4l-4.6 4.6a3.8 3.8 0 0 1-5.4 0"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
              />
            </svg>
            <input
              id="link"
              name="link"
              type="url"
              placeholder="https://..."
              inputmode="url"
              maxlength="2000"
              required
            />
          </div>
          <p class="field-hint">Add a link to help your gift-giver find it.</p>

          <div ref={turnstileContainer} class="turnstile-container" />

          <button type="submit" disabled={submitting()}>
            <span>{submitting() ? "Adding…" : "Add my wish"}</span>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 12h14m-5-5 5 5-5 5"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <Show when={status()}>
            <p class="form-status" classList={{ error: statusHasError() }} role="status">
              {status()}
            </p>
          </Show>
        </form>

        <p class="storage-note">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.2" />
            <path
              d="M2 8h12M8 2c1.6 1.5 2.5 3.6 2.5 6S9.6 12.5 8 14C6.4 12.5 5.5 10.4 5.5 8S6.4 3.5 8 2Z"
              stroke="currentColor"
              stroke-width="1.2"
            />
          </svg>
          Wishes are shared publicly. You can remove wishes you added from this
          browser.
        </p>
        </aside>
      </div>
    </div>
  );
}
