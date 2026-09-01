import { daysSince } from "@/lib/archive";
import type { CelebrityView, OccasionView } from "@/lib/archive";
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
export const STALE_DAYS = 30;

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
  const needsPrice = outfits.filter((outfit) => !pricing(outfit).allPriced);
  const thin = outfits.filter((outfit) => !hasSubstance(outfit));
  const stale = outfits.filter(
    (outfit) =>
      !outfit.pricesCheckedAt || daysSince(outfit.pricesCheckedAt, now) > STALE_DAYS,
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
      label: `Prices not re-checked in ${STALE_DAYS} days`,
      detail:
        "The public pages print the date they were last verified, so an old date is visible to readers.",
      count: stale.length,
      href: "/admin/outfits?sort=oldest",
      ok: stale.length === 0,
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
