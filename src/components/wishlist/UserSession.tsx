import { Eye, EyeOff } from "lucide-solid";
import { createEffect, createSignal, For, Show } from "solid-js";
import type { StoredUser } from "../../lib/user-secrets";
import {
  normalizeUserSecret,
  SECRET_LENGTH,
  SECRET_PATTERN,
  validUserSecret,
} from "../../lib/user-secrets";
import { alertTone } from "./alertTone";
import DialogClose from "./DialogClose";
import type { TurnstileFieldHandle } from "./TurnstileField";
import TurnstileField from "./TurnstileField";
import { readTurnstileToken, turnstileTokenMissing } from "./turnstile-token";

export default function UserSession(props: {
  activeUser: StoredUser | null;
  knownUsers: StoredUser[];
  status: string;
  statusHasError: boolean;
  turnstileSiteKey?: string | undefined;
  onAssume: (name: string, secret: string, token: string) => Promise<boolean>;
  onSelect: (userId: string) => void;
  onSwitch: () => void;
  onForget: () => void;
  onRotate: (turnstileToken: string) => Promise<boolean>;
}) {
  const [copyMessage, setCopyMessage] = createSignal("");
  const [formError, setFormError] = createSignal("");
  const [assuming, setAssuming] = createSignal(false);
  const [name, setName] = createSignal("");
  const [secret, setSecret] = createSignal("");
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [optionsOpen, setOptionsOpen] = createSignal(false);
  const [secretVisible, setSecretVisible] = createSignal(false);
  let turnstile: TurnstileFieldHandle | undefined;
  let rotateTurnstile: TurnstileFieldHandle | undefined;
  let dialog: HTMLDialogElement | undefined;
  let optionsDialog: HTMLDialogElement | undefined;
  const [rotating, setRotating] = createSignal(false);

  createEffect(() => {
    if (dialogOpen() && !dialog?.open) dialog?.showModal();
    if (optionsOpen() && !optionsDialog?.open) optionsDialog?.showModal();
  });

  async function copySecret() {
    if (!props.activeUser) return;
    try {
      await navigator.clipboard.writeText(props.activeUser.secret);
      setCopyMessage("Secret copied.");
    } catch {
      setCopyMessage("Select the six characters above to copy them.");
    }
  }

  async function rotate() {
    const token = readTurnstileToken(props.turnstileSiteKey, rotateTurnstile);
    if (turnstileTokenMissing(props.turnstileSiteKey, token)) {
      setCopyMessage("Complete the verification before rotating your secret.");
      return;
    }
    setRotating(true);
    const success = await props.onRotate(token);
    setRotating(false);
    rotateTurnstile?.reset();
    if (success) setSecretVisible(true);
  }

  async function assume(event: SubmitEvent) {
    event.preventDefault();
    const normalized = normalizeUserSecret(secret());
    const trimmedName = name().trim();
    if (!trimmedName) {
      setFormError("Enter the name you posted your wish under.");
      return;
    }
    if (!validUserSecret(normalized)) {
      setFormError(
        `Enter your ${SECRET_LENGTH}-character secret: letters A–Z and digits 2–9.`,
      );
      return;
    }
    const token = readTurnstileToken(props.turnstileSiteKey, turnstile);
    if (turnstileTokenMissing(props.turnstileSiteKey, token)) {
      setFormError("Complete the verification before using your secret.");
      return;
    }
    setFormError("");
    setAssuming(true);
    const success = await props.onAssume(trimmedName, normalized, token);
    setAssuming(false);
    turnstile?.reset();
    if (success) {
      setName("");
      setSecret("");
      setCopyMessage("");
      dialog?.close();
    }
  }

  return (
    <section
      class="mb-6 rounded-lg border border-[#e4e1d7] bg-[#faf8f2] p-4"
      aria-labelledby="session-title"
    >
      <Show
        when={props.activeUser?.sessionToken ? props.activeUser : null}
        fallback={
          <>
            <h3
              id="session-title"
              class="font-display m-0 mb-[5px] text-[18px] leading-[22px] text-[#27493e]"
            >
              {props.activeUser
                ? "Your session ended"
                : "Already have a secret?"}
            </h3>
            <p class="m-0 text-[11px] leading-[17px] text-[#7a817a]">
              {props.activeUser
                ? `Enter ${props.activeUser.name}’s secret again to keep managing these wishes.`
                : "Manage your wishes on this device."}
            </p>
            <button
              type="button"
              class="mt-3 inline-flex h-9 items-center justify-center rounded-md border border-[#d7ddd5] bg-white px-3 text-[11px] text-[#355a4a] transition-colors hover:bg-base-200"
              onClick={() => setDialogOpen(true)}
            >
              Use an existing secret
            </button>
            <Show when={props.knownUsers.length > 0}>
              <div class="mt-3 flex flex-wrap gap-1.5">
                <For each={props.knownUsers}>
                  {(user) => (
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs"
                      onClick={() => props.onSelect(user.id)}
                    >
                      {user.name}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </>
        }
      >
        {(user) => (
          <div class="flex items-center justify-between gap-3">
            <h3
              id="session-title"
              class="font-display m-0 truncate text-[18px] leading-[22px] text-[#27493e]"
            >
              Posting as {user().name}
            </h3>
            <button
              type="button"
              class="inline-flex h-[30px] shrink-0 items-center rounded-md border border-[#d7ddd5] bg-white px-3 text-[11px] font-[650] text-[#355a4a] transition-colors hover:bg-base-200"
              onClick={() => setOptionsOpen(true)}
            >
              Code
            </button>
          </div>
        )}
      </Show>
      <Show when={copyMessage() && !dialogOpen() && !optionsOpen()}>
        <p class="mt-3 mb-0 text-xs text-base-content/60" role="status">
          {copyMessage()}
        </p>
      </Show>

      <dialog
        ref={dialog}
        class="modal"
        aria-labelledby="session-dialog-title"
        onCancel={(event) => {
          event.preventDefault();
          if (!assuming()) dialog?.close();
        }}
        onClose={() => setDialogOpen(false)}
      >
        <div class="modal-box relative max-w-sm">
          <DialogClose label="Close secret dialog" disabled={assuming()} />
          <Show when={dialogOpen()}>
            <h3
              id="session-dialog-title"
              class="font-display m-0 pr-10 text-xl"
            >
              Use an existing secret
            </h3>
            <p class="mt-2 text-sm text-base-content/70">
              Enter your name and six-character secret to manage your wishes on
              this device.
            </p>
            <form class="mt-4 grid gap-1.5" onSubmit={assume}>
              <label class="label" for="user-name">
                Your name
              </label>
              <input
                id="user-name"
                class="input w-full focus:outline-none focus:border-[#779083] focus:shadow-[0_0_0_3px_#355a4a17]"
                value={name()}
                onInput={(event) => {
                  setName(event.currentTarget.value);
                  setFormError("");
                }}
                autocomplete="username"
                maxlength="60"
                required
              />
              <label class="label" for="user-secret">
                Six-character secret
              </label>
              <input
                id="user-secret"
                class="input w-full text-center font-mono text-lg tracking-[0.3em] uppercase focus:outline-none focus:border-[#779083] focus:shadow-[0_0_0_3px_#355a4a17]"
                value={secret()}
                onInput={(event) => {
                  setSecret(normalizeUserSecret(event.currentTarget.value));
                  setFormError("");
                }}
                placeholder="ABC234"
                autocomplete="off"
                autocapitalize="characters"
                spellcheck={false}
                minlength={SECRET_LENGTH}
                maxlength={SECRET_LENGTH}
                pattern={SECRET_PATTERN}
                required
              />
              <TurnstileField
                handleRef={(handle) => (turnstile = handle)}
                siteKey={props.turnstileSiteKey}
              />
              <Show when={formError() || props.status}>
                <div
                  class="alert alert-soft text-sm"
                  classList={alertTone(
                    Boolean(formError()) || props.statusHasError,
                  )}
                  role="status"
                >
                  {formError() || props.status}
                </div>
              </Show>
              <div class="modal-action">
                <button
                  type="button"
                  class="btn btn-ghost"
                  disabled={assuming()}
                  onClick={() => dialog?.close()}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="btn btn-primary"
                  disabled={assuming()}
                >
                  {assuming() ? "Checking…" : "Use my secret"}
                </button>
              </div>
            </form>
          </Show>
        </div>
      </dialog>

      <dialog
        ref={optionsDialog}
        class="modal"
        aria-labelledby="options-dialog-title"
        onCancel={() => setSecretVisible(false)}
        onClose={() => {
          setOptionsOpen(false);
          setSecretVisible(false);
        }}
      >
        <div class="modal-box relative max-w-sm">
          <DialogClose label="Close secret options" />
          <Show when={optionsOpen() && props.activeUser}>
            {(user) => (
              <>
                <h3
                  id="options-dialog-title"
                  class="font-display m-0 pr-10 text-xl"
                >
                  Your user secret
                </h3>
                <p class="mt-2 text-sm text-base-content/70">
                  Save it to manage {user().name}’s wishes on any browser.
                </p>
                <div class="mt-3 flex items-center gap-2">
                  <code class="flex-1 rounded-field border border-base-300 bg-base-200 py-2 text-center font-mono text-lg tracking-[0.35em]">
                    {secretVisible() ? user().secret : "••••••"}
                  </code>
                  <button
                    type="button"
                    class="btn btn-circle btn-ghost btn-sm"
                    aria-label={
                      secretVisible() ? "Hide user secret" : "Show user secret"
                    }
                    title={secretVisible() ? "Hide secret" : "Show secret"}
                    onClick={() => setSecretVisible((visible) => !visible)}
                  >
                    <Show
                      when={secretVisible()}
                      fallback={<Eye size={18} aria-hidden="true" />}
                    >
                      <EyeOff size={18} aria-hidden="true" />
                    </Show>
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline btn-sm"
                    onClick={copySecret}
                  >
                    Copy
                  </button>
                </div>
                <div class="alert alert-warning alert-soft mt-3 text-xs">
                  Anyone with this code can manage your wishes. If you lose it,
                  an admin reset is required.
                </div>
                <TurnstileField
                  handleRef={(handle) => (rotateTurnstile = handle)}
                  siteKey={props.turnstileSiteKey}
                />
                <Show when={copyMessage() || props.status}>
                  <div
                    class="alert alert-soft mt-3 text-sm"
                    classList={alertTone(props.statusHasError)}
                    role="status"
                  >
                    {copyMessage() || props.status}
                  </div>
                </Show>
                <div class="mt-3 flex flex-nowrap items-center justify-end gap-0.5">
                  <button
                    type="button"
                    class="btn btn-link btn-sm whitespace-nowrap px-1 text-[11px]"
                    disabled={rotating()}
                    onClick={() => void rotate()}
                  >
                    {rotating() ? "Rotating…" : "Rotate secret"}
                  </button>
                  <button
                    type="button"
                    class="btn btn-link btn-sm whitespace-nowrap px-1 text-[11px]"
                    onClick={() => {
                      props.onSwitch();
                      optionsDialog?.close();
                    }}
                  >
                    Switch user
                  </button>
                  <button
                    type="button"
                    class="btn btn-link btn-sm whitespace-nowrap px-1 text-[11px] text-error"
                    onClick={() => {
                      props.onForget();
                      optionsDialog?.close();
                    }}
                  >
                    Forget this device
                  </button>
                </div>
              </>
            )}
          </Show>
        </div>
      </dialog>
    </section>
  );
}
