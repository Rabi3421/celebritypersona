import "server-only";
import { getDb } from "@/lib/mongodb";
import { reviewRepo } from "@/lib/seo-review/repo";
import type { SeoReviewDoc } from "@/lib/seo-review/store";

/**
 * `seoReviews`: keyword research per look (lib/seo-review/store.ts).
 *
 * A new collection; nothing else reads or writes it, and the outfit documents
 * are untouched. MongoDB creates it on the first save. Recommended once,
 * before relying on it — a unique index on `key`, so two first saves of the
 * same look cannot both insert:
 *   db.seoReviews.createIndex({ key: 1 }, { unique: true })
 */
export const SEO_REVIEWS = "seoReviews";

export async function seoReviewRepo() {
  return reviewRepo((await getDb()).collection<SeoReviewDoc>(SEO_REVIEWS));
}
