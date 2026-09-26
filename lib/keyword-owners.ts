import { headline } from "@/lib/outfit-seo";
import type { KeywordOwner } from "@/lib/seo-checks";
import { outfitSlug } from "@/lib/slugs";
import { isPublished, type Outfit } from "@/lib/types";

/** Every look that has claimed a primary keyword, for the cannibalisation
 *  check. Drafts included, so the form can warn early; only a published
 *  owner blocks publishing. */
export const keywordOwners = (outfits: Outfit[]): KeywordOwner[] =>
  outfits
    .filter((outfit) => outfit.primaryKeyword?.trim())
    .map((outfit) => ({
      id: outfit.id,
      keyword: outfit.primaryKeyword!,
      title: headline(outfit),
      slug: outfitSlug(outfit),
      published: isPublished(outfit),
    }));
