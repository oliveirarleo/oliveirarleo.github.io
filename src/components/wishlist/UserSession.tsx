import { createSignal, For, Show } from "solid-js";
import type { StoredUser } from "../../lib/user-secrets";
import { normalizeUserSecret, validUserSecret } from "../../lib/user-secrets";
import type { TurnstileFieldHandle } from "./TurnstileField";
import TurnstileField from "./TurnstileField";

export default function UserSession(props: {
  activeUser: StoredUser | null;
  knownUsers: StoredUser[];
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
  let turnstile: TurnstileFieldHandle | undefined;

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
    }
  }

  return (
    <section class="user-session" aria-labelledby="session-title">
      <Show
        when={props.activeUser}
        fallback={
          <>
            <h3 id="session-title">Use an existing secret</h3>
            <p>
              Enter your six-character code to manage your wishes on this
              device.
            </p>
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
              <button
                type="submit"
                class="secondary-button"
                disabled={assuming()}
              >
                {assuming() ? "Checking…" : "Use my secret"}
              </button>
            </form>
          </>
        }
      >
        {(user) => (
          <>
            <div class="session-heading">
              <div>
                <h3 id="session-title">Your user secret</h3>
                <p>Save it to manage {user().name}’s wishes on any browser.</p>
              </div>
              <span class="active-user">{user().name}</span>
            </div>
            <div class="secret-row">
              <code class="user-secret">{user().secret}</code>
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
                onClick={props.onSwitch}
              >
                Switch user
              </button>
              <button
                type="button"
                class="text-button danger"
                onClick={props.onForget}
              >
                Forget this device
              </button>
            </div>
          </>
        )}
      </Show>
      <Show when={copyMessage()}>
        <p class="session-message" role="status">
          {copyMessage()}
        </p>
      </Show>
    </section>
  );
}
