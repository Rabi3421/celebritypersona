import "server-only";
import { getOutfitBySlug } from "@/lib/db/content";
import { shareImage } from "@/lib/share-image";
import type { ShareKind } from "@/lib/share-text";

/**
 * GET /outfits/<slug>/card.png and /outfits/<slug>/pin.png, for LIVE looks
 * only; a draft has no public images, just as it has no public page. Links
 * carry ?v=<shareVersion>, so a long cache never serves an old picture.
 */
export async function publicShareImage(slug: string, kind: ShareKind) {
  const outfit = await getOutfitBySlug(slug);
  if (!outfit) return new Response("Not found", { status: 404 });
  return shareImage(outfit, kind, {
    "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
  });
}
