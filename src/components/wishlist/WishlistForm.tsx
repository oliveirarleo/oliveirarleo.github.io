import { ArrowRight } from "lucide-solid";
import { createSignal, Show } from "solid-js";
import type { StoredUser } from "../../lib/user-secrets";
import type { CreateWishInput } from "../../lib/wishlist-api";
import type { TurnstileFieldHandle } from "./TurnstileField";
import TurnstileField from "./TurnstileField";
import { readTurnstileToken, turnstileTokenMissing } from "./turnstile-token";
import WishFields, { wishLabelClass } from "./WishFields";
import { INVALID_LINK_MESSAGE, validWishLink } from "./wish-link";

export default function WishlistForm(props: {
  activeUser: StoredUser | null;
  turnstileSiteKey?: string | undefined;
  onCreate: (input: CreateWishInput) => Promise<boolean>;
  onInput: () => void;
  onCreated?: (() => void) | undefined;
}) {
  const [submitting, setSubmitting] = createSignal(false);
  const [validationMessage, setValidationMessage] = createSignal("");
  let form: HTMLFormElement | undefined;
  let turnstile: TurnstileFieldHandle | undefined;

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!form?.reportValidity()) return;
    const data = new FormData(form);
    const linkInput = form.querySelector<HTMLInputElement>('[name="link"]');
    const link = String(data.get("link")).trim();
    if (!validWishLink(link)) {
      linkInput?.setCustomValidity(INVALID_LINK_MESSAGE);
      form.reportValidity();
      return;
    }
    linkInput?.setCustomValidity("");
    const turnstileToken = readTurnstileToken(
      props.turnstileSiteKey,
      turnstile,
    );
    if (turnstileTokenMissing(props.turnstileSiteKey, turnstileToken)) {
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
      form.querySelector<HTMLInputElement>('[name="name"]')?.focus();
      props.onCreated?.();
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
        <label class={wishLabelClass} for="author">
          Your name
        </label>
        <input
          id="author"
          name="author"
          type="text"
          class="input h-[43px] w-full bg-white text-[13px] text-[#35483e] placeholder:text-[#9aa39b] focus:outline-none focus:border-[#779083] focus:shadow-[0_0_0_3px_#355a4a17]"
          placeholder="e.g. Charlie"
          autocomplete="name"
          maxlength="60"
          required
        />
      </Show>

      <WishFields idPrefix="create-wish" />

      <TurnstileField
        handleRef={(handle) => (turnstile = handle)}
        siteKey={props.turnstileSiteKey}
      />
      <button
        type="submit"
        class="btn btn-secondary mt-1 h-[46px] w-full gap-[13px] text-[13px] font-[650]"
        disabled={submitting()}
      >
        <span>{submitting() ? "Adding…" : "Add my wish"}</span>
        <ArrowRight size={17} aria-hidden="true" />
      </button>
      <Show when={validationMessage()}>
        <div class="alert alert-error alert-soft mt-2 text-sm" role="status">
          {validationMessage()}
        </div>
      </Show>
    </form>
  );
}
