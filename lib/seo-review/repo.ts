import type { Collection } from "mongodb";
import type { ReviewRepo, SeoReviewDoc } from "@/lib/seo-review/store";

/**
 * The `seoReviews` repository over any collection — production's (through
 * lib/db/seo-reviews.ts) or a disposable test database's. Kept apart from the
 * app's connection module, which connects as soon as it is imported.
 *
 * Writes are conditional on the revision the editor started from, so a save
 * from a stale tab cannot overwrite newer research. A unique index on `key`
 * (see lib/db/seo-reviews.ts) closes the one remaining race: two first saves.
 */
export function reviewRepo(collection: Collection<SeoReviewDoc>): ReviewRepo {
  return {
    get: (key) => collection.findOne({ key }, { projection: { _id: 0 } }),
    async put(doc, expected) {
      if (expected === 0) {
        if (await collection.findOne({ key: doc.key }, { projection: { _id: 1 } })) return "conflict";
        try {
          await collection.insertOne({ ...doc });
          return "ok";
        } catch (error) {
          if ((error as { code?: number }).code === 11000) return "conflict";
          throw error;
        }
      }
      const result = await collection.replaceOne({ key: doc.key, revision: expected }, doc);
      return result.matchedCount === 1 ? "ok" : "conflict";
    },
    async remove(key, expected) {
      const result = await collection.deleteOne({ key, revision: expected });
      return result.deletedCount === 1 ? "ok" : "conflict";
    },
  };
}
