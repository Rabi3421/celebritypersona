/**
 * Creates a celebrity or occasion record for every name a published look uses
 * that does not have one yet.
 *
 *     npm run backfill:records                                  # dry run
 *     npm run backfill:records -- --apply --i-know-this-is-prod
 *
 * The public pages already exist for these names, built from a virtual row, so
 * nothing a reader sees changes: the page, its URL (built from the name,
 * which is copied exactly as the outfits spell it) and its fallback bio are the
 * same. What changes is that the name now has a document an editor can open
 * and write an intro into.
 *
 * Only published looks count, matching what the admin lists show. A draft's
 * names get their records when the draft is next saved, as every save now
 * creates them.
 */

import { MongoClient } from "mongodb";
import { assertWritable } from "@/lib/prod-guard";
import { blankCelebrity, blankOccasion, missingRecords } from "@/lib/archive-records";
import { nameSlug } from "@/lib/slugs";
import { isPublished, type Celebrity, type Occasion, type Outfit } from "@/lib/types";
import { revalidateSite } from "./revalidate";
import { backupDocuments } from "./backup";

const apply = process.argv.includes("--apply");

function requireUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Run with --env-file=.env");
    process.exit(1);
  }
  return uri;
}

async function main() {
  if (apply) assertWritable("create celebrity and occasion records for names that have none");

  const client = new MongoClient(requireUri(), { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB);
  const noId = { projection: { _id: 0 } } as const;
  const [outfits, celebrities, occasions] = await Promise.all([
    db.collection<Outfit>("outfits").find({}, noId).toArray(),
    db.collection<Celebrity>("celebrities").find({}, noId).sort({ id: 1 }).toArray(),
    db.collection<Occasion>("occasions").find({}, noId).sort({ id: 1 }).toArray(),
  ]);

  const missing = missingRecords({ celebrities, occasions }, outfits.filter(isPublished));
  const nextCelebrity = Math.max(0, ...celebrities.map((record) => record.id)) + 1;
  const nextOccasion = Math.max(0, ...occasions.map((record) => record.id)) + 1;
  const newCelebrities = missing.celebrities.map((name, i) => blankCelebrity(nextCelebrity + i, name));
  const newOccasions = missing.occasions.map((name, i) => blankOccasion(nextOccasion + i, name));

  console.log(`Celebrities: ${celebrities.length} records, ${newCelebrities.length} to create`);
  for (const record of newCelebrities) {
    console.log(`   #${record.id} ${record.name}  → /celebrities/${nameSlug(record.name)} (unchanged)`);
  }
  console.log(`\nOccasions: ${occasions.length} records, ${newOccasions.length} to create`);
  for (const record of newOccasions) {
    console.log(`   #${record.id} ${record.name}  → /occasions/${nameSlug(record.name)} (unchanged)`);
  }

  if (!apply) {
    console.log("\nDry run. Nothing was written. Re-run with --apply to create them.");
    await client.close();
    return;
  }

  if (newCelebrities.length || newOccasions.length) {
    // Both collections whole, as they stood. See scripts/backup.ts.
    await backupDocuments("backfill-records", [
      { collection: "celebrities", documents: celebrities },
      { collection: "occasions", documents: occasions },
    ]);
    if (newCelebrities.length) await db.collection<Celebrity>("celebrities").insertMany(newCelebrities);
    if (newOccasions.length) await db.collection<Occasion>("occasions").insertMany(newOccasions);
    console.log(`\nCreated ${newCelebrities.length} celebrity and ${newOccasions.length} occasion records.`);
  }
  await client.close();
  await revalidateSite();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
