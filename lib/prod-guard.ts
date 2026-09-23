/**
 * Stops a maintenance script writing to the live database by accident.
 *
 * Every script in scripts/ reads MONGODB_URI out of .env, and .env on this
 * machine points at the production Atlas cluster. There is no separate staging
 * database. So `npm run seed:content`, run to try something out, writes to the
 * site people are reading — which is exactly how twenty invented looks reached
 * production in the first place.
 *
 * A script that mutates anything calls `assertWritable()` first. Against a
 * local database it returns silently. Against anything else it refuses unless
 * the operator has typed --i-know-this-is-prod, which is long and awkward on
 * purpose: it should be impossible to pass without having meant it.
 *
 * Read-only scripts do not call this. Reading production is how you find out
 * what is wrong with it.
 */

/** Hosts that are unambiguously a database on this machine. */
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]", "mongodb"];

export const PROD_FLAG = "--i-know-this-is-prod";

/**
 * Whether the URI names a database on this machine.
 *
 * Anything it cannot parse counts as remote. A URI this cannot read is not a
 * URI this should be confident about, and the safe answer to "is this
 * production?" is yes.
 */
export function isLocalDatabase(uri: string | undefined): boolean {
  if (!uri?.trim()) return false;

  // mongodb+srv always resolves through DNS to a hosted cluster; there is no
  // local form of it, so it is remote whatever the hostname looks like.
  if (uri.startsWith("mongodb+srv://")) return false;

  try {
    // The driver's URI is close enough to a URL for the host, once the scheme
    // is swapped for one the URL parser accepts.
    const { hostname } = new URL(uri.replace(/^mongodb:\/\//, "http://"));
    return LOCAL_HOSTS.includes(hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Call before the first write. Exits non-zero rather than throwing, so a
 * refusal reads as a refusal in a terminal rather than as a stack trace.
 *
 * `what` names the damage in one line, because the operator is about to decide
 * whether to re-run this with the flag on.
 */
export function assertWritable(what: string, argv: string[] = process.argv): void {
  const uri = process.env.MONGODB_URI;

  if (!uri?.trim()) {
    console.error("MONGODB_URI is not set. Run with --env-file=.env");
    process.exit(1);
  }

  if (isLocalDatabase(uri)) return;
  if (argv.includes(PROD_FLAG)) {
    console.warn(`\n⚠  Writing to the PRODUCTION database: ${what}\n`);
    return;
  }

  console.error(
    `\nRefusing to run.\n\n` +
      `  MONGODB_URI does not point at a local database, so this would ${what}\n` +
      `  on production. There is no staging database on this project.\n\n` +
      `  Take a backup first:\n` +
      `    mongodump --uri "$MONGODB_URI"\n\n` +
      `  Then append the flag to whatever you ran, after a bare --:\n` +
      `    npm run <script> -- ${PROD_FLAG}\n`,
  );
  process.exit(1);
}
