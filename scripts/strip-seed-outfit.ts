/**
 * Strips the invented pieces from outfit id 1, keeping its photographs.
 *
 * That record began life as seed look #1, "Alia Bhatt at Mumbai Airport": four
 * pieces, their brands and both sides of their prices, none of which anybody
 * wore. It was later renamed to Amyra Dastur and four real photographs of her
 * were attached, but the fabricated pieces stayed on it. So the live archive
 * held Anita Dongre / Bottega Veneta / Hermes / Gucci originals totalling
 * Rs 4,43,500, swapping to Rs 5,489, published under a real person's name
 * against real photographs of her.
 *
 * It was also the only look in the archive priced on both sides, which made it
 * the sole source of the "average saving" the homepage and the outfits index
 * quoted, of the ticker, of Dupe of the Week and of the budget tiers.
 *
 * The photographs are hers and worth keeping, so this empties `items` and
 * clears the stale stored totals rather than deleting the record. What is left
 * is a look with photographs and no decode, which `hasSubstance` already keeps
 * out of the sitemap, the index and the outfits list until an editor decodes
 * it properly in the panel.
 *
 *     npm run strip:seed-outfit           # dry run, writes nothing
 *     npm run strip:seed-outfit -- --apply
 *
 * The document is backed up to .scratch/ before anything changes, so the old
 * state can be put back with mongoimport if this turns out to be wrong.
 */

import { MongoClient } from "mongodb";
import { assertWritable } from "@/lib/prod-guard";
import { backupDocuments } from "./backup";
import { revalidateSite } from "./revalidate";

/** The one record this touches. Nothing else is read or written. */
const OUTFIT_ID = 1;

/**
 * The seed's own pieces, so the script refuses to run against a record an
 * editor has already fixed. Matched on the piece names together with the worn
 * prices, which is specific enough that a real decode cannot collide with it.
 */
const SEED_SIGNATURE = [
  { name: "Ivory kurta", worn: 42000 },
  { name: "Structured tote", worn: 285000 },
  { name: "Flat sandals", worn: 78000 },
  { name: "Sunglasses", worn: 38500 },
];

const apply = process.argv.includes("--apply");

function requireUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Run with --env-file=.env");
    process.exit(1);
  }
  return uri;
}

type Piece = { name: string; worn?: number };

/** True only if the record still carries exactly the fabricated pieces. */
function isUntouchedSeed(items: Piece[]): boolean {
  if (items.length !== SEED_SIGNATURE.length) return false;
  return SEED_SIGNATURE.every((expected) =>
    items.some((item) => item.name === expected.name && item.worn === expected.worn),
  );
}

async function main() {
  assertWritable("empty the pieces on outfit id 1");

  const client = new MongoClient(requireUri(), { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB);
  const outfits = db.collection("outfits");

  const outfit = await outfits.findOne({ id: OUTFIT_ID });
  if (!outfit) {
    console.error(`No outfit with id ${OUTFIT_ID}. Nothing to do.`);
    await client.close();
    process.exit(1);
  }

  const items = (outfit.items ?? []) as Piece[];
  const photos = outfit.images?.length ? outfit.images.length : outfit.image ? 1 : 0;

  console.log(`id ${outfit.id} · ${outfit.celebrity} — ${outfit.event}`);
  console.log(`  slug:   ${outfit.slug ?? "(none)"}`);
  console.log(`  photos: ${photos} (kept)`);
  console.log(`  stored totals: worn ${outfit.worn ?? 0}, swap ${outfit.swap ?? 0} (cleared)`);
  console.log(`  pieces to remove: ${items.length}`);
  for (const item of items) {
    console.log(`    - ${item.name}: ${JSON.stringify(item)}`);
  }

  if (items.length === 0) {
    console.log("\nAlready has no pieces. Nothing to do.");
    await client.close();
    return;
  }

  if (!isUntouchedSeed(items)) {
    console.error(
      "\nThese are not the seed's four pieces. Somebody has edited this record " +
        "since, so this script will not touch it. Check it by hand at " +
        `/admin/outfits/${OUTFIT_ID}.`,
    );
    await client.close();
    process.exit(1);
  }

  if (!apply) {
    console.log("\nDry run. Nothing was written. Re-run with --apply to make the change.");
    await client.close();
    return;
  }

  await backupDocuments("strip-seed-outfit", [outfit]);

  await outfits.updateOne(
    { id: OUTFIT_ID },
    {
      $set: {
        items: [],
        // Both are deprecated stored totals nothing rendered should read, but
        // leaving Rs 4,43,500 on the document invites the next person to.
        worn: 0,
        swap: 0,
      },
    },
  );

  console.log(
    "Done. The look keeps its photographs and is now a look with no decode, " +
      "which stays out of the sitemap, the index and the outfits list until " +
      `it is decoded at /admin/outfits/${OUTFIT_ID}.`,
  );
  await client.close();
  await revalidateSite();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
