/**
 * What development and Vercel previews may not do.
 *
 * Development, previews and production all share one database and one photo
 * bucket. Under `next dev`, writes to that shared (remote) database are
 * refused unless explicitly opted into (lib/dev-write-guard.ts); a Vercel
 * preview still writes to it. What this guards is everything that reaches
 * past the database to real people or real files: mail, search-engine pings,
 * and photo deletes.
 *
 * No imports, so the scripts can load it as well as the app.
 */

type Env = Record<string, string | undefined>;

/**
 * Whether this is a place to try things rather than the live site: `next dev`,
 * or a Vercel preview deployment. A preview runs as NODE_ENV=production and,
 * unless its environment variables say otherwise, against the production
 * database and bucket — so it is treated like development wherever an action
 * would reach past the database: photo storage, search-engine pings and mail.
 */
export const isSandbox = (env: Env = process.env) =>
  env.NODE_ENV === "development" || env.VERCEL_ENV === "preview";

/**
 * Where development's uploads go, inside the shared bucket. Production never
 * writes here, so a photo uploaded while trying something out is easy to tell
 * apart from one uploaded on the live site.
 */
export const DEV_STORAGE_PREFIX = "dev/";

/** The storage folder prefix for this environment: `dev/` under `next dev`
 *  and on previews, nothing in production. */
export const storagePrefix = (env: Env = process.env) => (isSandbox(env) ? DEV_STORAGE_PREFIX : "");

/**
 * Whether this file may be deleted from Firebase Storage.
 *
 * Development and previews share the production bucket, and an outfit save deletes photos
 * the outfit no longer uses — on the shared database, that would delete
 * production's files. So a sandbox may only delete what a sandbox uploaded:
 * paths under `dev/`.
 */
export const storageDeleteAllowed = (path: string, env: Env = process.env) =>
  !isSandbox(env) || path.startsWith(DEV_STORAGE_PREFIX);
