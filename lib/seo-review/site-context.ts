/**
 * What the review needs to know about the rest of the site, built on the
 * server from data the outfit pages already load: the other looks (for
 * overlap and reused writing) and the celebrity and occasion hubs (for
 * whether the links this look makes lead somewhere indexable).
 *
 * Admin pages only. No reader data, clicks or analytics.
 */

import { headline } from "@/lib/outfit-seo";
import { wordCount } from "@/lib/indexing";
import { outfitSlug } from "@/lib/slugs";
import { isPublished, type Outfit } from "@/lib/types";
import type { HubInfo } from "@/lib/seo-review/audit";
import type { OtherLook } from "@/lib/seo-review/keyword";

export type SeoSiteContext = {
  others: OtherLook[];
  celebrities: HubInfo[];
  occasions: HubInfo[];
  saved?: { slug: string; slugLockedAt?: string; live: boolean; publishedAt?: string };
};

type HubView = { name: string; record?: boolean; stats: { looks: number } };

export function buildSiteContext({
  outfits,
  celebrities,
  occasions,
  self,
}: {
  outfits: Outfit[];
  celebrities: (HubView & { bio?: string[] })[];
  occasions: (HubView & { intro?: string[] })[];
  self?: Outfit;
}): SeoSiteContext {
  const hub = (name: string, looks: number, intro: string[] | undefined, record: boolean | undefined): HubInfo => ({
    name,
    slug: "",
    looks,
    introWords: wordCount(intro ?? []),
    record: record !== false,
  });
  return {
    others: outfits
      .filter((outfit) => outfit.id !== self?.id)
      .map((outfit) => ({
        id: outfit.id,
        slug: outfitSlug(outfit),
        title: headline(outfit),
        celebrity: outfit.celebrity,
        published: isPublished(outfit),
        keywords: [outfit.primaryKeyword, ...(outfit.secondaryKeywords ?? [])].filter((k): k is string => Boolean(k?.trim())),
        notes: (outfit.notes ?? []).join("\n"),
      })),
    celebrities: celebrities.map((c) => hub(c.name, c.stats.looks, c.bio, c.record)),
    occasions: occasions.map((o) => hub(o.name, o.stats.looks, o.intro, o.record)),
    ...(self
      ? { saved: { slug: outfitSlug(self), ...(self.slugLockedAt ? { slugLockedAt: self.slugLockedAt } : {}), live: isPublished(self), ...(self.publishedAt ? { publishedAt: self.publishedAt } : {}) } }
      : {}),
  };
}
