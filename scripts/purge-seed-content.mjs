/**
 * Removes the demo content that shipped to production from lib/seed-data.
 *
 * The archive holds twenty invented looks — outfits, brands, prices and dates
 * that were never worn — attributed by name to Alia Bhatt, Deepika Padukone,
 * Ananya Panday, Sara Ali Khan, Kiara Advani and Janhvi Kapoor. Nineteen of
 * them were live, indexable and listed in sitemap.xml. Alongside them sit ten
 * "trending search" rows carrying search volumes nothing on this site
 * measures.
 *
 * Nothing here runs without being asked twice:
 *
 *     node --env-file=.env scripts/purge-seed-content.mjs          # dry run
 *     node --env-file=.env scripts/purge-seed-content.mjs --apply  # deletes
 *
 * Take a backup first. `mongodump --uri "$MONGODB_URI"` is enough.
 *
 * Stored photographs are NOT deleted from Firebase; their paths are printed so
 * you can reuse or remove them yourself. One of these records (id 1) carries
 * four photographs uploaded for an Amyra Dastur shoot that are currently
 * published under Alia Bhatt's name — those are worth keeping and re-attaching
 * to a record of their own.
 */

import { MongoClient } from "mongodb";

/** The ids lib/seed-data/outfits.ts writes. Nothing outside this list is
 *  touched, and each one is printed in full before it goes. */
const SEED_OUTFIT_IDS = Array.from({ length: 20 }, (_, index) => index + 1);

/** The terms lib/seed-data/trending.ts writes. */
const SEED_TRENDING_TERMS = [
  "alia bhatt airport look",
  "sangeet lehenga under 5000",
  "deepika saree",
  "ananya panday co-ord",
  "diwali kurta set",
  "bollywood dupe myntra",
  "kiara advani red carpet",
  "mehendi outfit ideas",
  "sara ali khan jutti",
  "janhvi kapoor casual look",
];

const apply = process.argv.includes("--apply");

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set. Run with --env-file=.env");
  process.exit(1);
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const db = client.db(process.env.MONGODB_DB);

const outfits = db.collection("outfits");
const trending = db.collection("trendingSearches");
const celebrities = db.collection("celebrities");

const doomed = await outfits.find({ id: { $in: SEED_OUTFIT_IDS } }).sort({ id: 1 }).toArray();

console.log(`\n${apply ? "DELETING" : "WOULD DELETE"} ${doomed.length} seed outfits\n`);
const orphanedPhotos = [];
for (const outfit of doomed) {
  const photos = outfit.images?.length ? outfit.images : outfit.image ? [outfit.image] : [];
  for (const photo of photos) orphanedPhotos.push(photo.path);
  console.log(
    `  id ${String(outfit.id).padStart(2)}  ${outfit.celebrity} — ${outfit.event}` +
      `  (${outfit.items.length} pieces, ${photos.length} photos)`,
  );
}

/**
 * The one seed bio, which reads as a confident description of how Alia Bhatt
 * dresses ("Anita Dongre is her most repeated label") but is a description of
 * the invented looks above. With those gone it describes nothing.
 */
const SEED_BIO_OPENING = "Alia dresses like someone who decided what she likes";
const seedBio = await celebrities.findOne({
  name: "Alia Bhatt",
  "bio.0": { $regex: `^${SEED_BIO_OPENING}` },
});

const doomedTerms = await trending.find({ term: { $in: SEED_TRENDING_TERMS } }).toArray();
console.log(`\n${apply ? "DELETING" : "WOULD DELETE"} ${doomedTerms.length} seed trending rows\n`);
for (const row of doomedTerms) console.log(`  "${row.term}"  (volume ${row.volume})`);

if (orphanedPhotos.length) {
  console.log(
    "\nPhotographs these records point at. They stay in Firebase Storage; " +
      "re-attach or delete them yourself:\n",
  );
  for (const path of orphanedPhotos) console.log(`  ${path}`);
}

if (seedBio) {
  console.log(
    `\n${apply ? "CLEARING" : "WOULD CLEAR"} the seeded Alia Bhatt bio ` +
      "(it describes the invented looks above).",
  );
}

if (apply) {
  const a = await outfits.deleteMany({ id: { $in: SEED_OUTFIT_IDS } });
  const b = await trending.deleteMany({ term: { $in: SEED_TRENDING_TERMS } });
  const c = seedBio
    ? await celebrities.updateOne({ _id: seedBio._id }, { $unset: { bio: "" } })
    : { modifiedCount: 0 };
  console.log(
    `\nDeleted ${a.deletedCount} outfits and ${b.deletedCount} trending rows; ` +
      `cleared ${c.modifiedCount} seeded bio.`,
  );
} else {
  console.log("\nDry run. Re-run with --apply to delete.");
}

// Afterwards, report which celebrity records are left with nothing behind
// them. Their pages carry noindex and stay out of the sitemap, so they do no
// harm — but they are also doing no work.
const remaining = await outfits.find({}).toArray();
const withLooks = new Set(remaining.map((outfit) => outfit.celebrity));
const empty = (await celebrities.find({}).toArray())
  .filter((celebrity) => !withLooks.has(celebrity.name))
  .map((celebrity) => celebrity.name);

console.log(
  `\n${remaining.length - (apply ? 0 : doomed.length)} outfits will remain.` +
    `\nCelebrity records with no decoded look (noindexed, not in sitemap): ${empty.length}`,
);
if (empty.length) console.log(`  ${empty.join(", ")}`);

await client.close();
