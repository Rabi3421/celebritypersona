/**
 * Moves looks out of Casual and Promo tour into the occasions they belong to.
 *
 *     npm run retag:occasions                                  # dry run
 *     npm run retag:occasions -- --apply --i-know-this-is-prod
 *
 * Casual had become the place everything unclassifiable went: four editorial
 * photoshoots, an Instagram campaign and a festive anarkali were all filed
 * there, and a sixth shoot was filed under Promo tour because it was posted to
 * promote something. That makes the Casual archive describe nothing — its
 * "garment worn most" and its colour palette are an average of six unrelated
 * things — and leaves the categories a reader would actually browse empty.
 *
 * Each move below is justified by the look's own event name, which an editor
 * wrote at the time. Nothing here is inferred from the garment alone.
 *
 * Run `npm run seed:content` first: the two new occasions have to exist before
 * anything can be filed under them, or the looks land in an occasion with no
 * record and get filed under Everyday with no description.
 */

import { MongoClient } from "mongodb";
import { assertWritable } from "@/lib/prod-guard";
import { revalidateSite } from "./revalidate";

const apply = process.argv.includes("--apply");

const EDITORIAL = "Photoshoot / Editorial";
const FESTIVE = "Festive";

/**
 * The proposal, keyed by outfit id.
 *
 * `from` is recorded so the script refuses to move a look an editor has
 * already re-tagged by hand since this was written.
 */
const MOVES: { id: number; from: string; to: string; why: string }[] = [
  { id: 21, from: "Casual", to: EDITORIAL, why: "Event is “Instagram / Homegrown Wednesdays” — a shoot, not an off-duty outfit" },
  { id: 23, from: "Casual", to: EDITORIAL, why: "Event is “Editorial Photoshoot”" },
  { id: 24, from: "Casual", to: EDITORIAL, why: "Event is “Fashion Photoshoot”" },
  { id: 25, from: "Sangeet", to: FESTIVE, why: "Event is “Shaadi Season Look”, which names a season, not a ceremony; Sangeet was never confirmed" },
  { id: 26, from: "Casual", to: EDITORIAL, why: "Event is “Fashion Editorial”" },
  { id: 27, from: "Casual", to: FESTIVE, why: "Event is “Festive Look” — a silk Chanderi anarkali" },
  { id: 29, from: "Casual", to: EDITORIAL, why: "Event is “Instagram Fashion Photoshoot”" },
  { id: 30, from: "Promo tour", to: EDITORIAL, why: "Event is “Instagram Fashion Photoshoot” — a shoot, filed as a promo tour" },
];

/** Left where they are, and why — printed so the reasoning is reviewable. */
const KEPT: { id: number; tag: string; why: string }[] = [
  { id: 22, tag: "Promo tour", why: "Event is “Hyderabad promo tour” — genuinely a promo tour" },
  { id: 28, tag: "Promo tour", why: "Event is “Udta Teer promotional post” — a film promo" },
];

type StoredOutfit = { id: number; celebrity: string; event: string; occasion: string };

function requireUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Run with --env-file=.env");
    process.exit(1);
  }
  return uri;
}

async function main() {
  if (apply) assertWritable("re-file eight looks under different occasions");

  const client = new MongoClient(requireUri(), { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB);
  const outfits = db.collection<StoredOutfit>("outfits");

  // The destinations have to exist, or the looks land in an occasion with no
  // record: no description, no palette, filed under Everyday.
  const names = new Set(
    (await db.collection<{ name: string }>("occasions").find({}, { projection: { name: 1 } }).toArray())
      .map((row) => row.name),
  );
  const missing = [EDITORIAL, FESTIVE].filter((name) => !names.has(name));
  if (missing.length) {
    console.error(
      `These occasions do not exist yet: ${missing.join(", ")}.\n` +
        "Run npm run seed:content first, then re-run this.",
    );
    await client.close();
    process.exit(1);
  }

  let ready = 0;
  let blocked = 0;

  console.log("MOVES\n");
  for (const move of MOVES) {
    const outfit = await outfits.findOne({ id: move.id });
    if (!outfit) {
      console.error(`  id ${move.id}: no such look. Skipped.`);
      blocked += 1;
      continue;
    }
    if (outfit.occasion !== move.from) {
      console.error(
        `  id ${move.id} · ${outfit.celebrity}: expected “${move.from}”, found “${outfit.occasion}”. ` +
          "Somebody has re-tagged this since the proposal was written, so it is left alone.",
      );
      blocked += 1;
      continue;
    }
    console.log(`  id ${outfit.id} · ${outfit.celebrity} — ${outfit.event}`);
    console.log(`      ${move.from}  →  ${move.to}`);
    console.log(`      ${move.why}\n`);
    ready += 1;

    if (apply) await outfits.updateOne({ id: move.id }, { $set: { occasion: move.to } });
  }

  console.log("KEPT\n");
  for (const keep of KEPT) {
    const outfit = await outfits.findOne({ id: keep.id });
    console.log(`  id ${keep.id} · ${outfit?.celebrity ?? "?"} — stays ${keep.tag}`);
    console.log(`      ${keep.why}\n`);
  }

  /**
   * Only the moves that actually leave Casual count against it. Two of the
   * eight come from Sangeet and Promo tour, and subtracting all of them
   * reported "-2 looks still filed under Casual".
   */
  const leavingCasual = MOVES.filter((move) => move.from === "Casual").length;
  const remaining = await outfits.countDocuments({ occasion: "Casual" });
  console.log(
    `${ready} to move, ${blocked} blocked, ${KEPT.length} kept.\n` +
      `Looks filed under Casual after this: ${apply ? remaining : remaining - leavingCasual}`,
  );

  if (!apply) {
    console.log("\nDry run. Nothing was written. Re-run with --apply to re-file them.");
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
