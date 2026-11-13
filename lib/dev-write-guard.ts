/**
 * Stops `next dev` writing to the production database by accident.
 *
 * .env.local on this machine points at the production Atlas cluster, and
 * there is no staging database, so a save tried out locally is a real save on
 * the live site. Under `next dev` (NODE_ENV=development) with a database that
 * is not on this machine, every write is refused with an error that says so;
 * reads carry on, so pages still render against real data.
 *
 * Fail-closed: anything that is not clearly a local database counts as
 * production (lib/prod-guard.ts). Production and Vercel builds run with
 * NODE_ENV=production and are never touched by this.
 *
 * For local work that should write, point the app at a disposable database:
 *   MONGODB_URI=mongodb://127.0.0.1:27017 MONGODB_DB=cp_dev npx next dev
 * Writing to production from `next dev` on purpose takes an explicit, awkward
 * opt-in, so it cannot happen without having meant it:
 *   CP_DEV_PRODUCTION_WRITES=i-know-this-is-prod
 */

import { isLocalDatabase } from "@/lib/prod-guard";

type Env = Record<string, string | undefined>;

export const DEV_WRITE_OPT_IN = "i-know-this-is-prod";

/** Why writes are refused in this process, or null when they are allowed. */
export function devWriteBlock(env: Env = process.env): string | null {
  if (env.NODE_ENV !== "development") return null;
  if (isLocalDatabase(env.MONGODB_URI)) return null;
  if (env.CP_DEV_PRODUCTION_WRITES === DEV_WRITE_OPT_IN) return null;
  return (
    "Refused: `next dev` is connected to a database that is not on this machine (production), " +
    "so writes are switched off. Use a disposable local database (MONGODB_URI=mongodb://127.0.0.1:…), " +
    `or set CP_DEV_PRODUCTION_WRITES=${DEV_WRITE_OPT_IN} if you really mean to write to production.`
  );
}

/** Every collection method that changes data, indexes or the collection itself. */
export const WRITE_METHODS = new Set([
  "insertOne",
  "insertMany",
  "updateOne",
  "updateMany",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndUpdate",
  "findOneAndReplace",
  "findOneAndDelete",
  "bulkWrite",
  "initializeOrderedBulkOp",
  "initializeUnorderedBulkOp",
  "createIndex",
  "createIndexes",
  "dropIndex",
  "dropIndexes",
  "createSearchIndex",
  "createSearchIndexes",
  "dropSearchIndex",
  "updateSearchIndex",
  "drop",
  "rename",
]);

/** Database-level methods that change data. */
const DB_WRITE_METHODS = new Set(["createCollection", "dropCollection", "dropDatabase", "renameCollection", "createIndex"]);

export class DevWriteRefused extends Error {
  constructor(reason: string, what: string) {
    super(`${reason} (attempted: ${what})`);
    this.name = "DevWriteRefused";
  }
}

const refuse = (reason: string, what: string) => () => {
  throw new DevWriteRefused(reason, what);
};

/**
 * A read-only view of a driver `Db`: collections read as usual, and every
 * write method throws before anything is sent. `aggregate` with `$out` or
 * `$merge` writes too, so those stages are refused as well.
 */
export function readOnlyDb<D extends object>(db: D, reason: string): D {
  return new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop !== "string" || typeof value !== "function") return value;
      if (DB_WRITE_METHODS.has(prop)) return refuse(reason, `db.${prop}`);
      if (prop === "collection") {
        return (...args: unknown[]) => readOnlyCollection((value as (...a: unknown[]) => object).apply(target, args), reason, String(args[0]));
      }
      return value.bind(target);
    },
  });
}

export function readOnlyCollection<C extends object>(collection: C, reason: string, name: string): C {
  return new Proxy(collection, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop !== "string" || typeof value !== "function") return value;
      if (WRITE_METHODS.has(prop)) return refuse(reason, `${name}.${prop}`);
      if (prop === "aggregate") {
        return (pipeline: unknown, ...rest: unknown[]) => {
          const stages = Array.isArray(pipeline) ? pipeline : [];
          if (stages.some((stage) => stage && typeof stage === "object" && ("$out" in stage || "$merge" in stage))) {
            refuse(reason, `${name}.aggregate($out/$merge)`)();
          }
          return (value as (...a: unknown[]) => unknown).call(target, pipeline, ...rest);
        };
      }
      return value.bind(target);
    },
  });
}
