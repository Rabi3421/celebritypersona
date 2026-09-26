/**
 * Fills the SEO fields every existing look is missing, without changing how
 * any of them reads today.
 *
 *     npm run backfill:seo                                  # dry run
 *     npm run backfill:seo -- --apply --i-know-this-is-prod
 *
 * Per look, and only where the field is absent:
 *
 *  - slug          the address it is already served on, so no URL moves
 *  - occasions     [occasion, …whatever is already listed], primary first
 *  - leadPieceId   the first piece when the look has its own search title,
 *                  since the lead then plays no part in the H1; otherwise the
 *                  piece the fallback title and H1 are already built on (the
 *                  dearest priced piece, else the first), so no heading moves
 *  - slugLockedAt  the day it was published, for looks that are live
 *  - photo alt     "{Celebrity} wearing the {lead piece} by {label}", for
 *                  any photo saved without one
 *
 * Deliberately left empty: piece categories and colours, and the primary and
 * secondary keywords. Those are an editor's call, and the SEO checklist flags
 * every look still missing them.
 *
 * Nothing is removed, and a field that already has a value is never
 * overwritten — except `occasions`, which is only ever extended to include the
 * primary it is required to hold.
 */

import { MongoClient } from "mongodb";
import { assertWritable } from "@/lib/prod-guard";
import { suggestPhotoAlt } from "@/lib/photo-alt";
import { outfitSlug } from "@/lib/slugs";
import { isPublished, leadPiece, outfitOccasions, outfitPhotos, type Outfit } from "@/lib/types";
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

type Plan = { outfit: Outfit; set: Record<string, unknown>; notes: string[]; todo: string[] };

const sameList = (a: readonly string[] = [], b: readonly string[] = []) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

function plan(outfit: Outfit): Plan {
  const set: Record<string, unknown> = {};
  const notes: string[] = [];
  const todo: string[] = [];

  if (!outfit.slug?.trim()) {
    set.slug = outfitSlug(outfit);
    notes.push(`slug: freeze at ${set.slug} (already served there)`);
  }

  const occasions = outfitOccasions(outfit);
  if (!sameList(occasions, outfit.occasions)) {
    set.occasions = occasions;
    notes.push(`occasions: ${JSON.stringify(outfit.occasions ?? null)} -> ${JSON.stringify(occasions)}`);
  }

  /**
   * With its own search title, the H1 is that title and the lead feeds only
   * the alt text and the checklist, so the first piece — normally the garment
   * the look is named for — is the better guess. Without one, the fallback
   * title is built from the lead, so the lead the page already uses is kept.
   */
  const ownTitle = Boolean(outfit.seoTitle?.trim());
  const before = leadPiece({ ...outfit, leadPieceId: undefined });
  const choice = ownTitle ? outfit.items[0] : before;
  const stored = outfit.leadPieceId && outfit.items.some((item) => item.id === outfit.leadPieceId);
  if (!stored) {
    if (choice?.id) {
      set.leadPieceId = choice.id;
      notes.push(
        `leadPieceId: "${choice.name}" (${ownTitle ? "first piece; has its own title" : "same lead the title uses"})`,
      );
    } else if (choice) {
      todo.push(`lead piece "${choice.name}" has no id — run npm run migrate:links first`);
    } else {
      todo.push("no pieces, so no lead piece");
    }
  }
  const leadId = (set.leadPieceId as string | undefined) ?? outfit.leadPieceId;

  if (!outfit.slugLockedAt) {
    if (isPublished(outfit)) {
      set.slugLockedAt = outfit.publishedAt ?? outfit.date;
      notes.push(`slugLockedAt: ${set.slugLockedAt}`);
    } else {
      todo.push("not published, so the slug is not locked");
    }
  }

  // Alt text, on whichever photo field the document carries.
  const photos = outfitPhotos(outfit);
  const withLead = { ...outfit, leadPieceId: leadId };
  const alts = photos.map((photo) =>
    photo.alt?.trim() ? photo.alt : suggestPhotoAlt(withLead),
  );
  const filled = photos.filter((photo) => !photo.alt?.trim()).length;
  if (filled) {
    if (outfit.images?.length) {
      set.images = outfit.images.map((photo, index) => ({ ...photo, alt: alts[index] }));
    } else if (outfit.image) {
      set.image = { ...outfit.image, alt: alts[0] };
    }
    photos.forEach((photo, index) => {
      if (!photo.alt?.trim()) notes.push(`alt[${index}]: "${alts[index]}"`);
    });
  }

  const uncategorised = outfit.items.filter((item) => !item.category).length;
  if (uncategorised) todo.push(`${uncategorised} of ${outfit.items.length} pieces need a category`);
  if (outfit.items.some((item) => !item.colours?.length)) todo.push("pieces need colours");
  if (!outfit.primaryKeyword) todo.push("primary keyword");

  // The one invariant this must not break: the lead a fallback headline is
  // built on. A look with its own title does not use it for the headline.
  const after = leadPiece({ ...outfit, ...set } as Outfit);
  if (!ownTitle && after?.id !== before?.id) {
    throw new Error(`#${outfit.id}: lead piece would change from ${before?.name} to ${after?.name}`);
  }

  return { outfit, set, notes, todo };
}

async function main() {
  if (apply) assertWritable("fill SEO fields (occasions, lead piece, slug lock, photo alt) on every look");

  const client = new MongoClient(requireUri(), { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const collection = client.db(process.env.MONGODB_DB).collection<Outfit>("outfits");
  const outfits = await collection.find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray();

  const plans = outfits.map(plan);
  const changing = plans.filter((entry) => Object.keys(entry.set).length > 0);

  for (const { outfit, notes, todo } of plans) {
    console.log(`#${outfit.id} ${outfitSlug(outfit)}${isPublished(outfit) ? "" : "  [not published]"}`);
    for (const note of notes) console.log(`   set   ${note}`);
    if (!notes.length) console.log("   set   nothing");
    if (todo.length) console.log(`   todo  ${todo.join("; ")}`);
    console.log();
  }

  console.log(`${changing.length} of ${outfits.length} looks would change.`);

  if (!apply) {
    console.log("\nDry run. Nothing was written. Re-run with --apply to write it.");
    await client.close();
    return;
  }

  if (changing.length > 0) {
    // Every look, not only the ones changing, so the backup is a complete
    // picture of the collection as it stood. See scripts/backup.ts.
    await backupDocuments("backfill-seo", outfits);
    for (const { outfit, set } of changing) {
      if (Object.keys(set).length) await collection.updateOne({ id: outfit.id }, { $set: set });
    }
    console.log(`Wrote ${changing.length} looks.`);
  }
  await client.close();
  await revalidateSite();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
