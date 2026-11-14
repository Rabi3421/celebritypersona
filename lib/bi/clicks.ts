/**
 * Production shop clicks for the Overview, from `linkClicks` — the server-side
 * record the /go redirect writes for every non-bot click on a Buy button.
 *
 * The same rules as the daily report (lib/report/click-summary.ts):
 *  - only `env: "production"` counts; clicks recorded before environments
 *    were tagged are "unclassified" and never added to production totals;
 *    preview and local clicks are excluded and shown as such;
 *  - a click is a visit to a retailer, not a purchase, and `affiliate` says
 *    only whether the URL was monetised — never revenue.
 * Days are IST calendar days. One aggregation per page load, over the current
 * and previous period only.
 */

import { daysOf, type Period } from "@/lib/bi/period";

export const TOP_N = 8;
const ROW_CAP = 5000;

export type ClickTotals = { total: number; original: number; swap: number; other: number; affiliate: number; direct: number };
const zero = (): ClickTotals => ({ total: 0, original: 0, swap: 0, other: 0, affiliate: 0, direct: 0 });

/** The aggregation: one pass, grouped four ways. `at` is an ISO string. */
export function clicksPipeline(period: Period) {
  const fromIso = new Date(period.previous.startMs).toISOString();
  const toIso = new Date(period.endMs).toISOString();
  const current = { day: { $gte: period.from }, env: "production" };
  return [
    { $match: { at: { $gte: fromIso, $lt: toIso } } },
    { $addFields: { day: { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$at" }, timezone: "Asia/Kolkata" } } } },
    {
      $facet: {
        days: [{ $group: { _id: { day: "$day", env: "$env", side: "$side", affiliate: "$affiliate" }, clicks: { $sum: 1 } } }, { $limit: ROW_CAP }],
        outfits: [{ $match: current }, { $group: { _id: { id: "$outfitId", slug: "$outfitSlug" }, clicks: { $sum: 1 } } }, { $sort: { clicks: -1, "_id.id": 1 } }, { $limit: TOP_N }],
        retailers: [{ $match: current }, { $group: { _id: "$retailer", clicks: { $sum: 1 } } }, { $sort: { clicks: -1, _id: 1 } }, { $limit: TOP_N }],
        pieces: [{ $match: current }, { $group: { _id: { id: "$outfitId", piece: "$piece", side: "$side" }, clicks: { $sum: 1 } } }, { $sort: { clicks: -1, "_id.piece": 1 } }, { $limit: TOP_N }],
      },
    },
  ];
}

type Facets = {
  days: { _id: { day: string; env?: unknown; side?: unknown; affiliate?: unknown }; clicks: number }[];
  outfits: { _id: { id?: unknown; slug?: unknown }; clicks: number }[];
  retailers: { _id: unknown; clicks: number }[];
  pieces: { _id: { id?: unknown; piece?: unknown; side?: unknown }; clicks: number }[];
};

export type ClickSummary = ReturnType<typeof summariseClicks>;

/** `since` / `lastDay`: the first and newest IST day with a production-tagged click. */
export function summariseClicks(facets: Facets | undefined, period: Period, since: string | null, lastDay: string | null = null) {
  const f: Facets = facets ?? { days: [], outfits: [], retailers: [], pieces: [] };
  const current = zero();
  const previous = zero();
  const daily = new Map(daysOf(period).map((d) => [d, zero()]));
  const excluded = { unclassified: 0, preview: 0, local: 0 };
  for (const row of f.days) {
    const { day, env, side, affiliate } = row._id;
    const inCurrent = day >= period.from && day <= period.to;
    if (env !== "production") {
      if (!inCurrent) continue;
      if (env === "preview") excluded.preview += row.clicks;
      else if (env === "development" || env === "local") excluded.local += row.clicks;
      else excluded.unclassified += row.clicks;
      continue;
    }
    const add = (t: ClickTotals) => {
      t.total += row.clicks;
      if (side === "original") t.original += row.clicks;
      else if (side === "swap") t.swap += row.clicks;
      else t.other += row.clicks;
      if (affiliate === true) t.affiliate += row.clicks;
      else t.direct += row.clicks;
    };
    if (inCurrent) {
      add(current);
      const d = daily.get(day);
      if (d) add(d);
    } else if (day >= period.previous.from && day <= period.previous.to) add(previous);
  }
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    current,
    previous,
    daily: [...daily.entries()].map(([day, t]) => ({ day, ...t })),
    excluded,
    since,
    lastDay,
    topOutfits: f.outfits.map((r) => ({ id: num(r._id.id), slug: str(r._id.slug), clicks: r.clicks })),
    retailers: f.retailers.map((r) => ({ name: str(r._id) || "Unknown", clicks: r.clicks })),
    pieces: f.pieces.map((r) => ({ outfitId: num(r._id.id), piece: str(r._id.piece) || "Unknown piece", side: str(r._id.side), clicks: r.clicks })),
  };
}
