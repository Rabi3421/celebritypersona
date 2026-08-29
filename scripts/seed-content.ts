/**
 * Loads the site's content into MongoDB.
 *
 * Run with:  npm run seed:content
 * Idempotent: every document is upserted on its natural key, so re-running
 * after editing a seed file updates rather than duplicates. Nothing is dropped,
 * so rows added through the admin panel later are left alone.
 */
import { MongoClient } from "mongodb";
import { celebrities } from "../lib/seed-data/celebrities";
import { homeContent } from "../lib/seed-data/home";
import { occasions } from "../lib/seed-data/occasions";
import { outfits } from "../lib/seed-data/outfits";
import { trendingFaqs, trendingSearches } from "../lib/seed-data/trending";

async function main() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB ?? "celebritypersona";
  if (!uri) throw new Error("MONGODB_URI is not set.");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  async function upsertAll<T extends Record<string, unknown>>(
    name: string,
    rows: T[],
    key: keyof T,
  ) {
    const collection = db.collection(name);
    await collection.createIndex({ [key]: 1 }, { unique: true });
    for (const row of rows) {
      await collection.updateOne(
        { [key]: row[key] },
        { $set: row },
        { upsert: true },
      );
    }
    console.log(`  ${name.padEnd(18)} ${await collection.countDocuments()} documents`);
  }

  console.log(`Seeding ${dbName}`);
  await upsertAll("outfits", outfits, "id");
  await upsertAll("celebrities", celebrities, "id");
  await upsertAll("occasions", occasions, "id");
  await upsertAll("trendingSearches", trendingSearches, "term");
  await upsertAll(
    "siteContent",
    [
      { key: "home", value: homeContent },
      { key: "trendingFaqs", value: trendingFaqs },
    ],
    "key",
  );

  // Reader reports arrive at runtime; only make sure the collection is queryable.
  await db.collection("priceReports").createIndex({ receivedAt: -1 });
  console.log(`  priceReports       ${await db.collection("priceReports").countDocuments()} documents`);

  console.log("Done.");
  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
