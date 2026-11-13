/**
 * The unique index on seoReviews.key: check it, and create it.
 *
 *   npm run seo:index                              read-only: indexes, document count, duplicate keys
 *   npm run seo:index -- --create                  creates the index (local databases only)
 *   npm run seo:index -- --create --i-know-this-is-prod
 *                                                  creates it on production — after approval
 *
 * Creating it refuses while any key has more than one document, rather than
 * failing half-way; nothing is ever deleted or merged by this script. Running
 * it when the index already exists changes nothing. The connection string is
 * read from the environment and never printed.
 */

import { MongoClient } from "mongodb";
import { fileURLToPath } from "node:url";
import { assertWritable } from "../lib/prod-guard.ts";

export const COLLECTION = "seoReviews";
export const INDEX = { key: { key: 1 }, name: "key_unique", unique: true };

const isKeyIndex = (index) => JSON.stringify(index.key) === JSON.stringify(INDEX.key);

/** Read-only: does the collection exist, how many documents, and its index on `key` (if any). */
export async function keyIndexState(collection) {
  const exists = (await collection.db.listCollections({ name: collection.collectionName }, { nameOnly: true }).toArray()).length > 0;
  if (!exists) return { exists: false, documents: 0, keyIndex: null };
  const indexes = await collection.indexes();
  const found = indexes.find(isKeyIndex);
  return {
    exists: true,
    documents: await collection.countDocuments(),
    keyIndex: found ? { name: found.name, unique: found.unique === true } : null,
  };
}

/** Read-only: every key held by more than one document. */
export async function duplicateKeys(collection) {
  return collection
    .aggregate([
      { $group: { _id: "$key", count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $project: { _id: 0, key: "$_id", count: 1 } },
      { $sort: { key: 1 } },
    ])
    .toArray();
}

/** Creates the unique index if it is missing. Refuses over duplicates or a non-unique index on `key`. */
export async function ensureKeyIndex(collection) {
  const state = await keyIndexState(collection);
  if (state.keyIndex?.unique) return { created: false, name: state.keyIndex.name };
  if (state.keyIndex) throw new Error(`An index on key exists but is not unique (${state.keyIndex.name}). Review it by hand; this script will not drop it.`);
  const duplicates = state.exists ? await duplicateKeys(collection) : [];
  if (duplicates.length) {
    throw new Error(`Refusing: duplicate keys would make a unique index fail: ${duplicates.map((d) => `${d.key} ×${d.count}`).join(", ")}`);
  }
  const name = await collection.createIndex(INDEX.key, { name: INDEX.name, unique: true });
  return { created: true, name };
}

async function main() {
  const create = process.argv.includes("--create");
  const uri = process.env.MONGODB_URI;
  if (!uri?.trim()) {
    console.error("MONGODB_URI is not set. Run with --env-file=.env");
    process.exit(1);
  }
  if (create) assertWritable("create a unique index on seoReviews.key");

  const client = await new MongoClient(uri, { serverSelectionTimeoutMS: 10000 }).connect();
  try {
    const db = client.db(process.env.MONGODB_DB ?? "celebritypersona");
    const collection = db.collection(COLLECTION);
    const before = await keyIndexState(collection);
    const duplicates = before.exists ? await duplicateKeys(collection) : [];
    console.log(`database:    ${db.databaseName}`);
    console.log(`collection:  ${COLLECTION} — ${before.exists ? `${before.documents} document(s)` : "does not exist yet (created on first save, or by --create)"}`);
    console.log(`key index:   ${before.keyIndex ? `${before.keyIndex.name} (unique: ${before.keyIndex.unique})` : "none"}`);
    console.log(`duplicates:  ${duplicates.length ? duplicates.map((d) => `${d.key} ×${d.count}`).join(", ") : "none"}`);
    if (!create) {
      console.log("\nRead-only check: nothing was changed.");
      return;
    }
    const result = await ensureKeyIndex(collection);
    console.log(result.created ? `\nCreated unique index ${result.name}.` : `\nUnique index ${result.name} already exists: nothing changed.`);
  } finally {
    await client.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
