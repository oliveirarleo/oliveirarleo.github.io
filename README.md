# oliveirarleo's homepage

This is a blog based on Astro's blog template. You can access it at
[oliveirarleo.com](https://oliveirarleo.com). If you want to see how I built
this, take a look at
[oliveirarleo.com/tech/a-blog-in-a-day](https://oliveirarleo.com/tech/a-blog-in-a-day/).

The repository also contains the shared Christmas wishlist at
`https://wishlist.oliveirarleo.com`.

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
- **Shared API:** Hono + Effect + Drizzle on `node:sqlite`, running on the
  NixOS server. Drizzle is pinned to the 1.0 release candidate because the
  stable release does not yet ship the `node:sqlite` driver.
- **Public API host:** `api.wishlist.oliveirarleo.com` through Cloudflare
  Tunnel.
- **Subdomain:** a small Cloudflare Worker rewrites
  `wishlist.oliveirarleo.com/` to the GitHub Pages `/wishlist/` page.
- **Storage:** SQLite at `/var/lib/wishlist/wishes.db`.
- **Migrations:** versioned SQL files in `server/migrations/`, generated with
  Drizzle Kit and applied automatically on API startup.
- **Spam protection:** Cloudflare Turnstile plus an in-memory IP rate limit.

The API parses `process.env` with an Effect Schema in `server/config.ts` and
fails fast with a clear error for invalid values.

The public API is append-only except for creator-authorized deletion. It
supports:

- `GET /api/health`
- `GET /api/wishes`
- `POST /api/wishes` with `{ author, name, link, turnstileToken }`
- `DELETE /api/wishes/:id` with `{ deleteToken }`

`POST` returns a one-time `deleteToken`. The browser stores it in
`localStorage`, so only the browser that created a wish can remove it. The
server stores only a SHA-256 hash of the token. Wishes are grouped by author in
the browser; there is no public edit endpoint.

### Database migrations

Edit `server/schema.ts`, then generate a migration:

```sh
just migrations
```

Commit the generated `server/migrations/` files. On startup, the API runs the
migrations with `drizzle-orm/node-sqlite/migrator` before accepting requests.

### Environment files

| File | Purpose | Loaded by |
| --- | --- | --- |
| `.env` | Base local defaults | Node and Astro |
| `.dev.env` | Development overrides, no secrets | Node via `pnpm dev:api` |
| `.env.example` | Documented base template | Committed, not loaded |

Load order for the API:

```text
.env -> .dev.env
```

Later files override earlier ones, while existing shell/systemd variables win
over all files. Production systemd uses its own `Environment` and
`EnvironmentFile`.

Secrets are not stored in env files. Production reads `TURNSTILE_SECRET` from
sops-nix; export it in your shell only when testing Turnstile locally.

Cloudflare values:

- `PUBLIC_TURNSTILE_SITE_KEY` — Dashboard → Turnstile → widget → Site Key
- `TURNSTILE_SECRET` — Dashboard → Turnstile → widget → Secret Key, stored in sops

### Environment variables

Frontend, evaluated by Astro at build time:

| Variable | Purpose |
| --- | --- |
| `PUBLIC_WISHLIST_API_URL` | API base URL, for example `https://api.wishlist.oliveirarleo.com` |
| `PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key; leave empty only when Turnstile is disabled |

Backend:

| Variable | Purpose |
| --- | --- |
| `HOST` | Bind address, default `127.0.0.1` |
| `PORT` | Port, default `8787` |
| `DATABASE_PATH` | SQLite path, default `./data/wishes.db` locally |
| `ALLOWED_ORIGIN` | Exact allowed browser origin |
| `TURNSTILE_SECRET` | Turnstile secret from sops; required when `NODE_ENV=production` |

For GitHub Pages, set the public site key as a repository variable named
`TURNSTILE_SITE_KEY`. The build workflow passes it to Astro.

## Deploying the API on NixOS

This service follows the same module layout as the other services under
`/etc/nixos/services/`. Copy the directory into place:

```sh
cp -r nixos/wishlist /etc/nixos/services/wishlist
```

Add it to the `modules` list in `/etc/nixos/flake.nix`, like the other
services:

```nix
nixosConfigurations.<hostname> = nixpkgs.lib.nixosSystem {
  modules = [
    ./configuration.nix
    ./services/wishlist/default.nix
    # other modules...
  ];
};
```

If you previously added `wishlist.url` or
`inputs.wishlist.nixosModules.default`, remove them.

Keep the secret out of the Nix store with sops-nix in `configuration.nix`:

```nix
sops.secrets.wishlist_turnstile_secret = {};

sops.templates."wishlist.env" = {
  content = "TURNSTILE_SECRET=${config.sops.placeholder.wishlist_turnstile_secret}";
  owner = "mainframe";
  mode = "0400";
};

services.wishlist = {
  enable = true;
  environmentFile = config.sops.templates."wishlist.env".path;
  tunnelId = "<tunnel-id>";
  credentialsFile = "/home/mainframe/.cloudflared/<tunnel-id>.json";

  # Optional, defaults to api.wishlist.oliveirarleo.com:
  # hostname = "api.wishlist.oliveirarleo.com";
};
```

Install the production dependencies before starting the service:

```sh
cd /home/mainframe/git/p/oliveirarleo.github.io
pnpm install --prod --frozen-lockfile
```

The module configures the Cloudflare Tunnel ingress automatically:

```text
api.wishlist.oliveirarleo.com -> http://127.0.0.1:8787
```

Create the public DNS route:

```sh
cloudflared tunnel route dns <tunnel-id> api.wishlist.oliveirarleo.com
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

## Subdomain Worker

`cloudflare/wishlist-worker.ts` proxies the wishlist subdomain to the existing
GitHub Pages site while preserving the subdomain URL.

Authenticate Wrangler once:

```sh
wrangler login
```

Then deploy the Worker and its custom domain:

```sh
just deploy:worker
```

The custom domain `wishlist.oliveirarleo.com` is declared in `wrangler.jsonc`,
so Cloudflare creates the DNS record and route automatically.

The worker rewrites only `/` to `/wishlist/`. Asset requests such as
`/_astro/*` are proxied unchanged to `oliveirarleo.com`.
