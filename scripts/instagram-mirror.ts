/**
 * Copies the account's latest reels into our own storage.
 *
 * The homepage used to render Instagram's own thumbnail URLs and hotlink the
 * reel MP4s. Those links are signed and expire in days, and they sent every
 * visitor's browser to Meta's CDN. This fetches the same reels from the Graph
 * API once, stores each thumbnail in Firebase alongside the outfit photos, and
 * writes the metadata to `siteContent/reels`, which is what the page reads.
 *
 *     npm run instagram:mirror
 *
 * Run it whenever you want the strip to catch up — a cron job or a deploy hook
 * is fine. It is safe to re-run: thumbnails are keyed by reel id, so a reel
 * already mirrored is refreshed in place rather than duplicated, and files for
 * reels that have dropped out of the latest set are deleted from the bucket.
 *
 * A lapsed token makes this a no-op rather than an erasure: whatever was
 * mirrored last time stays on the site. Run `npm run instagram:refresh`
 * monthly to keep the token alive.
 */

import { deleteObject, getDownloadURL, listAll, ref, uploadBytes } from "firebase/storage";
import { MongoClient } from "mongodb";
import { fetchInstagramReels, type InstagramReel } from "@/lib/instagram";
import { firebaseStorage } from "@/lib/firebase";
import { assertWritable } from "@/lib/prod-guard";

/** How many the homepage strip shows. */
const LIMIT = 6;

/** Everything mirrored lives here, one file per reel. */
const FOLDER = "instagram";

/** A thumbnail is a small JPEG; anything much larger is not one. */
const MAX_BYTES = 6 * 1024 * 1024;

function requireUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Run with --env-file=.env");
    process.exit(1);
  }
  return uri;
}

/** Reel ids are numeric strings from Meta, but the path is ours to keep safe. */
const pathFor = (id: string) => `${FOLDER}/${id.replace(/[^a-zA-Z0-9]/g, "")}.jpg`;

async function main() {
  assertWritable("replace the mirrored reels and upload to the live bucket");

  if (!process.env.INSTAGRAM_ACCESS_TOKEN) {
    console.error("INSTAGRAM_ACCESS_TOKEN is not set. Nothing to mirror.");
    process.exit(1);
  }

  const sources = await fetchInstagramReels(LIMIT);
  if (sources.length === 0) {
    // Either the token has lapsed or the account has no reels. Neither is a
    // reason to take down what is already mirrored.
    console.error(
      "No reels came back. The previously mirrored set is left untouched.\n" +
        "If this is unexpected, the token has probably expired — run npm run instagram:refresh.",
    );
    process.exit(1);
  }

  const storage = firebaseStorage();
  const mirrored: InstagramReel[] = [];

  for (const source of sources) {
    const response = await fetch(source.thumbnailUrl);
    if (!response.ok) {
      console.error(`  skipped ${source.id}: thumbnail fetch returned ${response.status}`);
      continue;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
      console.error(`  skipped ${source.id}: thumbnail was ${bytes.byteLength} bytes`);
      continue;
    }

    const path = pathFor(source.id);
    const handle = ref(storage, path);
    await uploadBytes(handle, bytes, { contentType: "image/jpeg" });

    mirrored.push({
      id: source.id,
      caption: source.caption,
      permalink: source.permalink,
      thumbnail: await getDownloadURL(handle),
      thumbnailPath: path,
      postedAt: source.postedAt,
    });
    console.log(`  mirrored ${source.id} → ${path}`);
  }

  if (mirrored.length === 0) {
    console.error("Every thumbnail failed to mirror. Nothing was changed.");
    process.exit(1);
  }

  const client = new MongoClient(requireUri(), { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB);
  await db
    .collection("siteContent")
    .updateOne({ key: "reels" }, { $set: { key: "reels", value: mirrored } }, { upsert: true });
  await client.close();

  // Files for reels no longer in the set are dead weight in the bucket, and a
  // reel taken down on Instagram should not leave its still behind.
  const keep = new Set(mirrored.map((reel) => reel.thumbnailPath));
  const stored = await listAll(ref(storage, FOLDER));
  let removed = 0;
  for (const item of stored.items) {
    if (keep.has(item.fullPath)) continue;
    await deleteObject(item);
    removed += 1;
  }

  console.log(
    `\n${mirrored.length} reels mirrored${removed ? `, ${removed} stale file${removed === 1 ? "" : "s"} removed` : ""}.`,
  );
  console.log("The homepage will pick them up at its next revalidation.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
