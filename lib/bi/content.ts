/**
 * What the archive holds, for the Overview: looks by state, publishing in a
 * period, search-readiness and shop-link health. Pure — the page passes the
 * outfits in.
 *
 * Definitions match the rest of the site:
 *  - live: not a draft, and priced on at least one side (`isPublished`), the
 *    same test every public page uses;
 *  - held back: saved without draft status but not yet live;
 *  - a link is a stored original or swap link (`pieceLink`), with the status
 *    the link checker or an editor set.
 */

import { addDays, istDay, type Span } from "@/lib/bi/period";
import { outfitSlug } from "@/lib/slugs";
import { REVIEW_WINDOW_DAYS } from "@/lib/thresholds";
import { isPublished, pieceLink, type LinkStatus, type Outfit } from "@/lib/types";

export type LookRef = { id: number; slug: string; name: string; live: boolean };
export type LinkRef = LookRef & { piece: string; side: "original" | "swap"; status: LinkStatus; checkedAt?: string; retailer: string };

const ref = (outfit: Outfit): LookRef => ({ id: outfit.id, slug: outfitSlug(outfit), name: `${outfit.celebrity} · ${outfit.event}`, live: isPublished(outfit) });

export type ContentSnapshot = ReturnType<typeof contentSnapshot>;

export function contentSnapshot(outfits: Outfit[], period: Span, now: number) {
  const live = outfits.filter(isPublished);
  const drafts = outfits.filter((o) => o.status === "draft");
  const heldBack = outfits.filter((o) => o.status !== "draft" && !isPublished(o));

  // Publishing: by first-published day. Looks saved before `publishedAt` existed have no such date.
  const withDate = live.filter((o) => o.publishedAt);
  const publishedInPeriod = withDate
    .filter((o) => o.publishedAt! >= period.from && o.publishedAt! <= period.to)
    .sort((a, b) => b.publishedAt!.localeCompare(a.publishedAt!))
    .map((o) => ({ ...ref(o), publishedAt: o.publishedAt! }));

  // Search readiness (live looks): the editor's own fields, as the SEO checklist reads them.
  const withoutKeyword = live.filter((o) => !o.primaryKeyword?.trim()).map(ref);
  const withoutTitle = live.filter((o) => !o.seoTitle?.trim()).length;
  const withoutDescription = live.filter((o) => !o.seoDescription?.trim()).length;

  // Shop links on every look (drafts included: they go live with whatever they hold).
  const today = istDay(now);
  const staleBefore = addDays(today, -REVIEW_WINDOW_DAYS);
  const links: LinkRef[] = outfits.flatMap((outfit) =>
    outfit.items.flatMap((item) =>
      (["original", "swap"] as const).flatMap((side) => {
        const link = pieceLink(item, side);
        if (!link?.url) return [];
        return [{ ...ref(outfit), piece: item.name, side, status: link.status, ...(link.checkedAt ? { checkedAt: link.checkedAt } : {}), retailer: link.retailer || hostOf(link.url) }];
      }),
    ),
  );
  const count = (rows: LinkRef[]) => {
    const tally = { ok: 0, unverified: 0, pending: 0, sold_out: 0, dead: 0 } as Record<LinkStatus, number>;
    for (const link of rows) tally[link.status] = (tally[link.status] ?? 0) + 1;
    return tally;
  };
  const byStatus = count(links);
  const liveLinks = links.filter((l) => l.live);
  const affiliate = outfits.flatMap((o) => o.items.flatMap((item) => [pieceLink(item, "original"), pieceLink(item, "swap")])).filter((l) => l?.affiliateUrl?.trim()).length;
  const checked = links.filter((l) => l.checkedAt);
  const stale = checked.filter((l) => l.checkedAt! < staleBefore);

  return {
    looks: { total: outfits.length, live: live.length, drafts: drafts.length, heldBack: heldBack.length, pieces: live.reduce((n, o) => n + o.items.length, 0) },
    draftList: drafts.map(ref),
    heldBackList: heldBack.map(ref),
    publishing: { publishedInPeriod, withDate: withDate.length, withoutDate: live.length - withDate.length, last: withDate.map((o) => o.publishedAt!).sort().at(-1) ?? null },
    search: { withoutKeyword, withoutTitle, withoutDescription, live: live.length },
    links: {
      total: links.length,
      byStatus,
      /** Links readers can click today: on live looks only. */
      live: { total: liveLinks.length, byStatus: count(liveLinks) },
      problems: links.filter((l) => l.status === "dead" || l.status === "sold_out"),
      unverified: links.filter((l) => l.status === "unverified" || l.status === "pending"),
      neverChecked: links.filter((l) => !l.checkedAt),
      stale,
      staleDays: REVIEW_WINDOW_DAYS,
      affiliate,
    },
  };
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}
