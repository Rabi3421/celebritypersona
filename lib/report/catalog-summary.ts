/**
 * Catalogue and shop-click totals for the weekly growth report (read by the
 * monitoring Worker from /api/internal/report/catalog).
 *
 * Pure. The route loads outfits, click groups and a few counts and hands them
 * here, together with the site's own helpers (isPublished, pieceLink,
 * isBuyable, isMonetised, the slug function), so "live", "link" and "buyable"
 * mean exactly what they mean on the site. Only aggregates and public outfit
 * slugs leave: no reader names, emails, request text, URLs or click records.
 *
 * Definitions (mutually exclusive where it matters):
 *  - Outfit: one look. stored = live + draft + notLiveOther.
 *  - Piece: one garment in a live outfit.
 *  - Product link: one side (original or swap) of one piece that has a link.
 *    Every link has exactly one status: ok, unverified, pending, sold_out, dead.
 *    buyable = ok + unverified (the site shows a Buy button); monetised = has
 *    an affiliate URL. A piece has 0, 1 or 2 product links.
 *
 * No runtime imports, so the tests can load it directly.
 */

import type { Outfit, OutfitItem, PieceLink, PieceSide } from "../types";

export const REPORT_TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
export const DEFAULT_WEEKS = 4;
export const MAX_WEEKS = 8;
export const STALE_CHECK_DAYS = 30;
export const MAX_OUTFIT_ROWS = 500;
const STATUSES = ["ok", "unverified", "pending", "sold_out", "dead"] as const;

// The same IST calendar arithmetic as click-summary.ts (a test checks they agree).
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
export function parseDate(value: string | null): string | null {
  const match = DATE.exec(value ?? "");
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d ? (value as string) : null;
}
export const istDayStart = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) - IST_OFFSET_MS;
};
export const addDays = (date: string, offset: number) =>
  new Date(istDayStart(date) + IST_OFFSET_MS + offset * DAY_MS).toISOString().slice(0, 10);
const isMonday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() === 1;

export type CatalogRequest = { week: string; weeks: number };

/** `week` must be a Monday (the first day of the IST week reported on). */
export function parseCatalogRequest(params: URLSearchParams): { ok: true; value: CatalogRequest } | { ok: false; error: string } {
  const week = parseDate(params.get("week"));
  if (!week || !isMonday(week)) return { ok: false, error: "week must be a Monday, YYYY-MM-DD" };
  const raw = params.get("weeks");
  const weeks = raw === null ? DEFAULT_WEEKS : Number(raw);
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_WEEKS) return { ok: false, error: `weeks must be an integer from 1 to ${MAX_WEEKS}` };
  return { ok: true, value: { week, weeks } };
}

/** Week starts (Mondays), oldest first, ending with the requested week; and the UTC range they cover. */
export function catalogRange({ week, weeks }: CatalogRequest) {
  const starts = Array.from({ length: weeks }, (_, i) => addDays(week, (i - weeks + 1) * 7));
  return { starts, from: new Date(istDayStart(starts[0])).toISOString(), to: new Date(istDayStart(week) + 7 * DAY_MS).toISOString() };
}

export type CatalogHelpers = {
  isPublished: (outfit: Outfit) => boolean;
  pieceLink: (item: OutfitItem, side: PieceSide) => PieceLink | undefined;
  isBuyable: (link: PieceLink | undefined) => boolean;
  isMonetised: (link: PieceLink | undefined) => boolean;
  slugOf: (outfit: Outfit) => string;
};

/** One row of click-summary's clickPipeline: grouped by IST day, env, side, affiliate, outfit. */
export type ClickGroup = { day: string | null; env: unknown; side: unknown; affiliate: unknown; outfitSlug: unknown; clicks: number };

export type CatalogInput = {
  outfits: Outfit[];
  clickGroups: ClickGroup[];
  /** { status: count } for celebrityRequests and priceReports. Text is never loaded. */
  requestsByStatus: Record<string, number>;
  priceReportsByStatus: Record<string, number>;
  activeSubscribers: number;
  activeSubscribersJoinedThisWeek: number;
};

const emptyWeekClicks = () => ({
  production: { total: 0, original: 0, swap: 0, otherSide: 0, paid: 0, unpaid: 0, otherPaid: 0 },
  unclassified: 0,
  otherEnvironments: { preview: 0, development: 0, local: 0 },
});

const sum = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + (Number.isInteger(b) ? b : 0), 0);

