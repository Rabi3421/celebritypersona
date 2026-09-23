import type { MetadataRoute } from "next";
import { getCelebrityViews, getOccasionViews, getPublishedOutfits } from "@/lib/db/content";
import { celebritySlug, occasionSlug, outfitSlug } from "@/lib/slugs";
import { policyUpdated, site } from "@/lib/site-config";
import { hasSubstance, outfitPhotos } from "@/lib/types";
import { isSpecificCredit } from "@/lib/photo-credit";
import type { Outfit } from "@/lib/types";

/**
 * Only URLs this site is asking Google to index.
 *
 * Three rules hold everywhere here, and all three used to be broken:
 *
 *  - Every URL is written against the canonical host. They were written
 *    against celebritypersona.com, which 308-redirects to www, so every
 *    entry Google fetched came back as a redirect rather than a page.
 *  - A page that declines to be indexed is not submitted. Outfits already
 *    filtered on `hasSubstance`; the empty celebrity and occasion archives
 *    did not, so fourteen archives holding nothing were being offered for
 *    indexing while their own meta robots refused it.
 *  - No entry claims a modification date the site cannot show you. Every
 *    static URL carried `new Date()`, which told Google that the privacy
 *    policy, the terms and the DMCA process had all changed the moment the
 *    sitemap was built — and did so again on the next build. A crawler that
 *    is told a page changed and finds it identical learns to stop believing
 *    the file. `lastModified` is now derived or absent:
 *      · the archive hubs take the newest day the archive itself moved,
 *      · the legal documents take the date they publish as their own,
 *      · the editorial pages, which have no version history to read, carry
 *        no date at all rather than an invented one.
 */

/** Pages whose content is the archive, so the archive's own clock is theirs. */
const ARCHIVE_PAGES = [
  ["", 1, "daily"],
  ["/outfits", 0.9, "daily"],
  ["/celebrities", 0.9, "weekly"],
  ["/occasions", 0.9, "weekly"],
  ["/budget", 0.8, "weekly"],
] as const;

/** Pages with nothing datable behind them. Submitted, but undated. */
const EDITORIAL_PAGES = [
  ["/trending", 0.8, "daily"],
  ["/how-we-work", 0.6, "yearly"],
  ["/about", 0.5, "yearly"],
  ["/corrections", 0.5, "yearly"],
  ["/report-a-price", 0.5, "yearly"],
  ["/contact", 0.4, "yearly"],
] as const;

/** The documents that publish their own "last updated" line on the page. */
const LEGAL_PAGES = [
  ["/photo-credits", 0.3],
  ["/affiliate-disclosure", 0.3],
  ["/privacy", 0.2],
  ["/terms", 0.2],
  ["/cookies", 0.2],
  ["/dmca", 0.2],
] as const;

/** A YYYY-MM-DD day as a Date, or nothing when the record carries no usable
 *  one. Returning nothing matters: the caller then omits `lastModified`
 *  rather than substituting today. */
function day(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/** The date the legal pages themselves print, read from the one constant they
 *  all render, so the sitemap and the page can never disagree. */
function legalDay(): Date | undefined {
  const parsed = new Date(`${policyUpdated} 00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * The newest day the archive moved: the latest of every published look and
 * every price re-check. This is the honest answer for the hubs, whose whole
 * content is a view of the archive — they change when it changes and not on
 * any other schedule.
 */
function archiveTouched(outfits: Outfit[]): Date | undefined {
  const days = outfits
    .flatMap((outfit) => [outfit.date, outfit.pricesCheckedAt])
    .map(day)
    .filter((value): value is Date => Boolean(value));
  if (!days.length) return undefined;
  return new Date(Math.max(...days.map((value) => value.getTime())));
}

/**
 * The sitemap had no revalidate of its own, which made it the one public route
 * that genuinely never refreshed: it was generated at build and served
 * unchanged until the next deploy, so a look published on Tuesday was not
 * offered to Google until something else happened to trigger a build.
 *
 * An hour, matching every other archive route. Publishing in the panel
 * revalidates it immediately; `npm run check:links --revalidate` and the other
 * scripts do it through /api/revalidate.
 */
export const revalidate = 3600;

/** The newest of several optional days. */
function latest(...days: (Date | undefined)[]): Date | undefined {
  const real = days.filter((value): value is Date => Boolean(value));
  return real.length ? new Date(Math.max(...real.map((value) => value.getTime()))) : undefined;
}

/** Image entries for the photographs that carry a credit, and no others. */
function images(outfit: Outfit) {
  const credited = outfitPhotos(outfit)
    .filter((photo) => isSpecificCredit(photo.credit))
    .map((photo) => photo.url);
  return credited.length ? { images: credited } : {};
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [outfits, celebrities, occasions] = await Promise.all([
    getPublishedOutfits(),
    getCelebrityViews(),
    getOccasionViews(),
  ]);

  const touched = archiveTouched(outfits);
  const legal = legalDay();

  /** `lastModified` present only when there is a date to put in it. */
  const dated = (value: Date | undefined) => (value ? { lastModified: value } : {});

  return [
    ...ARCHIVE_PAGES.map(([path, priority, changeFrequency]) => ({
      url: `${site.url}${path}`,
      ...dated(touched),
      changeFrequency,
      priority,
    })),
    ...EDITORIAL_PAGES.map(([path, priority, changeFrequency]) => ({
      url: `${site.url}${path}`,
      changeFrequency,
      priority,
    })),
    ...LEGAL_PAGES.map(([path, priority]) => ({
      url: `${site.url}${path}`,
      ...dated(legal),
      changeFrequency: "yearly" as const,
      priority,
    })),
    ...outfits.filter(hasSubstance).map((outfit) => ({
      url: `${site.url}/outfits/${outfitSlug(outfit)}`,
      /**
       * The last day the page actually changed.
       *
       * Deliberately not a link's `checkedAt`: `npm run check:links` runs
       * against every link and confirms most of them are exactly as they
       * were, and announcing that as eleven modified pages is how a crawler
       * learns to stop believing lastmod. `contentChangedAt` is written only
       * when a status actually moves, so an unchanged look keeps its date.
       */
      ...dated(
        latest(day(outfit.contentChangedAt), day(outfit.pricesCheckedAt), day(outfit.date)),
      ),
      changeFrequency: "monthly" as const,
      priority: 0.8,
      /**
       * Only photographs that name a source.
       *
       * Submitting an image to Google Images is asking for it to be indexed
       * and shown beside this site's name. We do not do that with a
       * photograph we cannot say who took — the photo-credits page promises
       * as much, and four of the archive's forty-eight qualify today.
       */
      ...images(outfit),
    })),
    ...celebrities
      .filter((celebrity) => celebrity.stats.looks > 0)
      .map((celebrity) => ({
        url: `${site.url}/celebrities/${celebritySlug(celebrity)}`,
        ...dated(day(celebrity.stats.lastDecoded)),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ...occasions
      .filter((occasion) => occasion.stats.looks > 0)
      .map((occasion) => ({
        url: `${site.url}/occasions/${occasionSlug(occasion)}`,
        ...dated(day(occasion.stats.lastDecoded)),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
  ];
}
