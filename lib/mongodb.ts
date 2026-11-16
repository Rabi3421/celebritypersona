import { MongoClient, type Db } from "mongodb";
import { devWriteBlock, readOnlyDb } from "@/lib/dev-write-guard";

/**
 * One MongoClient for the whole process, cached on globalThis so that hot
 * reloads in development do not open a new connection pool every save.
 */

const dbName = process.env.MONGODB_DB ?? "celebritypersona";

const globalForMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

let clientPromise: Promise<MongoClient> | undefined;

// Decided once per process: `next dev` against a remote database reads only
// (lib/dev-write-guard.ts). Null in production, where this is a no-op.
const writeBlock = devWriteBlock();
if (writeBlock) console.warn(`\n⚠  ${writeBlock}\n`);

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  const db = client.db(dbName);
  return writeBlock ? readOnlyDb(db, writeBlock) : db;
}

/** Connect only when a caller actually needs the database. Importing session
 * helpers to render a signed-out login page must not require database access. */
export async function getMongoClient(): Promise<MongoClient> {
  if (!clientPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set. Configure database access for this environment.");
    clientPromise = globalForMongo._mongoClientPromise ?? new MongoClient(uri).connect();
    if (process.env.NODE_ENV !== "production") globalForMongo._mongoClientPromise = clientPromise;
  }
  return clientPromise;
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
