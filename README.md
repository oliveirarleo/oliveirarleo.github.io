# oliveirarleo's homepage

This is a blog based on Astro's blog template. You can access it at
[oliveirarleo.com](https://oliveirarleo.com). If you want to see how I built
this, take a look at
[oliveirarleo.com/tech/a-blog-in-a-day](https://oliveirarleo.com/tech/a-blog-in-a-day/).

The repository also contains the shared Christmas wishlist at
`https://oliveirarleo.com/wishlist/`.

## Running locally

```sh
pnpm i # install dependencies
pnpm dev # run the Astro site on http://localhost:4321
```

For the wishlist API, use a second terminal:

```sh
pnpm dev:api # run the API on http://localhost:8788
```

Or run both together with `just dev`, which starts Astro at
`http://localhost:4321/wishlist/` and the API at `http://localhost:8788`.

Development uses port 8788 for the API while production listens on 8787, so the
two can run on one machine without clashing.

Create a local `.env` based on `.env.example`, and set the frontend's API
address there so it points at the local API.

Turnstile is enforced by the API whenever `TURNSTILE_SECRET` is set, in any
`NODE_ENV`, on every route that writes or checks a secret (including session
rotation). When it is unset, as in a default development setup, the API skips
the check, so local work needs no Cloudflare keys or network access. Production
requires the secret. The site shows the widget only when
`PUBLIC_TURNSTILE_SITE_KEY` is set, so production must set both values: with the
secret set and no site key, the widget is hidden and every write is rejected.

### Build

```sh
just build # or: pnpm build, then pnpm astro preview
```

Other useful recipes:

```sh
just install     # install dependencies
just check       # Astro type-check + all tests
just migrations  # generate Drizzle migrations after editing the schema
just seed        # fill the dev database with demo authors and wishes
just clean       # remove every wish and author from the dev database
```

## Wishlist architecture

- **Frontend:** Astro + Solid island at `/wishlist/`, built statically and
  deployed to GitHub Pages.
- **UI:** Tailwind CSS v4 + DaisyUI with a custom Christmas theme in
  `src/styles/ui.css`. The page shell and the wishlist components use Tailwind
  utilities only; the old `wishlist.css` stylesheet is gone. This restyle and
  the `just seed`/`just clean` helpers shipped alongside the user-secret
  migration and are not part of the ADR 0001 decision. `ui.css` holds only the
  theme, the paper-grain background class, and the reduced-motion rule.
- **Public page:** `https://oliveirarleo.com/wishlist/`, deployed to GitHub
  Pages. No Worker or separate subdomain is required.
- **Shared API:** Hono + Effect + Drizzle on `node:sqlite`, running on the
  NixOS server. Drizzle is pinned to the 1.0 release candidate because the
  stable release does not yet ship the `node:sqlite` driver.
- **Public API host:** `wishlist-api.oliveirarleo.com` through Cloudflare
  Tunnel.
- **Storage:** a single SQLite database on the server (see Backups).
- **Migrations:** versioned SQL files in `server/migrations/`, generated with
  Drizzle Kit and applied automatically when the API starts.
- **Identity and authorization:** Better Auth owns identity. Names are its
  usernames, the six-character user secret is the password, and sessions are
  bearer tokens. No public Better Auth routes are mounted. See
  `docs/adr/0001-user-secret-as-password.md` for the decision and its
  trade-offs.
- **Spam protection:** Cloudflare Turnstile plus strict in-memory rate limits
  per IP and globally on every route that checks a secret.

The API reads its configuration once at startup and fails fast with a clear
error when a value is missing or invalid.

Anyone can list the wishes (in pages) and add a wish. Signed-in users can
react to any wish; the owner of a name can edit or remove that name's wishes and
rotate its secret. Nobody else can. A health check reports whether the database
is reachable. GET responses never expose secrets, password hashes, placeholder
emails, or account details.

The first wish for a name creates a Better Auth user and a six-character
secret. The secret uses 34 symbols: the capital letters A–Z and the digits
2–9 (no 0 or 1, to avoid ambiguity). The browser keeps known secrets in local storage
so the owner can manage wishes from the same device, show the secret again, and
forget it. The same secret signs the user in on another browser, where it can add
and edit wishes, react, rotate the secret, and remove only that user's wishes.

**Editing and reactions.** `PATCH /api/wishes/:id` edits the name and link, and
only the owner's session is accepted. `PUT /api/wishes/:id/reaction` sets the
caller's single reaction (`DELETE` clears it, and changing emoji replaces the
old one). The palette is fixed in `shared/reactions.ts`, and reaction summaries
include the user ids that chose each emoji, so the list stays anonymous and can
be polled without a session.

Six characters from 34 symbols give about 30.5 bits of entropy, about 1.54
billion possibilities. Sign-in attempts have strict per-IP and global rate limits and
require Turnstile when it is configured. There is no self-service recovery
endpoint: a lost secret is reset by an administrator on the API host, which
prints a new code once.

### Resetting a user code

```sh
just reset-code leonardo          # dry run: resolves the name, writes nothing
just reset-code leonardo --yes    # installs a new code and prints it
just reset-code leonardo --yes --secret ABC234
```

The script replaces the Better Auth password, revokes that user's sessions, and
deletes any leftover `legacy_wishlist_secrets` row. It runs one transaction and
never touches the schema, so it is safe while the API is running. The printed
code is the only copy: hand it over privately. Use `--db <path>` to target
another database.

**Migration policy:** the Better Auth migration (`20261121102107_better_auth_username`) keeps every
existing wish, every existing name, and every existing secret. It renames the
old `wishlist_secrets` table to `legacy_wishlist_secrets` instead of dropping
it; on the first sign-in after the upgrade the API verifies that scrypt hash and
copies the same secret into the Better Auth password, so users keep the secret
they already have and never see a reset. That path depends on
`WISHLIST_SECRET_PEPPER`, which production already provides through sops. Once
the table is drained it can be dropped in a later migration. The earlier
migration `20261121033803` already reset wishes from before the user-secret
model, so a database that has not run it yet loses those wishes when it does.
Back up the database before deploying either migration.

### Database migrations

Edit `server/schema.ts`, then generate a migration:

```sh
just migrations
```

Commit the generated files in `server/migrations/`. The API applies pending
migrations before it accepts requests.

Drizzle tracks applied migrations by folder name. If a development database
still records an earlier name for a migration that was since renamed, the API
fails on restart with a duplicate-column error. Rename that recorded entry to
the current folder name, or delete the development database, before restarting.

### Environment files

| File           | Purpose                           | Loaded by               |
| -------------- | --------------------------------- | ----------------------- |
| `.env`         | Base local defaults               | Node and Astro          |
| `.dev.env`     | Development overrides, no secrets | Node via `pnpm dev:api` |
| `.env.example` | Documented base template          | Committed, not loaded   |

The API loads `.env` first and then `.dev.env`, so later files override earlier
ones. Existing shell or systemd variables win over both. Production uses its own
service environment and an environment file, so production secrets never sit in
an env file in the repository. `.dev.env` contains only public development
values.

Production secrets come from sops-nix. The Turnstile secret is copied from the
Turnstile widget in the Cloudflare dashboard, and the widget must allow the
`oliveirarleo.com` hostname. The Turnstile site key is public and goes into the
frontend configuration.

### Environment variables

`.env.example` documents every variable. In short:

- **Frontend** variables are read by Astro at build time and are public: the
  API address and the Turnstile site key (empty only when Turnstile is
  disabled).
- **Backend** variables set the bind address and port, the database location,
  the one browser origin allowed to call the API, the Turnstile secret, the
  Better Auth secret (at least 32 characters), and whether client IPs are read
  from proxy headers (enabled behind the Cloudflare Tunnel).
  `WISHLIST_SECRET_PEPPER` is only needed to upgrade accounts created before the
  Better Auth migration; it is already in the production sops environment.
- **`NODE_ENV`** is `development` by default; set `production` for the deployed
  API. In production the API refuses to start without `TURNSTILE_SECRET`, and it
  allows only the configured origin for CORS (no localhost). Seed and clean
  scripts refuse to run in production.

For GitHub Pages, the public site key is a repository variable named
`TURNSTILE_SITE_KEY`. The build workflow passes it to Astro.

## Deploying

Run the wizard on the NixOS server that runs the API:

```sh
just deploy # or: ./scripts/deploy-wizard.sh
```

It stops on the first failure, and everything before the switch is read-only:

1. preflight (clean `main`, commits to ship, current generation, row counts)
2. `astro check` and the full Vitest suite
3. a verified online SQLite snapshot in `/var/lib/wishlist/backups`
4. `nix flake update wishlist`, then `nixos-rebuild build` (no restart)
5. `nixos-rebuild switch`, then health, row counts, and the backup timer
6. `git push origin main` and the GitHub Pages workflow

Anything that fails after the switch restores the snapshot and the previous
system generation (`nixos-rebuild switch --rollback`). The wizard asks before
the switch and again before the push, so the API can be verified while the
old site is still live.

## Deploying the API on NixOS

Add the repository as a flake input in `/etc/nixos/flake.nix` and import its
NixOS module. The module builds the API from a locked copy of the repository,
so a checkout or a separate source option is not needed. Do not copy
`nixos/wishlist` into `/etc/nixos`.

In `configuration.nix`, keep both secrets out of the Nix store with sops-nix:
store the Turnstile and Better Auth secrets in sops, render them into an
environment file owned by the service user, and point the module's environment
file option at it. Then set the Cloudflare Tunnel ID and credentials file. The
module documents every option in `nixos/wishlist/default.nix`.

Generate an independent Better Auth secret with `openssl rand -base64 48` and
store it in sops.

The module configures the Cloudflare Tunnel ingress for the API hostname
automatically. Create the public DNS route once with `cloudflared tunnel route
dns`, and do not open the API port in the firewall: the API is only reachable
through the tunnel.

Before the first restart after the Better Auth migration, stop the service and
back up the database:

```sh
sudo systemctl stop wishlist
sudo sqlite3 /var/lib/wishlist/wishes.db \
  ".backup '/var/lib/wishlist/wishes-pre-user-secrets.db'"
```

Then rebuild and switch:

```sh
sudo nixos-rebuild switch --flake /etc/nixos#<hostname>
```

The module's package is built with `buildNpmPackage` from `package-lock.json`,
which only the Nix build uses. Local development and CI use pnpm.

### Backups

The database uses SQLite in WAL mode. Losing it loses every wish and every user
secret. The NixOS module runs a daily `wishlist-backup` systemd timer that writes
a consistent snapshot to `/var/lib/wishlist/backups` and keeps the newest 14.

For a manual snapshot, for example before a deploy:

```sh
sqlite3 /var/lib/wishlist/wishes.db \
  ".backup '/var/lib/wishlist/wishes-$(date +%F).db'"
```
