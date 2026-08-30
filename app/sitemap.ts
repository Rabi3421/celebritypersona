import type { MetadataRoute } from "next";
import { getCelebrities, getOccasions, getOutfits } from "@/lib/db/content";
import { celebritySlug, occasionSlug, outfitSlug } from "@/lib/slugs";
import { site } from "@/lib/site-config";
import { hasSubstance } from "@/lib/types";

/** Browsable pages that are not driven by a record. */
const STATIC = [
  ["", 1],
  ["/outfits", 0.9],
  ["/celebrities", 0.9],
  ["/occasions", 0.9],
  ["/budget", 0.8],
  ["/trending", 0.8],
  ["/how-we-work", 0.6],
  ["/about", 0.5],
  ["/corrections", 0.5],
  ["/report-a-price", 0.5],
  ["/contact", 0.4],
  ["/photo-credits", 0.3],
  ["/affiliate-disclosure", 0.3],
  ["/privacy", 0.2],
  ["/terms", 0.2],
  ["/cookies", 0.2],
  ["/dmca", 0.2],
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [outfits, celebrities, occasions] = await Promise.all([
    getOutfits(),
    getCelebrities(),
    getOccasions(),
  ]);

  const now = new Date();

  return [
    ...STATIC.map(([path, priority]) => ({
      url: `${site.url}${path}`,
      lastModified: now,
      priority,
    })),
    // A look carrying robots noindex has no business being submitted for
    // indexing: the sitemap would be asking for exactly what the page refuses.
    ...outfits.filter(hasSubstance).map((outfit) => ({
      url: `${site.url}/outfits/${outfitSlug(outfit)}`,
      lastModified: new Date(`${outfit.pricesCheckedAt ?? outfit.date}T00:00:00`),
      priority: 0.8,
    })),
    ...celebrities.map((celebrity) => ({
      url: `${site.url}/celebrities/${celebritySlug(celebrity)}`,
      lastModified: now,
      priority: 0.7,
    })),
    ...occasions.map((occasion) => ({
      url: `${site.url}/occasions/${occasionSlug(occasion)}`,
      lastModified: now,
      priority: 0.7,
    })),
  ];
}
