import { isMonetised, pieceLink, pricing, type LinkClick, type Outfit, type PieceSide } from "@/lib/types";

/**
 * What the archive can earn, and what it actually earned attention for.
 *
 * Pure functions over whatever the caller loaded, like everything else that
 * counts here. Nothing in this file estimates money: we do not know a
 * retailer's commission rate, whether a click converted, or whether a
 * conversion was later returned. Clicks are what we can honestly measure, so
 * clicks are what the screen shows — an invented rupee figure on a revenue
 * page would be the same failure as an invented saving on the homepage.
 */

const DAY = 86_400_000;

/** Clicks inside the last `days`, counted from now. */
export const clicksSince = (clicks: LinkClick[], days: number, now = Date.now()) =>
  clicks.filter((click) => {
    const at = Date.parse(click.at);
    return Number.isFinite(at) && now - at <= days * DAY;
  });

export type ClickTally = { name: string; clicks: number; affiliate: number };

function tally(clicks: LinkClick[], key: (click: LinkClick) => string): ClickTally[] {
  const rows = new Map<string, ClickTally>();
  for (const click of clicks) {
    const name = key(click);
    const row = rows.get(name) ?? { name, clicks: 0, affiliate: 0 };
    row.clicks += 1;
    if (click.affiliate) row.affiliate += 1;
    rows.set(name, row);
  }
  return [...rows.values()].sort((a, b) => b.clicks - a.clicks || a.name.localeCompare(b.name));
}

export const byLook = (clicks: LinkClick[]) =>
  tally(clicks, (click) => `${click.outfitSlug}`);

export const byRetailer = (clicks: LinkClick[]) => tally(clicks, (click) => click.retailer);

export const bySide = (clicks: LinkClick[]) =>
  tally(clicks, (click) => (click.side === "original" ? "As worn" : "The swap"));

/**
 * Looks carrying at least one link that is both live and monetised.
 *
 * Both halves matter. A monetised link on a dead product earns nothing, and a
 * live link with no affiliate URL earns nothing either — so this is the only
 * honest answer to "how much of the archive can make money", and it is zero
 * until an affiliate account is approved.
 */
export const earningLooks = (outfits: Outfit[]) =>
  outfits.filter((outfit) =>
    outfit.items.some((item) =>
      (["original", "swap"] as PieceSide[]).some((side) => {
        const link = pieceLink(item, side);
        return isMonetised(link) && (link?.status === "ok" || link?.status === "unverified");
      }),
    ),
  );

export type LinkIssue = {
  outfitId: number;
  slug: string;
  celebrity: string;
  piece: string;
  side: PieceSide;
  retailer: string;
  status: string;
  checkedAt?: string;
  /** An affiliate URL with no network set: it discloses, but reports as
   *  nothing. See `isMonetised`. */
  networkMissing: boolean;
};

/** Every link that wants a person to look at it. */
export function linkIssues(outfits: Outfit[], slugOf: (outfit: Outfit) => string): LinkIssue[] {
  const issues: LinkIssue[] = [];

  for (const outfit of outfits) {
    for (const item of outfit.items) {
      for (const side of ["original", "swap"] as PieceSide[]) {
        const link = pieceLink(item, side);
        if (!link) continue;

        const networkMissing = Boolean(link.affiliateUrl?.trim()) && link.network === "none";
        const wanted = link.status === "pending" || link.status === "dead" || link.status === "unverified";
        if (!wanted && !networkMissing) continue;

        issues.push({
          outfitId: outfit.id,
          slug: slugOf(outfit),
          celebrity: outfit.celebrity,
          piece: item.name,
          side,
          retailer: link.retailer,
          status: link.status,
          checkedAt: link.checkedAt,
          networkMissing,
        });
      }
    }
  }

  // Dead first: it is the only one costing a reader a wasted click.
  const rank = { dead: 0, pending: 1, unverified: 2 } as Record<string, number>;
  return issues.sort(
    (a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || b.outfitId - a.outfitId,
  );
}

/**
 * Published looks with no swap on any piece, newest first.
 *
 * The editorial work queue. A look with no swap is the half of the promise
 * this site makes that it has not kept yet: the original is identified and
 * priced, and there is nothing a reader on a normal salary can do about it.
 */
export const needingSwaps = (outfits: Outfit[]) =>
  outfits
    .filter((outfit) => !pricing(outfit).anySwapped)
    .sort((a, b) => b.date.localeCompare(a.date));
