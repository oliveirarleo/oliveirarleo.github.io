import { createSignal, Show } from "solid-js";
import type { StoredUser } from "../../lib/user-secrets";
import type { CreateWishInput } from "../../lib/wishlist-api";
import type { TurnstileFieldHandle } from "./TurnstileField";
import TurnstileField from "./TurnstileField";

export default function WishlistForm(props: {
  activeUser: StoredUser | null;
  turnstileSiteKey?: string | undefined;
  onCreate: (input: Omit<CreateWishInput, "secret">) => Promise<boolean>;
  onInput: () => void;
}) {
  const [submitting, setSubmitting] = createSignal(false);
  const [validationMessage, setValidationMessage] = createSignal("");
  let form: HTMLFormElement | undefined;
  let turnstile: TurnstileFieldHandle | undefined;

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!form?.reportValidity()) return;
    const data = new FormData(form);
    const linkInput = form.querySelector<HTMLInputElement>("#link");
    const link = String(data.get("link")).trim();
    try {
      const url = new URL(link);
      if (
        (url.protocol !== "https:" && url.protocol !== "http:") ||
        url.username ||
        url.password
      ) {
        throw new Error();
      }
    } catch {
      linkInput?.setCustomValidity(
        "Enter a valid http or https link without credentials.",
      );
      form.reportValidity();
      return;
    }
    linkInput?.setCustomValidity("");
    const turnstileToken = props.turnstileSiteKey
      ? (turnstile?.token() ?? "")
      : "";
    if (props.turnstileSiteKey && !turnstileToken) {
      setValidationMessage("Please complete the verification first.");
      return;
    }
    setValidationMessage("");

    setSubmitting(true);
    const created = await props.onCreate({
      author: props.activeUser?.name ?? String(data.get("author")).trim(),
      name: String(data.get("name")).trim(),
      link,
      turnstileToken,
    });
    setSubmitting(false);
    turnstile?.reset();
    if (created) {
      form.reset();
      form.querySelector<HTMLInputElement>("#name")?.focus();
    }
  }

  return (
    <form
      id="wish-form"
      aria-busy={submitting()}
      ref={form}
      onSubmit={submit}
      onInput={(event) => {
        if (event.target instanceof HTMLInputElement)
          event.target.setCustomValidity("");
        setValidationMessage("");
        props.onInput();
      }}
    >
      <Show when={!props.activeUser}>
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
      </Show>

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
            d="m10 13.8 4-4m-6.5 7.7-1.2 1.2a3.8 3.8 0 0 1-5.4-5.4l4.6-4.6a3.8 3.8 0 0 1 5.4 0m5.6-2.2 1.2 1.2a3.8 3.8 0 0 1 5.4 5.4l-4.6 4.6a3.8 3.8 0 0 1-5.4 0"
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

      <TurnstileField
        handleRef={(handle) => (turnstile = handle)}
        siteKey={props.turnstileSiteKey}
      />
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
      <Show when={validationMessage()}>
        <p class="form-status error" role="status">
          {validationMessage()}
        </p>
      </Show>
    </form>
  );
}
