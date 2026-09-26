/**
 * Keeps local development off the production database.
 *
 * There is one production cluster and, until now, one `.env` pointing at it,
 * so `next dev` edited the live archive: every test save was a real save. Dev
 * now reads its own connection string from `.env.development.local` (which
 * Next loads ahead of `.env` under `next dev`), and this refuses to run dev
 * against production at all.
 *
 * Production is identified by host, from `MONGODB_PRODUCTION_HOST` in `.env`
 * (the cluster's hostname, e.g. `cluster0.abcd1.mongodb.net`). When that is
 * not set, any remote database counts as production: fail closed, because a
 * guard that cannot tell is a guard that lets the wrong one through.
 *
 * `ALLOW_PRODUCTION_DB_IN_DEV=1` overrides it, for the rare deliberate case.
 *
 * No imports, so next.config.ts and the scripts can load it as well as the app.
 */

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]", "mongodb"];

/** The host a MongoDB URI connects to, lowercased; the SRV name for +srv. */
export function databaseHost(uri: string | undefined): string | undefined {
  if (!uri?.trim()) return undefined;
  try {
    return new URL(uri.trim().replace(/^mongodb(\+srv)?:\/\//, "http://")).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

const isLocal = (host: string) => LOCAL_HOSTS.includes(host);

type Env = Record<string, string | undefined>;

/** Whether this URI is the production cluster, as far as can be told. */
export function isProductionDatabase(uri: string | undefined, env: Env = process.env): boolean {
  const host = databaseHost(uri);
  if (!host) return true;
  if (isLocal(host)) return false;
  const production = env.MONGODB_PRODUCTION_HOST?.trim().toLowerCase();
  return production ? host === production : true;
}

/**
 * Why development may not start with this environment, or null when it may.
 * Only ever says anything under NODE_ENV=development.
 */
export function devDatabaseProblem(env: Env = process.env): string | null {
  if (env.NODE_ENV !== "development") return null;
  if (env.ALLOW_PRODUCTION_DB_IN_DEV === "1") return null;
  if (!isProductionDatabase(env.MONGODB_URI, env)) return null;

  return [
    "",
    "Stopped: this would run the site on the LIVE database.",
    "",
    "Start it with   npm run dev   instead. That gives you a safe",
    "private copy of your site's data, and nothing you do touches the live site.",
    "",
  ].join("\n");
}

/**
 * Whether files may be deleted from Firebase Storage. Development shares the
 * production bucket, and an outfit save deletes photos the outfit no longer
 * uses — on a copy of production data, that would delete production's files.
 */
export const storageDeletesAllowed = (env: Env = process.env) =>
  env.NODE_ENV !== "development" || env.ALLOW_STORAGE_DELETES_IN_DEV === "1";
