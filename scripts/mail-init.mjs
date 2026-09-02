/**
 * Prepares the collections the mailing list needs.
 *
 * Run once, and again after any deploy that adds one:   npm run mail:init
 *
 * Two things it fixes. The subscribers collection carried a unique index on
 * `number` from when this list held WhatsApp numbers — with that in place the
 * second address to sign up fails outright, because both rows have no number
 * and null collides with null. And the delivery ledger needs its own unique
 * pair, which is what makes a resumed send safe.
 */
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "celebritypersona";
if (!uri) throw new Error("MONGODB_URI is not set.");

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

const subscribers = db.collection("subscribers");
const indexes = await subscribers.indexes();

for (const index of indexes) {
  if (index.key?.number !== undefined) {
    await subscribers.dropIndex(index.name);
    console.log(`dropped stale index ${index.name} on subscribers.number`);
  }
}

// Partial, so rows carried over from the WhatsApp list — which have no address
// at all — neither collide with each other nor block a real signup.
await subscribers.createIndex(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } }, name: "email_unique" },
);
console.log("subscribers.email is unique");

await db
  .collection("mailDeliveries")
  .createIndex({ jobId: 1, email: 1 }, { unique: true, name: "job_email_unique" });
console.log("mailDeliveries (jobId, email) is unique");

await db.collection("mailJobs").createIndex({ outfitId: 1 }, { unique: true, name: "outfit_unique" });
console.log("mailJobs.outfitId is unique — one announcement per look");

await client.close();
