/**
 * Reports which stored slugs do not match the house formula.
 *
 *     npm run audit:slugs
 *
 * Read-only, deliberately. A slug that does not conform is not broken: it is a
 * URL people and search engines may already have, and changing one needs a 301
 * and a decision, not a migration. This only says which ones differ and what
 * the formula would have produced, so that decision can be made look by look.
 */

import { MongoClient } from "mongodb";
import { outfitSlug, suggestOutfitSlug } from "@/lib/slugs";
import type { Outfit } from "@/lib/types";

function requireUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Run with --env-file=.env");
    process.exit(1);
  }
  return uri;
}

async function main() {
  const client = new MongoClient(requireUri(), { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const outfits = await client
    .db(process.env.MONGODB_DB)
    .collection<Outfit>("outfits")
    .find({}, { projection: { _id: 0 } })
    .sort({ id: 1 })
    .toArray();

  const taken = outfits.map(outfitSlug);
  let off = 0;
  let cosmetic = 0;

  for (const outfit of outfits) {
    const current = outfitSlug(outfit);
    const suggested = suggestOutfitSlug(
      outfit,
      taken.filter((slug) => slug !== current),
    );
    const stored = Boolean(outfit.slug?.trim());
    if (current === suggested) continue;

    off += 1;
    /**
     * Only two things make a slug worth the cost of moving it: a date, which
     * makes a URL look stale the moment the year turns, and having no slug of
     * its own, which means the URL is derived and will change by itself if
     * anybody edits the celebrity or the event. Everything else differs in
     * word order or in how much of the piece name it carries, which is a
     * preference, not a problem — and not worth a redirect.
     */
    const dated = /\d{4}-\d{2}-\d{2}$/.test(current);
    const severity = dated || !stored ? "WORTH MOVING" : "cosmetic";
    if (severity === "cosmetic") cosmetic += 1;

    console.log(`[${severity}] id ${outfit.id} · ${outfit.celebrity} — ${outfit.event}`);
    console.log(`   now:     ${current}${stored ? "" : "   (derived, never stored)"}`);
    console.log(`   formula: ${suggested}`);
    const why: string[] = [];
    if (dated) why.push("carries a date");
    if (!stored) why.push("derived, so it moves on its own if the event is edited");
    if (why.length) console.log(`   ${why.join("; ")}`);
    console.log();
  }

  console.log(
    off === 0
      ? `All ${outfits.length} slugs match the formula.`
      : `${off} of ${outfits.length} differ: ${off - cosmetic} worth moving, ${cosmetic} cosmetic.\n` +
        "Nothing was changed. Moving one needs a 301, so each is your call.",
  );
  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
