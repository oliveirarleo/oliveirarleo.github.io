# Wishlist glossary

- **User**: A person identified by a unique, case-insensitive name (their Better Auth username) and able to manage their own wishes. The name is the username; there is no email address.
- **User secret**: A six-character, case-insensitive password for a User. It is shown when the User is created or the secret is rotated, and the owner can view it again from their browser ("Code"). Losing it removes self-service access until an administrator resets it in the credential store. See `docs/adr/0001-user-secret-as-password.md`.
- **Wish**: A publicly visible gift idea with a name and normalized web link, owned by exactly one User. The wishlist holds at most 100 Wishes.
- **Edit a wish**: Change a Wish’s name or link. Only the Wish’s owner can edit it; the author always stays the owning User.
- **Reaction**: One of the fixed emoji in `shared/reactions.ts`, chosen by an assumed User for a Wish. A User has at most one Reaction per Wish; choosing another replaces the old one, and choosing the current one clears it.
- **Assume a User**: Sign in with a User’s name and secret so the browser receives a session that can add and remove that User’s wishes.
- **Active User**: The User currently assumed on this browser.
