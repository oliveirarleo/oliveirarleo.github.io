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
pnpm dev:api # run the API on http://localhost:8787
```

Or run both together with `just`:

```sh
just dev
```

`just dev` starts Astro at `http://localhost:4321/wishlist/` and the API at
`http://localhost:8787`.

Create a local `.env` based on `.env.example` and point the frontend at the
local API:

```sh
PUBLIC_WISHLIST_API_URL=http://localhost:8787
```

Turnstile is optional in development. Leave both `PUBLIC_TURNSTILE_SITE_KEY`
and `TURNSTILE_SECRET` unset locally.

### Build

```sh
just build
# or
pnpm build
pnpm astro preview
```

Other useful recipes:

```sh
just install     # install dependencies
just check       # Astro type-check + API tests
just migrations  # generate Drizzle migrations after editing schema.ts
```

## Wishlist architecture

- **Frontend:** Astro + Solid island at `/wishlist/`, built statically and
  deployed to GitHub Pages.
- **Public page:** `https://oliveirarleo.com/wishlist/`, deployed to GitHub
  Pages. No Worker or separate subdomain is required.
- **Shared API:** Hono + Effect + Drizzle on `node:sqlite`, running on the
  NixOS server. Drizzle is pinned to the 1.0 release candidate because the
  stable release does not yet ship the `node:sqlite` driver.
- **Public API host:** `wishlist-api.oliveirarleo.com` through Cloudflare
  Tunnel.
- **Storage:** SQLite at `/var/lib/wishlist/wishes.db`.
- **Migrations:** versioned SQL files in `server/migrations/`, generated with
  Drizzle Kit and applied automatically on API startup.
- **Identity and authorization:** Better Auth with its Drizzle adapter owns user identity. Wishlist credentials use unique HMAC lookups plus peppered scrypt hashes; no public Better Auth routes are mounted.
- **Spam protection:** Cloudflare Turnstile plus strict in-memory IP/global rate limits on secret attempts.

The API parses `process.env` with an Effect Schema in `server/config.ts` and
fails fast with a clear error for invalid values.

The public API supports:

- `GET /api/health` with a real SQLite check
- `GET /api/wishes?limit=500&offset=0` (maximum limit 1000)
- `POST /api/wishes` with `{ author, name, link, turnstileToken, secret? }`
- `POST /api/session` with `{ secret, turnstileToken? }`
- `POST /api/session/rotate` with `X-Wishlist-Secret`
- `DELETE /api/wishes/:id` with `X-Wishlist-Secret`

The first wish for a case-insensitive name creates a Better Auth user and a
six-character secret using alphabet `A-Z2-9` (without ambiguous characters).
The browser stores known secrets in `localStorage` under
`wishlist-user-secrets-v1`. The secret can assume the same user on another
browser, add wishes, rotate the secret, and remove only that user's wishes.
GET responses never expose secrets, key hashes, email placeholders, or auth
account details.

Six characters provide only about 30 bits of entropy. Assume-session attempts
have strict IP and global rate limits and require Turnstile when configured.
Losing a secret requires an administrator to reset it directly in the
credential store; there is no recovery endpoint.

**Migration policy:** the user-secret migration intentionally drops old wishes
and deletion tokens. Back up `/var/lib/wishlist/wishes.db` before restarting
the upgraded service.

### Database migrations

Edit `server/schema.ts`, then generate a migration:

```sh
just migrations
```

Commit the generated `server/migrations/` files. On startup, the API runs the
migrations with `drizzle-orm/node-sqlite/migrator` before accepting requests.

### Environment files

| File           | Purpose                           | Loaded by               |
| -------------- | --------------------------------- | ----------------------- |
| `.env`         | Base local defaults               | Node and Astro          |
| `.dev.env`     | Development overrides, no secrets | Node via `pnpm dev:api` |
| `.env.example` | Documented base template          | Committed, not loaded   |

Load order for the API:

```text
.env -> .dev.env
```

Later files override earlier ones, while existing shell/systemd variables win
over all files. Production systemd uses its own `Environment` and
`EnvironmentFile`.

Production secrets are not stored in env files. Production reads
`TURNSTILE_SECRET`, `BETTER_AUTH_SECRET`, and `WISHLIST_SECRET_PEPPER` from
sops-nix. `.dev.env` contains only public development-only values.

Cloudflare values:

- `PUBLIC_TURNSTILE_SITE_KEY` — Dashboard → Turnstile → widget → Site Key
- `TURNSTILE_SECRET` — Dashboard → Turnstile → widget → Secret Key, stored in sops

