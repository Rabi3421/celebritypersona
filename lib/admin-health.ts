import type { CelebrityView, OccasionView } from "@/lib/archive";
import { needsPriceReview, PRICE_REVIEW_DAYS } from "@/lib/freshness";
import { uncreditedPhotos } from "@/lib/photo-credit";
import {
  hasSubstance,
  outfitPhotos,
  pricing,
  type CelebrityRequest,
  type Outfit,
  type PriceReport,
} from "@/lib/types";

/**
 * What is wrong with the archive right now, in the order it is worth fixing.
 *
 * Every count on the public site is derived from these looks, so a gap here is
 * a gap out there: a look with no swap cannot be bought, one with no photo
 * draws a placeholder, and one with neither a note nor a swap is thin
 * affiliation that stays out of the index. The panel should say so plainly
 * rather than leaving it to be discovered on the live site.
 */

/** After this long, a price on the page is a claim we can no longer stand behind. */
export const STALE_DAYS = PRICE_REVIEW_DAYS;

export type HealthCheck = {
  key: string;
  label: string;
  detail: string;
  count: number;
  /** Where to go and fix it. */
  href: string;
  /** False when it needs attention. */
  ok: boolean;
};

export function archiveHealth({
  outfits,
  celebrities,
  occasions,
  reports,
  requests = [],
  now = new Date(),
}: {
  outfits: Outfit[];
  celebrities: CelebrityView[];
  occasions: OccasionView[];
  reports: PriceReport[];
  requests?: CelebrityRequest[];
  now?: Date;
}): HealthCheck[] {
  const needsSwap = outfits.filter((outfit) => !pricing(outfit).allSwapped);
  const needsPhoto = outfits.filter((outfit) => outfitPhotos(outfit).length === 0);
  const needsCredit = outfits.filter((outfit) => uncreditedPhotos(outfit).length > 0);
  const needsPrice = outfits.filter((outfit) => !pricing(outfit).allPriced);
  const thin = outfits.filter((outfit) => !hasSubstance(outfit));
  const stale = outfits.filter((outfit) => needsPriceReview(outfit.pricesCheckedAt, now));
  const linksPending = outfits.filter((outfit) =>
    outfit.items.some(
      (item) =>
        ((!item.soldOut && Boolean(item.wornBrand || item.worn !== undefined)) && !item.wornUrl) ||
        (Boolean(item.swapBrand || item.swap !== undefined) && !item.swapUrl),
    ),
  );
  const unrecordedPeople = celebrities.filter((celebrity) => !celebrity.record);
  const unrecordedOccasions = occasions.filter((occasion) => !occasion.record);
  const emptyOccasions = occasions.filter(
    (occasion) => occasion.record && occasion.stats.looks === 0,
  );
  const newReports = reports.filter((report) => report.status === "New");
  const newRequests = requests.filter((request) => request.status === "New");

  const checks: HealthCheck[] = [
    {
      key: "reports",
      label: "Reader reports waiting",
      detail:
        newReports.length === 0
          ? "Nothing new in the inbox."
          : "Corrections and swap suggestions nobody has looked at yet.",
      count: newReports.length,
      href: "/admin/reports?status=New",
      ok: newReports.length === 0,
    },
    {
      key: "requests",
      label: "Celebrity requests waiting",
      detail:
        newRequests.length === 0
          ? "Nobody is waiting on a name."
          : "Readers asked for these; the public page promises the most-asked-for get done first.",
      count: newRequests.length,
      href: "/admin/requests?status=New",
      ok: newRequests.length === 0,
    },
    {
      key: "needs-swap",
      label: "Looks with no complete swap",
      detail:
        "These cannot be counted towards a budget tier or offered as buyable, so they are missing from /budget.",
      count: needsSwap.length,
      href: "/admin/outfits?state=needs-swap",
      ok: needsSwap.length === 0,
    },
    {
      key: "thin",
      label: "Looks carrying no swap and no note",
      detail:
        "Nothing a shopper could not get from the brand's own page, so these stay out of the index and the sitemap.",
      count: thin.length,
      href: "/admin/outfits?state=needs-notes",
      ok: thin.length === 0,
    },
    {
      key: "stale",
      label: `Prices due for review (${STALE_DAYS}+ days)`,
      detail:
        "The public pages print the date they were last verified, so an old date is visible to readers.",
      count: stale.length,
      href: "/admin/outfits?state=needs-review&sort=oldest",
      ok: stale.length === 0,
    },
    {
      key: "links",
      label: "Looks with retailer links pending",
      detail:
        "A named or priced original/swap has no live destination. Sold-out originals are excluded.",
      count: linksPending.length,
      href: "/admin/outfits?state=needs-link",
      ok: linksPending.length === 0,
    },
    {
      key: "credits",
      label: "Looks with an uncredited photo",
      detail:
        "Every photograph here was taken by somebody else. An uncredited one captions itself " +
        "“source not yet credited” on the public page, and the look cannot be saved again until " +
        "every photo on it names a source.",
      count: needsCredit.length,
      href: "/admin/outfits?state=needs-credit",
      ok: needsCredit.length === 0,
    },
    {
      key: "photos",
      label: "Looks with no photo",
      detail: "Their cards fall back to a placeholder image everywhere they appear.",
      count: needsPhoto.length,
      href: "/admin/outfits?state=needs-photo",
      ok: needsPhoto.length === 0,
    },
    {
      key: "prices",
      label: "Looks missing a worn price",
      detail:
        "They cannot show a saving, and they are left out of the average the homepage quotes.",
      count: needsPrice.length,
      href: "/admin/outfits?state=needs-price",
      ok: needsPrice.length === 0,
    },
    {
      key: "people",
      label: "Celebrities in outfits with no record",
      detail: "Their profile pages work but carry a generated bio until a record exists.",
      count: unrecordedPeople.length,
      href: "/admin/celebrities?state=no-record",
      ok: unrecordedPeople.length === 0,
    },
    {
      key: "occasions",
      label: "Occasions in outfits with no record",
      detail: "Filed under Everyday, with no description, palette or countdown.",
      count: unrecordedOccasions.length,
      href: "/admin/occasions?state=no-record",
      ok: unrecordedOccasions.length === 0,
    },
    {
      key: "empty-occasions",
      label: "Occasions with nothing filed under them",
      detail:
        "They show “Looks ready 0” on the occasions page until a look uses that exact name.",
      count: emptyOccasions.length,
      href: "/admin/occasions?state=no-looks",
      ok: emptyOccasions.length === 0,
    },
  ];

  // Everything that needs doing first, biggest first; the clean checks follow
  // so the screen still shows what is being watched.
  return checks.sort(
    (a, b) => Number(a.ok) - Number(b.ok) || b.count - a.count || a.label.localeCompare(b.label),
  );
}
