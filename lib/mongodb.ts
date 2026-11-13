import { MongoClient, type Db } from "mongodb";
import { devWriteBlock, readOnlyDb } from "@/lib/dev-write-guard";

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

const clientPromise: Promise<MongoClient> =
  globalForMongo._mongoClientPromise ?? new MongoClient(uri).connect();

if (process.env.NODE_ENV !== "production") {
  globalForMongo._mongoClientPromise = clientPromise;
}

// Decided once per process: `next dev` against a remote database reads only
// (lib/dev-write-guard.ts). Null in production, where this is a no-op.
const writeBlock = devWriteBlock();
if (writeBlock) console.warn(`\n⚠  ${writeBlock}\n`);

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  const db = client.db(dbName);
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