The Turnstile widget must allow the `oliveirarleo.com` hostname.

### Environment variables

Frontend, evaluated by Astro at build time:

| Variable                    | Purpose                                                                    |
| --------------------------- | -------------------------------------------------------------------------- |
| `PUBLIC_WISHLIST_API_URL`   | API base URL, for example `https://wishlist-api.oliveirarleo.com`          |
| `PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key; leave empty only when Turnstile is disabled |

Backend:

| Variable                 | Purpose                                                         |
| ------------------------ | --------------------------------------------------------------- |
| `HOST`                   | Bind address, default `127.0.0.1`                               |
| `PORT`                   | Port, default `8787`                                            |
| `DATABASE_PATH`          | SQLite path, default `./data/wishes.db` locally                 |
| `ALLOWED_ORIGIN`         | Exact allowed browser origin                                    |
| `TURNSTILE_SECRET`       | Turnstile secret from sops; required when `NODE_ENV=production` |
| `BETTER_AUTH_SECRET`     | Random Better Auth secret of at least 32 characters from sops   |
| `WISHLIST_SECRET_PEPPER` | Random server-side pepper for secret lookup HMACs               |

For GitHub Pages, set the public site key as a repository variable named
`TURNSTILE_SITE_KEY`. The build workflow passes it to Astro.

## Deploying the API on NixOS

Add the repository as a flake input in `/etc/nixos/flake.nix` and import its
module. A locked path input is copied into the Nix store, so this works in
pure evaluation mode without a separate `source` option:

```nix
{
  inputs.wishlist.url = "path:/home/mainframe/git/p/oliveirarleo.github.io";

  outputs = { nixpkgs, wishlist, ... }: {
    nixosConfigurations.<hostname> = nixpkgs.lib.nixosSystem {
      modules = [
        ./configuration.nix
        wishlist.nixosModules.default
        # other modules...
      ];
    };
  };
}
```

Do not copy `nixos/wishlist` into `/etc/nixos/services` or set
`services.wishlist.source`; the package defaults to the flake input's source
at build time and runs entirely from its immutable Nix store output.

Keep the secret out of the Nix store with sops-nix in `configuration.nix`:

```nix
sops.secrets.wishlist_turnstile_secret = {};
sops.secrets.wishlist_better_auth_secret = {};
sops.secrets.wishlist_secret_pepper = {};

sops.templates."wishlist.env" = {
  content = ''
    TURNSTILE_SECRET=${config.sops.placeholder.wishlist_turnstile_secret}
    BETTER_AUTH_SECRET=${config.sops.placeholder.wishlist_better_auth_secret}
    WISHLIST_SECRET_PEPPER=${config.sops.placeholder.wishlist_secret_pepper}
  '';
  owner = "mainframe";
  mode = "0400";
};

services.wishlist = {
  enable = true;
  environmentFile = config.sops.templates."wishlist.env".path;
  tunnelId = "<tunnel-id>";
  credentialsFile = "/home/mainframe/.cloudflared/<tunnel-id>.json";

  # Optional, defaults to wishlist-api.oliveirarleo.com:
  # hostname = "wishlist-api.oliveirarleo.com";
};
```

The module builds an immutable Node 26 package with `buildNpmPackage` and
runs `${cfg.package}/bin/wishlist-api`; it does not depend on a writable
checkout or a manual production `pnpm install`. `package-lock.json` is used by
the Nix build only, while local development and CI continue to use pnpm.
Back up the database before the first restart because this migration resets
the old wishlist:

```sh
sudo systemctl stop wishlist
sudo sqlite3 /var/lib/wishlist/wishes.db \
  ".backup '/var/lib/wishlist/wishes-pre-user-secrets.db'"
```

Generate independent production values with `openssl rand -base64 48` and
store them in sops as `wishlist_better_auth_secret` and
`wishlist_secret_pepper`.

The module configures the Cloudflare Tunnel ingress automatically:

```text
wishlist-api.oliveirarleo.com -> http://127.0.0.1:8787
```

Create the public DNS route:

```sh
cloudflared tunnel route dns <tunnel-id> wishlist-api.oliveirarleo.com
```

Do not open port `8787` in the firewall. The API is only reachable through the
tunnel.

Then rebuild the flake:

```sh
sudo nixos-rebuild switch --flake /etc/nixos#<hostname>
```

### Backups

The SQLite database uses WAL mode. A simple online backup is:

```sh
sqlite3 /var/lib/wishlist/wishes.db \
  ".backup '/var/lib/wishlist/wishes-$(date +%F).db'"
```
