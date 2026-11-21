set shell := ["bash", "-euo", "pipefail", "-c"]

default:
    @just --list

# Install dependencies
install:
    pnpm install

# Run the Astro site and Hono API together
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    set -m

    pids=()
    cleanup() {
      trap - EXIT INT TERM
      for pid in "${pids[@]}"; do
        kill -- -"$pid" 2>/dev/null || true
      done
      wait 2>/dev/null || true
    }
    trap cleanup EXIT INT TERM

    ASTRO_DEV_BACKGROUND=1 \
      PUBLIC_WISHLIST_API_URL="${PUBLIC_WISHLIST_API_URL:-http://localhost:8788}" \
      pnpm dev &
    pids+=("$!")

    pnpm dev:api &
    pids+=("$!")

    wait -n "${pids[@]}"

# Run only the Astro site
web:
    pnpm dev

# Run only the Hono API
api:
    pnpm dev:api

# Type-check Astro and run all tests
check:
    pnpm exec astro check
    pnpm test

# Deploy to production: checks, tests, snapshot, build, switch, verify, push
deploy:
    ./scripts/deploy-wizard.sh

# Alias for check
test: check

# Generate a new Drizzle migration after changing server/schema.ts
migrations:
    pnpm exec drizzle-kit generate

# Fill the local development database with demo authors and wishes
seed:
    node --env-file-if-exists=.env --env-file-if-exists=.dev.env scripts/seed-dev.ts

# Remove all wishes and authors from the local development database
clean:
    node --env-file-if-exists=.env --env-file-if-exists=.dev.env scripts/clean-dev.ts

# Build the static site
build:
    pnpm build
