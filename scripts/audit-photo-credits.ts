/**
 * Lists every stored photograph that does not name a source.
 *
 * The credit field used to be optional, so most photographs in the archive
 * have none, and the public page captioned those "Photo · Editorial archive" —
 * an attribution to nobody, printed over somebody else's work. Creating a look
 * now requires a real credit on every photo. Editing a look that is already
 * live is never blocked: it saves, and the panel says what is outstanding.
 *
 * This is the worklist for that. Read-only; it changes nothing.
 *
 *     npm run audit:credits
 *
 * The rule it applies is the same one the admin form applies, imported rather
 * than restated so the two cannot drift.
 */

import { MongoClient } from "mongodb";
import { isSpecificCredit } from "@/lib/photo-credit";

function requireUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Run with --env-file=.env");
    process.exit(1);
  }
  return uri;
}

type StoredPhoto = { credit?: string; path?: string };
type StoredOutfit = {
  id: number;
  celebrity: string;
  event: string;
  slug?: string;
  image?: StoredPhoto;
  images?: StoredPhoto[];
};

async function main() {
  const client = new MongoClient(requireUri(), { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB);

  const outfits = await db
    .collection<StoredOutfit>("outfits")
    .find({}, { projection: { _id: 0 } })
    .sort({ id: 1 })
    .toArray();

  let totalPhotos = 0;
  let totalMissing = 0;
  const failing = [];

  for (const outfit of outfits) {
    const photos: StoredPhoto[] = outfit.images?.length
      ? outfit.images
      : outfit.image
        ? [outfit.image]
        : [];
    totalPhotos += photos.length;

    const missing = photos
      .map((photo, index) => ({ index, credit: photo.credit, path: photo.path }))
      .filter((photo) => !isSpecificCredit(photo.credit));
    totalMissing += missing.length;

    if (missing.length === 0) continue;
    failing.push({ outfit, photos: photos.length, missing });
  }

  console.log(`${outfits.length} looks · ${totalPhotos} photos · ${totalMissing} uncredited\n`);

  for (const { outfit, photos, missing } of failing) {
    const slug = outfit.slug ?? "(no slug)";
    console.log(
      `id ${outfit.id} · ${outfit.celebrity} — ${outfit.event}\n` +
        `  ${missing.length} of ${photos} photos uncredited · /admin/outfits/${outfit.id}\n` +
        `  slug: ${slug}`,
    );
    for (const photo of missing) {
      const shown = photo.credit ? `"${photo.credit}" (too generic)` : "(empty)";
      console.log(`    photo ${photo.index + 1}: ${shown}`);
    }
    console.log();
  }

  const clean = outfits.length - failing.length;
  console.log(
    failing.length === 0
      ? "Every photo names a source."
      : `${failing.length} of ${outfits.length} looks have an uncredited photo` +
        `${clean ? `; ${clean} ${clean === 1 ? "is" : "are"} clean` : ""}.\n` +
        `These still save. A new look cannot be created with an uncredited ` +
        `photo; editing one that is already live is never blocked.`,
  );

  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
