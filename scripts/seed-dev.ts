/**
 * Seeds the local development database with demo authors and wishes.
 *
 * Users are created through Better Auth, so the printed secrets really work:
 * sign in from the wishlist page to see "Posting as <name>".
 *
 * Run with `just seed` (loads .env and .dev.env). It is safe to re-run: authors
 * that already exist are skipped, along with their wishes.
 */
import { createAuth } from "../server/auth.ts";
import { loadConfig } from "../server/config.ts";
import { createDatabase } from "../server/database.ts";
import { createWishlistRepository } from "../server/wishes/repository.ts";

interface Seed {
  name: string;
  username: string;
  secret: string;
  wishes: { name: string; link: string }[];
}

const seeds: Seed[] = [
  {
    name: "Leonardo",
    username: "leonardo",
    secret: "ABC234",
    wishes: [
      { name: "A really good book", link: "https://www.goodreads.com" },
      { name: "Mechanical keyboard", link: "https://www.keychron.com" },
      { name: "Espresso grinder", link: "https://www.amazon.com" },
    ],
  },
  {
    name: "Ana",
    username: "ana",
    secret: "HJK234",
    wishes: [
      { name: "Watercolour set", link: "https://www.amazon.com" },
      { name: "Concert tickets", link: "https://www.ticketmaster.com" },
    ],
  },
  {
    name: "Charlie",
    username: "charlie",
    secret: "MNP789",
    wishes: [
      { name: "Hiking boots", link: "https://www.rei.com" },
      { name: "Board game night", link: "https://boardgamegeek.com" },
      { name: "Vinyl record", link: "https://www.discogs.com" },
    ],
  },
];

const config = loadConfig(process.env);
if (config.NODE_ENV === "production") {
  throw new Error("Refusing to seed demo data in production.");
}

const { db, client } = createDatabase(config.DATABASE_PATH);
const auth = createAuth(db, config.BETTER_AUTH_SECRET, config.ALLOWED_ORIGIN);
const repository = createWishlistRepository(db);

const created: Seed[] = [];
const skipped: Seed[] = [];

try {
  for (const seed of seeds) {
    const existing = await repository.findUserByUsername(seed.username);
    if (existing) {
      skipped.push(seed);
      continue;
    }

    const registered = await auth.api.signUpEmail({
      body: {
        name: seed.name,
        email: `${seed.username}@wishlist.invalid`,
        password: seed.secret,
        username: seed.username,
        displayUsername: seed.name,
      },
    });

    const user = { id: registered.user.id, name: seed.name };
    for (const wish of seed.wishes) {
      await repository.addWishWithinLimit(user, wish);
    }
    created.push(seed);
  }
} finally {
  client.close();
}

const wishCount = (seed: Seed) => seed.wishes.length;

console.log(`Database: ${config.DATABASE_PATH}`);
for (const seed of created) {
  console.log(
    `+ ${seed.name.padEnd(9)} ${String(wishCount(seed)).padStart(2)} wishes  secret ${seed.secret}`,
  );
}
for (const seed of skipped) {
  console.log(`= ${seed.name.padEnd(9)} already exists, skipped`);
}
console.log(
  created.length > 0
    ? `Seeded ${created.reduce((total, seed) => total + wishCount(seed), 0)} wishes.`
    : "Nothing to seed.",
);
console.log("Sign in on /wishlist/ with a name and secret above.");
