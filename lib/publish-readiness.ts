import "server-only";
import { getAllOutfits } from "@/lib/db/content";
import { lookJobForOutfit } from "@/lib/db/look-jobs";
import { keywordOwners } from "@/lib/keyword-owners";
import { openChecks, type LookJob } from "@/lib/look-jobs";
import { blockingChecks, seoChecks, type SeoCheck } from "@/lib/seo-checks";
import { outfitSlug } from "@/lib/slugs";
import { hasSwap, hasWornPrice, isPublished, outfitPhotos, type Outfit } from "@/lib/types";

export type PublishReadiness = {
  outfit: Outfit;
  job: LookJob | null;
  live: boolean;
  /** Research checks the editor has not confirmed yet. */
  openResearch: string[];
  /** Critical SEO checks that fail (the same ones the editor and the list refuse on). */
  blocking: SeoCheck[];
  ready: boolean;
};

/**
 * Everything that stands between a look and going live, gathered once, with
 * the same rules as the editor's save and the list's Publish button.
 */
export async function publishReadiness(id: number): Promise<PublishReadiness | null> {
  const outfits = await getAllOutfits();
  const outfit = outfits.find((item) => item.id === id);
  if (!outfit) return null;
  const job = await lookJobForOutfit(id);
  const blocking = blockingChecks(
    seoChecks(
      { ...outfit, slug: outfitSlug(outfit), images: outfitPhotos(outfit), leadChosen: Boolean(outfit.leadPieceId) },
      { id, owners: keywordOwners(outfits) },
    ),
  );
  // isPublished also needs a price or a swap: without one, Publish would change nothing a reader sees.
  if (!outfit.items.some(hasSwap) && !outfit.items.some(hasWornPrice)) {
    blocking.push({ id: "price", level: "critical", ok: false, label: "A confirmed price or a cheaper swap", detail: "Without one the look stays off the site." });
  }
  const openResearch = openChecks(job);
  return { outfit, job, live: isPublished(outfit), openResearch, blocking, ready: !openResearch.length && !blocking.length };
}
