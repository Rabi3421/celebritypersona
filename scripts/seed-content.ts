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

  /**
   * Fields these documents used to carry that are now counted from the outfits
   * at render time. Dropped on every seed so an old document cannot keep a
   * stale figure alive beside the derived one.
   */
  const RETIRED: Record<string, string[]> = {
    celebrities: ["looks", "averageSaving", "low", "high", "brands", "trending", "newArchive"],
    occasions: ["looks", "swapFrom", "averageWorn", "averageSwap", "garments"],
  };

  async function upsertAll<T extends Record<string, unknown>>(
    name: string,
    rows: T[],
    key: keyof T,
  ) {
    const collection = db.collection(name);
    await collection.createIndex({ [key]: 1 }, { unique: true });
    const retired = RETIRED[name] ?? [];
    const unset = Object.fromEntries(retired.map((field) => [field, ""]));
    for (const row of rows) {
      await collection.updateOne(
        { [key]: row[key] },
        retired.length ? { $set: row, $unset: unset } : { $set: row },
        { upsert: true },
      );
    }
    // Rows added through the panel are left alone, but they carry the same
    // retired fields, so clear those too.
    if (retired.length) await collection.updateMany({}, { $unset: unset });
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

  // Reader-supplied collections arrive at runtime; only make sure they are
  // queryable, and that the natural keys that de-duplicate them are enforced.
  await db.collection("priceReports").createIndex({ receivedAt: -1 });
  await db.collection("celebrityRequests").createIndex({ votes: -1, firstAskedAt: 1 });
  await db.collection("celebrityRequests").createIndex({ id: 1 }, { unique: true });
  await db.collection("subscribers").createIndex({ number: 1 }, { unique: true });
  await db.collection("subscribers").createIndex({ joinedAt: -1 });
  for (const name of ["priceReports", "celebrityRequests", "subscribers"]) {
    console.log(`  ${name.padEnd(18)} ${await db.collection(name).countDocuments()} documents`);
  }

  console.log("Done.");
  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
