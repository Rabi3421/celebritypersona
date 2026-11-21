import "server-only";
import { randomBytes } from "node:crypto";
import { deleteObject, getBytes, getDownloadURL, getMetadata, ref, uploadBytes } from "firebase/storage";
import { canonicalName } from "@/lib/archive";
import { getAllOutfits, getCelebrityViews, getOccasionViews } from "@/lib/db/content";
import { createOutfit } from "@/lib/db/mutations";
import { uploaderStorage } from "@/lib/firebase";
import { storagePrefix } from "@/lib/db-guard";
import { freeSlug, researchToOutfitInput, type LookResearch } from "@/lib/look-research";
import { INBOX_PHOTO, type LookJob } from "@/lib/look-jobs";
import { outfitSlug } from "@/lib/slugs";
import { fieldErrors, outfitSchema } from "@/lib/validation";

export class DraftRefused extends Error {}

/**
 * Copies the job's inbox photo into the look's own folder, named like every
 * other look photo (outfits/<slug>/<slug>-1-<hex8>.<ext>), so image search and
 * the bucket both read the same as for a hand-made look.
 */
async function filePhoto(job: LookJob, slug: string) {
  const from = job.photo?.path;
  if (!from || !INBOX_PHOTO.test(from)) return undefined;
  const storage = await uploaderStorage();
  const source = ref(storage, from);
  const [bytes, meta] = await Promise.all([getBytes(source), getMetadata(source)]);
  const ext = from.split(".").pop();
  const path = `${storagePrefix()}outfits/${slug}/${slug}-1-${randomBytes(4).toString("hex")}.${ext}`;
  const target = ref(storage, path);
  await uploadBytes(target, new Uint8Array(bytes), { contentType: meta.contentType ?? "image/webp" });
  return { path, url: await getDownloadURL(target), from };
}

/**
 * Turns checked research into a DRAFT outfit, through the same validation and
 * the same `createOutfit` as the editor's own form. Returns the new outfit id.
 * Throws DraftRefused (with every problem named) when the result would not be
 * accepted by the editor's form either; nothing is stored in that case.
 * Also returns where the photo now lives, so the job can point at it.
 */
export async function createDraftFromResearch(
  job: LookJob,
  research: LookResearch,
): Promise<{ id: number; photo?: { url: string; path: string } }> {
  const [occasions, celebrities, outfits] = await Promise.all([getOccasionViews(), getCelebrityViews(), getAllOutfits()]);
  const occasionNames = occasions.map((occasion) => occasion.name);

  // Settled against names already in use, exactly as the editor's save does,
  // so "deepika padukone" cannot fork "Deepika Padukone".
  const settled: LookResearch = {
    ...research,
    celebrity: canonicalName(research.celebrity, celebrities.map((celebrity) => celebrity.name)),
    occasion: canonicalName(research.occasion, occasionNames),
    occasions: research.occasions.map((name) => canonicalName(name, occasionNames)),
    slug: freeSlug(research.slug, outfits.map(outfitSlug)),
  };

  // Validate before touching storage, with a stand-in image so the check is real.
  const stand = job.photo ? { url: job.photo.url, path: job.photo.path } : undefined;
  const dry = outfitSchema.safeParse(researchToOutfitInput(settled, stand));
  if (!dry.success) {
    throw new DraftRefused(
      Object.entries(fieldErrors(dry.error))
        .map(([field, message]) => `${field}: ${message}`)
        .join("; "),
    );
  }

  const photo = await filePhoto(job, settled.slug);
  const parsed = outfitSchema.parse(researchToOutfitInput(settled, photo ?? stand));
  try {
    const id = await createOutfit(parsed);
    if (photo) {
      try {
        await deleteObject(ref(await uploaderStorage(), photo.from));
      } catch {
        // The inbox copy is untidy if it stays, never harmful.
      }
    }
    return { id, ...(photo ? { photo: { url: photo.url, path: photo.path } } : {}) };
  } catch (error) {
    if (photo) await deleteObject(ref(await uploaderStorage(), photo.path)).catch(() => {});
    throw error;
  }
}
