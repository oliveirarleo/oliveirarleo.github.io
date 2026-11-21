import { createEffect, createSignal, For, Show } from "solid-js";
import type { StoredUser } from "../../lib/user-secrets";
import { normalizeUserSecret, validUserSecret } from "../../lib/user-secrets";
import type { TurnstileFieldHandle } from "./TurnstileField";
import TurnstileField from "./TurnstileField";

export default function UserSession(props: {
  activeUser: StoredUser | null;
  knownUsers: StoredUser[];
  status: string;
  statusHasError: boolean;
  turnstileSiteKey?: string | undefined;
  onAssume: (secret: string, token: string) => Promise<boolean>;
  onSelect: (userId: string) => void;
  onSwitch: () => void;
  onForget: () => void;
  onRotate: () => Promise<boolean>;
}) {
  const [copyMessage, setCopyMessage] = createSignal("");
  const [assuming, setAssuming] = createSignal(false);
  const [secret, setSecret] = createSignal("");
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [optionsOpen, setOptionsOpen] = createSignal(false);
  const [secretVisible, setSecretVisible] = createSignal(false);
  let turnstile: TurnstileFieldHandle | undefined;
  let dialog: HTMLDialogElement | undefined;
  let optionsDialog: HTMLDialogElement | undefined;

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

  async function assume(event: SubmitEvent) {
    event.preventDefault();
    const normalized = normalizeUserSecret(secret());
    if (!validUserSecret(normalized)) return;
    const token = props.turnstileSiteKey ? (turnstile?.token() ?? "") : "";
    if (props.turnstileSiteKey && !token) {
      setCopyMessage("Complete the verification before using your secret.");
      return;
    }
    setAssuming(true);
    const success = await props.onAssume(normalized, token);
    setAssuming(false);
    turnstile?.reset();
    if (success) {
      setSecret("");
      setCopyMessage("");
      dialog?.close();
    }
  }

  return (
    <section class="user-session" aria-labelledby="session-title">
      <Show
        when={props.activeUser}
        fallback={
          <>
            <h3 id="session-title">Already have a secret?</h3>
            <p>Manage your wishes on this device.</p>
            <button
              type="button"
              class="secondary-button open-session-button"
              onClick={() => setDialogOpen(true)}
            >
              Use an existing secret
            </button>
            <Show when={props.knownUsers.length > 0}>
              <div class="known-users">
                <For each={props.knownUsers}>
                  {(user) => (
                    <button
                      type="button"
                      class="text-button"
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
          <div class="session-heading">
            <div>
              <h3 id="session-title">Posting as {user().name}</h3>
            </div>
            <button
              type="button"
              class="secondary-button code-button"
              onClick={() => setOptionsOpen(true)}
            >
              Code
            </button>
          </div>
        )}
      </Show>
      <Show when={copyMessage() && !dialogOpen() && !optionsOpen()}>
        <p class="session-message" role="status">
          {copyMessage()}
        </p>
      </Show>

      <dialog
        ref={dialog}
        class="confirm-dialog session-dialog"
        aria-labelledby="session-dialog-title"
        onCancel={(event) => {
          event.preventDefault();
          if (!assuming()) dialog?.close();
        }}
        onClose={() => setDialogOpen(false)}
      >
        <Show when={dialogOpen()}>
          <h3 id="session-dialog-title">Use an existing secret</h3>
          <p>
            Enter your six-character code to manage your wishes on this device.
          </p>
          <form class="session-form" onSubmit={assume}>
            <label for="user-secret">Six-character secret</label>
            <input
              id="user-secret"
              value={secret()}
              onInput={(event) =>
                setSecret(normalizeUserSecret(event.currentTarget.value))
              }
              placeholder="ABC234"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck={false}
              minlength={6}
              maxlength={6}
              pattern="[A-Za-z2-9]{6}"
              required
            />
            <TurnstileField
              handleRef={(handle) => (turnstile = handle)}
              siteKey={props.turnstileSiteKey}
            />
            <Show when={copyMessage() || props.status}>
              <p
                class="session-message"
                classList={{ error: props.statusHasError }}
                role="status"
              >
                {copyMessage() || props.status}
              </p>
            </Show>
            <div class="dialog-actions">
              <button
                type="button"
                class="secondary-button"
                disabled={assuming()}
                onClick={() => dialog?.close()}
              >
                Cancel
              </button>
              <button
                type="submit"
                class="secondary-button"
                disabled={assuming()}
              >
                {assuming() ? "Checking…" : "Use my secret"}
              </button>
            </div>
          </form>
        </Show>
      </dialog>

      <dialog
        ref={optionsDialog}
        class="confirm-dialog session-dialog"
        aria-labelledby="options-dialog-title"
        onCancel={() => setSecretVisible(false)}
        onClose={() => {
          setOptionsOpen(false);
          setSecretVisible(false);
        }}
      >
        <Show when={optionsOpen() && props.activeUser}>
          {(user) => (
            <>
              <h3 id="options-dialog-title">Your user secret</h3>
              <p>Save it to manage {user().name}’s wishes on any browser.</p>
              <div class="secret-row">
                <code class="user-secret">
                  {secretVisible() ? user().secret : "••••••"}
                </code>
                <button
                  type="button"
                  class="icon-button"
                  aria-label={
                    secretVisible() ? "Hide user secret" : "Show user secret"
                  }
                  title={secretVisible() ? "Hide secret" : "Show secret"}
                  onClick={() => setSecretVisible((visible) => !visible)}
                >
                  <Show
                    when={secretVisible()}
                    fallback={
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
                          stroke="currentColor"
                          stroke-width="1.6"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="2.5"
                          stroke="currentColor"
                          stroke-width="1.6"
                        />
                      </svg>
                    }
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="m3 3 18 18M10.6 6.1c.5-.1.9-.1 1.4-.1 6.5 0 10 6 10 6a18 18 0 0 1-3.1 3.8M6.2 6.2C3.4 8.1 2 12 2 12s3.5 6 10 6c1.4 0 2.6-.3 3.7-.7M9.9 9.9a3 3 0 0 0 4.2 4.2"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                      />
                    </svg>
                  </Show>
                </button>
                <button
                  type="button"
                  class="secondary-button"
                  onClick={copySecret}
                >
                  Copy
                </button>
              </div>
              <p class="secret-warning">
                Anyone with this code can manage your wishes. If you lose it, an
                admin reset is required.
              </p>
              <Show when={copyMessage() || props.status}>
                <p
                  class="session-message"
                  classList={{ error: props.statusHasError }}
                  role="status"
                >
                  {copyMessage() || props.status}
                </p>
              </Show>
              <div class="session-actions">
                <button
                  type="button"
                  class="text-button"
                  onClick={() => void props.onRotate()}
                >
                  Rotate secret
                </button>
                <button
                  type="button"
                  class="text-button"
                  onClick={() => {
                    props.onSwitch();
                    optionsDialog?.close();
                  }}
                >
                  Switch user
                </button>
                <button
                  type="button"
                  class="text-button danger"
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
      </dialog>
    </section>
  );
}