export function summariseCatalog(input: CatalogInput, request: CatalogRequest, helpers: CatalogHelpers, generatedAt: string) {
  const { starts, from, to } = catalogRange(request);
  const weekStart = istDayStart(request.week);
  const weekEnd = weekStart + 7 * DAY_MS;
  const last28Start = weekEnd - 28 * DAY_MS;

  // ---- outfits
  const live = input.outfits.filter(helpers.isPublished);
  const draft = input.outfits.filter((o) => o.status === "draft").length;
  const knownDate = (o: Outfit) => (typeof o.publishedAt === "string" && parseDate(o.publishedAt.slice(0, 10)) ? o.publishedAt.slice(0, 10) : null);
  const liveDates = live.map(knownDate).filter((d): d is string => d !== null);
  const inRange = (date: string, start: number, end: number) => istDayStart(date) >= start && istDayStart(date) < end;

  const byOccasion = new Map<string, number>();
  for (const o of live) byOccasion.set(o.occasion || "(none)", (byOccasion.get(o.occasion || "(none)") ?? 0) + 1);

  // ---- pieces and product links (live outfits only, through the site's own pieceLink)
  const pieces = live.flatMap((o) => o.items ?? []);
  const sides: PieceSide[] = ["original", "swap"];
  const links = pieces.flatMap((item) => sides.map((side) => helpers.pieceLink(item, side)).filter((l): l is PieceLink => Boolean(l)));
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<(typeof STATUSES)[number], number>;
  let otherStatus = 0;
  for (const link of links) {
    if ((STATUSES as readonly string[]).includes(link.status)) byStatus[link.status as (typeof STATUSES)[number]] += 1;
    else otherStatus += 1;
  }
  const staleBefore = weekEnd - STALE_CHECK_DAYS * DAY_MS;
  const checkedAt = (l: PieceLink) => (l.checkedAt ? Date.parse(l.checkedAt) : NaN);

  // ---- production clicks, bucketed into IST weeks
  const weekIndex = new Map(starts.map((s, i) => [s, i]));
  const weekOf = (day: string) => {
    const offset = Math.floor((istDayStart(day) - istDayStart(starts[0])) / DAY_MS / 7);
    return offset >= 0 && offset < starts.length ? starts[offset] : null;
  };
  const weeksOut = starts.map((start) => ({ start, ...emptyWeekClicks() }));
  const outfitWeek = new Map<string, number>();
  const outfit28 = new Map<string, number>();
  let unreadable = 0;
  for (const g of input.clickGroups) {
    const clicks = Number.isInteger(g.clicks) && g.clicks > 0 ? g.clicks : 0;
    if (!clicks) continue;
    const start = g.day ? weekOf(g.day) : null;
    if (!start || !g.day) {
      unreadable += clicks;
      continue;
    }
    const bucket = weeksOut[weekIndex.get(start) as number];
    if (g.env === "preview" || g.env === "development" || g.env === "local") {
      bucket.otherEnvironments[g.env] += clicks;
      continue;
    }
    if (g.env !== "production") {
      bucket.unclassified += clicks;
      continue;
    }
    const p = bucket.production;
    p.total += clicks;
    if (g.side === "original") p.original += clicks;
    else if (g.side === "swap") p.swap += clicks;
    else p.otherSide += clicks;
    if (g.affiliate === true) p.paid += clicks;
    else if (g.affiliate === false) p.unpaid += clicks;
    else p.otherPaid += clicks;
    const slug = typeof g.outfitSlug === "string" && g.outfitSlug ? g.outfitSlug : "(unknown)";
    if (start === request.week) outfitWeek.set(slug, (outfitWeek.get(slug) ?? 0) + clicks);
    if (istDayStart(g.day) >= last28Start) outfit28.set(slug, (outfit28.get(slug) ?? 0) + clicks);
  }
  const ranked = (m: Map<string, number>) =>
    [...m.entries()].map(([slug, clicks]) => ({ slug, clicks })).sort((a, b) => b.clicks - a.clicks || a.slug.localeCompare(b.slug)).slice(0, MAX_OUTFIT_ROWS);

  return {
    version: 1 as const,
    source: "catalog" as const,
    timeZone: REPORT_TIME_ZONE,
    generatedAt,
    week: { start: request.week, end: addDays(request.week, 6) },
    range: { from, to },
    catalog: {
      outfits: { stored: input.outfits.length, live: live.length, draft, notLiveOther: input.outfits.length - live.length - draft },
      publishDates: {
        liveKnown: liveDates.length,
        liveUnknown: live.length - liveDates.length,
        publishedThisWeek: liveDates.filter((d) => inRange(d, weekStart, weekEnd)).length,
        publishedLast28Days: liveDates.filter((d) => inRange(d, last28Start, weekEnd)).length,
        latestKnown: liveDates.length ? liveDates.sort().at(-1) ?? null : null,
      },
      liveCelebrities: new Set(live.map((o) => o.celebrity)).size,
      liveByOccasion: [...byOccasion.entries()].map(([occasion, outfits]) => ({ occasion, outfits })).sort((a, b) => b.outfits - a.outfits || a.occasion.localeCompare(b.occasion)),
      pieces: {
        total: pieces.length,
        withOriginalLink: pieces.filter((i) => helpers.pieceLink(i, "original")).length,
        withSwapLink: pieces.filter((i) => helpers.pieceLink(i, "swap")).length,
        withNoLink: pieces.filter((i) => sides.every((s) => !helpers.pieceLink(i, s))).length,
      },
      productLinks: {
        total: links.length,
        byStatus,
        otherStatus,
        buyable: links.filter((l) => helpers.isBuyable(l)).length,
        monetised: links.filter((l) => helpers.isMonetised(l)).length,
        neverChecked: links.filter((l) => !Number.isFinite(checkedAt(l))).length,
        checkedOver30DaysAgo: links.filter((l) => Number.isFinite(checkedAt(l)) && checkedAt(l) < staleBefore).length,
      },
      // Public slugs only, for "which live looks got no clicks or views".
      liveOutfits: live.map((o) => ({ slug: helpers.slugOf(o), publishedAt: knownDate(o) })).sort((a, b) => a.slug.localeCompare(b.slug)),
    },
    clicks: {
      weeks: weeksOut,
      productionByOutfit: { week: ranked(outfitWeek), last28Days: ranked(outfit28) },
      unreadableTimestamps: unreadable,
    },
    requests: {
      celebrityRequests: { total: sum(input.requestsByStatus), new: input.requestsByStatus.New ?? 0 },
      priceReports: { total: sum(input.priceReportsByStatus), new: input.priceReportsByStatus.New ?? 0 },
    },
    newsletter: { active: input.activeSubscribers, joinedThisWeek: input.activeSubscribersJoinedThisWeek },
  };
}

export type CatalogSummary = ReturnType<typeof summariseCatalog>;
