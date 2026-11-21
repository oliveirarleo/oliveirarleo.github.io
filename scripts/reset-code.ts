/**
 * Reset a user's six-character code (administrator recovery).
 *
 * The code is the Better Auth password, so this replaces it, revokes every
 * session for that user, and removes any pre-migration secret row. The new
 * code is printed once; hand it to its owner through a private channel.
 *
 * Run on the API host:
 *
 *   just reset-code leonardo            # dry run: shows who would be reset
 *   just reset-code leonardo --yes      # writes a new code and prints it
 *   just reset-code leonardo --yes --secret ABC234
 *
 * Or directly against another database:
 *
 *   node scripts/reset-code.ts leonardo --db ./data/wishes.db --yes
 */
import { eq } from "drizzle-orm";
import { ResetCodeError, resetUserCode } from "../server/admin.ts";
import { normalizeUsername } from "../server/auth.ts";
import { createDatabase } from "../server/database.ts";
import { users } from "../server/schema.ts";
import { validUserSecret } from "../server/user-secrets.ts";

const DEFAULT_DB = "/var/lib/wishlist/wishes.db";

function usage(message?: string): never {
  if (message) console.error(`error: ${message}\n`);
  console.error(`usage: node scripts/reset-code.ts <username> [options]

Options:
  --db <path>       database file (default: $WISHLIST_DB or ${DEFAULT_DB})
  --secret <code>   use this code instead of generating one
  --yes             write the change; without it this is a dry run
  -h, --help        show this help`);
  process.exit(message ? 1 : 0);
}

function parseArgs(argv: string[]) {
  const options = {
    username: "",
    db: process.env.WISHLIST_DB ?? DEFAULT_DB,
    secret: undefined as string | undefined,
    write: false,
  };
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    if (arg === "-h" || arg === "--help") usage();
    else if (arg === "--yes") options.write = true;
    else if (arg === "--db")
      options.db = argv[++i] ?? usage("--db needs a path");
    else if (arg.startsWith("--db=")) options.db = arg.slice(5);
    else if (arg === "--secret")
      options.secret = argv[++i] ?? usage("--secret needs a code");
    else if (arg.startsWith("--secret=")) options.secret = arg.slice(9);
    else if (arg.startsWith("-")) usage(`unknown option ${arg}`);
    else rest.push(arg);
  }
  if (rest.length !== 1) usage("exactly one username is required");
  options.username = rest[0] as string;
  if (options.secret !== undefined && !validUserSecret(options.secret)) {
    usage("--secret must be six characters from A–Z and 2–9");
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));

// No migrations here: an admin tool must never change the schema it is
// repairing, especially while the API is running.
const { db, client } = createDatabase(options.db, { migrate: false });

try {
  const username = normalizeUsername(options.username);
  const [user] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user) {
    throw new ResetCodeError(`No user named "${options.username}".`);
  }

  if (!options.write) {
    console.log(`dry run: would reset ${user.name} (${user.id})`);
    console.log("re-run with --yes to install a new code");
  } else {
    const result = await resetUserCode(db, options.username, options.secret);
    console.log(`reset:  ${result.user.name} (${result.user.id})`);
    console.log(`code:   ${result.code}`);
    console.log(`sessions revoked:    ${result.sessionsRevoked}`);
    console.log(`legacy rows removed: ${result.legacyRowsRemoved}`);
    console.log("");
    console.log(
      "Send this code privately. It is not stored anywhere in plain text",
    );
    console.log("except in the owner's browser after they sign in.");
  }
} catch (error) {
  console.error(
    `error: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
} finally {
  client.close();
}
