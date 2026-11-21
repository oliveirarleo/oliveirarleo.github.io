# 0001. Use the six-character user secret as the Better Auth password

Status: accepted

## Context

The wishlist lets anyone post a gift idea under a name, and lets that person
return later to manage their wishes from another browser. The original design
used Better Auth only as a user-row factory, with a custom six-character
"user secret" hashed by hand, sent as a bearer header, and no real sessions.

That design duplicated what Better Auth already provides (password hashing,
sessions, rotation, revocation) and kept dead tables (sessions, accounts and
verifications) that were never used for login.

## Decision

- Names are Better Auth **usernames**, normalized with `trim().toLowerCase()`
  so they stay case-insensitively unique. The normalizer does not depend on the
  locale. The original casing is kept for display.
- The six-character user secret is the Better Auth **password**. Its length is
  defined once and shared by the server and the browser. The minimum password
  length follows it.
- Sign-in is a name plus secret through Better Auth's username sign-in.
  Authorization uses Better Auth sessions with bearer tokens, so the browser
  stores a session token and the secret.
- Rotation changes the password. It requires the current secret, revokes the
  other sessions, and returns a fresh session token, so other devices lose
  access.
- Registering a new name signs its owner in (`autoSignIn` is on): sign-up
  returns a session, so the new owner can manage the wish they just posted.
- Better Auth requires an email column (required and unique). A random
  placeholder address on the reserved `.invalid` domain is written. It is never
  shown, never used to sign in, and never emailed.
- The secret is **six characters** from a 34-symbol alphabet (capital letters
  A–Z and digits 2–9; 0 and 1 are excluded to avoid ambiguity). That is about
  30.5 bits of entropy: 34^6, about 1.54 billion possibilities. Secrets are
  generated with `randomInt`, so the alphabet is sampled without modulo bias.

## Consequences

Good:

- Password hashing, sessions, expiry and revocation are maintained upstream.
- Far less custom security code (the hand-rolled hashing is removed).
- Rotation invalidates every other session in one step.

Trade-offs we are accepting:

- **Six characters is a weak password.** About 1.54 billion possibilities.
  Protection against guessing rests on the rate limits (per IP, plus a global
  limit on every route that checks a secret) and on Turnstile. Anyone who
  bypasses those limits could enumerate a name in a sustained campaign. This is
  the main risk. Mitigations if it becomes a problem: longer secrets, per-name
  lockout, or a persistent limiter.
- **Secrets are stored in plain text in the browser's local storage** so the
  owner can view them again ("Code"). Anyone with access to that browser
  profile can read them. Acceptable for a low-stakes public gift list, not for
  anything sensitive.
- **Placeholder email.** Better Auth's schema needs an email, so one is
  synthesized. Account recovery by email is impossible; recovery is an
  administrator reset in the credential store.
- **A new name is signed in on the device that registered it.** The secret is
  returned in the same response, and the browser keeps it for the owner.
- **Migration:** the Better Auth migration (`20261121102107_better_auth_username`)
  keeps every existing wish, name, and secret. Accounts that predate it keep
  their original six characters: on the first sign-in the API verifies the old
  scrypt hash in `legacy_wishlist_secrets` and copies the same secret into the
  Better Auth password, then deletes the legacy row. This needs
  `WISHLIST_SECRET_PEPPER`, and the table can be dropped once drained. The
  earlier migration that introduced this model already dropped wishes from
  before it.
- **Legacy name normalization.** The migration backfills `username` in SQL.
  SQLite's `lower()` lowercases ASCII letters only, so for legacy rows without a
  `name_key` a non-ASCII name can differ from the TypeScript normalizer. Rows
  that have a `name_key` keep it, because `coalesce(name_key, …)` runs first;
  it was computed with `toLocaleLowerCase` before this change. Those legacy
  accounts are upgraded on first sign-in like any other; the only effect is that
  a re-registration of such a non-ASCII name may not be refused. Do not extend
  the migration to match: the TypeScript normalizer is the single rule for new
  names and sign-in.

## Alternatives considered

- **Keep the custom secret model.** Rejected: duplicates Better Auth and keeps
  unused tables.
- **Longer random secrets (for example 12+ characters).** Rejected for now by
  the maintainer, who asked to keep six characters. Revisit if the list is ever
  attacked. The length is a single shared constant, so changing it updates the
  server and the browser together. Secrets already stored in browsers would
  then fail the browser's validation and be dropped, so a change needs a plan
  for those users.
- **Email magic links.** Rejected: the audience is friends and family who do
  not want to create accounts or give an email address.
