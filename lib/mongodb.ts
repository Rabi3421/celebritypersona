import { MongoClient, type Db } from "mongodb";
import { devWriteBlock, readOnlyDb } from "@/lib/dev-write-guard";
import { sharedConnection } from "@/lib/mongo-connection";

/**
 * One MongoClient for the whole process, cached on globalThis so that hot
 * reloads in development do not open a new connection pool every save.
 */

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "celebritypersona";

if (!uri) {
  throw new Error("MONGODB_URI is not set. Copy .env.example to .env.local.");
}

const globalForMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

const MONGODB_URI: string = uri;
const keepAcrossReloads = process.env.NODE_ENV !== "production";

/**
 * Connects on first use, reuses a good connection, and retries on the next
 * request after a failed one (lib/mongo-connection.ts). Gives up on a server
 * after 10 s rather than the driver's 30 s, so a hiccup shows quickly.
 */
const client = sharedConnection(
  () => new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 10_000 }).connect(),
  keepAcrossReloads ? (pending) => (globalForMongo._mongoClientPromise = pending) : undefined,
  keepAcrossReloads ? globalForMongo._mongoClientPromise : undefined,
);

// Decided once per process: `next dev` against a remote database reads only
// (lib/dev-write-guard.ts). Null in production, where this is a no-op.
const writeBlock = devWriteBlock();
if (writeBlock) console.warn(`\n⚠  ${writeBlock}\n`);

export async function getDb(): Promise<Db> {
  const db = (await client()).db(dbName);
  return writeBlock ? readOnlyDb(db, writeBlock) : db;
}

export type AdminUser = {
  email: string;
  passwordHash: string;
  name?: string;
  createdAt: Date;
  lastLoginAt?: Date;
  /** Sessions signed in before this are refused: set by "Sign out
   *  everywhere" and by every password change. */
  sessionsValidAfter?: Date;
};

export async function adminUsers() {
  const db = await getDb();
  return db.collection<AdminUser>("adminUsers");
}
