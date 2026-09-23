/**
 * Writes down the slug of every look that does not have one.
 *
 *     npm run freeze:slugs                                  # dry run
 *     npm run freeze:slugs -- --apply --i-know-this-is-prod
 *
 * A look with no stored slug is served at an address derived from its
 * celebrity, event and date. That address is not a record of anything — it is
 * recomputed on every render, so correcting a spelling in an event name, or
 * renaming a celebrity, silently moved the page. Redirects were recorded, so
 * nothing broke; but a published URL should not move because somebody fixed a
 * typo.
 *
 * This stores the address each look is *already being served on*, so no URL
 * changes and no redirect is needed. It only ever fills a gap: a look that
 * already has a slug is never touched.
 */

import { MongoClient } from "mongodb";
import { assertWritable } from "@/lib/prod-guard";
import { outfitSlug } from "@/lib/slugs";
import type { Outfit } from "@/lib/types";
import { revalidateSite } from "./revalidate";

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
  if (apply) assertWritable("store the current slug on every look that has none");

  const client = new MongoClient(requireUri(), { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const collection = client.db(process.env.MONGODB_DB).collection<Outfit>("outfits");
  const outfits = await collection.find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray();

  const floating = outfits.filter((outfit) => !outfit.slug?.trim());
  for (const outfit of floating) {
    const frozen = outfitSlug(outfit);
    console.log(`id ${outfit.id} · ${outfit.celebrity} — ${outfit.event}`);
    console.log(`   freezing at: ${frozen}`);
    console.log(`   unchanged URL, so no redirect is needed\n`);
    if (apply) await collection.updateOne({ id: outfit.id }, { $set: { slug: frozen } });
  }

  console.log(
    floating.length === 0
      ? `All ${outfits.length} looks already store their own slug.`
      : `${floating.length} of ${outfits.length} looks had no slug of their own.`,
  );

  if (!apply) {
    console.log("\nDry run. Nothing was written. Re-run with --apply to freeze them.");
    await client.close();
    return;
  }
  await client.close();
  await revalidateSite();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
