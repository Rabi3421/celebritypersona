import type { MetadataRoute } from "next";
import { getCelebrityViews, getOccasionViews, getOutfits } from "@/lib/db/content";
import { celebritySlug, occasionSlug, outfitSlug } from "@/lib/slugs";
import { site } from "@/lib/site-config";
import { hasSubstance } from "@/lib/types";

/**
 * Only URLs this site is asking Google to index.
 *
 * Two rules hold everywhere here, and both used to be broken:
 *
 *  - Every URL is written against the canonical host. They were written
 *    against celebritypersona.com, which 308-redirects to www, so every
 *    entry Google fetched came back as a redirect rather than a page.
 *  - A page that declines to be indexed is not submitted. Outfits already
 *    filtered on `hasSubstance`; the empty celebrity and occasion archives
 *    did not, so fourteen archives holding nothing were being offered for
 *    indexing while their own meta robots refused it.
 */

/** Browsable pages that are not driven by a record. */
const STATIC = [
  ["", 1, "daily"],
  ["/outfits", 0.9, "daily"],
  ["/celebrities", 0.9, "weekly"],
  ["/occasions", 0.9, "weekly"],
  ["/budget", 0.8, "weekly"],
  ["/trending", 0.8, "daily"],
  ["/how-we-work", 0.6, "yearly"],
  ["/about", 0.5, "yearly"],
  ["/corrections", 0.5, "yearly"],
  ["/report-a-price", 0.5, "yearly"],
  ["/contact", 0.4, "yearly"],
  ["/photo-credits", 0.3, "yearly"],
  ["/affiliate-disclosure", 0.3, "yearly"],
  ["/privacy", 0.2, "yearly"],
  ["/terms", 0.2, "yearly"],
  ["/cookies", 0.2, "yearly"],
  ["/dmca", 0.2, "yearly"],
] as const;

/** A YYYY-MM-DD day as a Date, or now when the record carries no usable one. */
const day = (value: string | null | undefined, fallback: Date) => {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [outfits, celebrities, occasions] = await Promise.all([
    getOutfits(),
    getCelebrityViews(),
    getOccasionViews(),
  ]);

  const now = new Date();

  return [
    ...STATIC.map(([path, priority, changeFrequency]) => ({
      url: `${site.url}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
    })),
    ...outfits.filter(hasSubstance).map((outfit) => ({
      url: `${site.url}/outfits/${outfitSlug(outfit)}`,
      lastModified: day(outfit.pricesCheckedAt ?? outfit.date, now),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...celebrities
      .filter((celebrity) => celebrity.stats.looks > 0)
      .map((celebrity) => ({
        url: `${site.url}/celebrities/${celebritySlug(celebrity)}`,
        lastModified: day(celebrity.stats.lastDecoded, now),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ...occasions
      .filter((occasion) => occasion.stats.looks > 0)
      .map((occasion) => ({
        url: `${site.url}/occasions/${occasionSlug(occasion)}`,
        lastModified: day(occasion.stats.lastDecoded, now),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
  ];
}
