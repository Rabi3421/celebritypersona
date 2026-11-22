import "server-only";
import { getOutfitBySlug } from "@/lib/db/content";
import { cardJpeg, coverJpeg, shareImage } from "@/lib/share-image";
import type { ShareKind } from "@/lib/share-text";

/**
 * The public image routes, for LIVE looks only; a draft has no public images,
 * just as it has no public page. Links carry ?v=<shareVersion>, so a long
 * cache never serves an old picture.
 *
 *   /outfits/<slug>/cover.jpg  1200×675 real photo, no text: og:image (Discover, Search)
 *   /outfits/<slug>/card.jpg   name + prices card: twitter:image (X, WhatsApp)
 *   /outfits/<slug>/card.png   the same card as PNG (kept for links already shared)
 *   /outfits/<slug>/pin.png    1000×1500 Pinterest pin
 */
const CACHE = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400";
const notFound = () => new Response("Not found", { status: 404 });

export async function publicShareImage(slug: string, kind: ShareKind) {
  const outfit = await getOutfitBySlug(slug);
  if (!outfit) return notFound();
  return shareImage(outfit, kind, { "Cache-Control": CACHE });
}

export async function publicJpeg(slug: string, kind: "cover" | "card") {
  const outfit = await getOutfitBySlug(slug);
  if (!outfit) return notFound();
  const bytes = kind === "cover" ? await coverJpeg(outfit) : await cardJpeg(outfit);
  if (!bytes) return notFound();
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/jpeg", "Cache-Control": CACHE } });
}
