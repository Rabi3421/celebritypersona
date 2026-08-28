import { MongoClient, type Db } from "mongodb";

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

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(dbName);
}

export type AdminUser = {
  email: string;
  passwordHash: string;
  name?: string;
  createdAt: Date;
  lastLoginAt?: Date;
};

export async function adminUsers() {
  const db = await getDb();
  return db.collection<AdminUser>("adminUsers");
}
