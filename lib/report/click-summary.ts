/**
 * Shop-click totals for the daily production report (the Cloudflare Worker
 * `celebritypersona-monitor` reads them from /api/internal/report/clicks).
 *
 * Pure functions: the route runs one read-only aggregation over `linkClicks`
 * and hands the grouped rows here. No click record leaves the site, only
 * counts. Days are Asia/Kolkata calendar days.
 *
 * Honesty rules, the same as the revenue screen's:
 *  - Only clicks tagged `env: "production"` are production clicks. Clicks from
 *    before the tag existed are "unclassified" and are never added to a
 *    production total; previews and local builds are counted separately.
 *  - Nothing is estimated. An unexpected value is reported as unexpected.
 *
 * No imports, so the tests can load it directly.
 */

export const REPORT_TIME_ZONE = "Asia/Kolkata";
/** India has no daylight saving: IST is always UTC+05:30. */
const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
export const MAX_DAYS = 8;
export const DEFAULT_DAYS = 2;
/** Per-outfit rows returned for the report day. Far above what the site has. */
export const MAX_OUTFITS = 500;

export type SummaryRequest = { date: string; days: number };

/** One row of the route's $group stage. */
export type ClickGroup = {
  day: string | null;
  env: unknown;
  side: unknown;
  affiliate: unknown;
  outfitSlug: unknown;
  clicks: number;
};

export type DayTotals = {
  total: number;
  original: number;
  swap: number;
  /** Side neither "original" nor "swap"; should always be 0. */
  otherSide: number;
  paid: number;
  unpaid: number;
  /** `affiliate` not a boolean; should always be 0. */
  otherPaid: number;
};

export type DaySummary = {
  date: string;
  production: DayTotals;
  /** No `env` (recorded before tagging) or an unrecognised value. Not in production. */
  unclassified: number;
  /** Tagged as another deployment; excluded from production. */
  otherEnvironments: { preview: number; development: number; local: number };
};

export type ClickSummary = {
  version: 1;
  source: "linkClicks";
  timeZone: typeof REPORT_TIME_ZONE;
  generatedAt: string;
  range: { from: string; to: string };
  /** Oldest first; the last one is the requested date. */
  days: DaySummary[];
  /** Production clicks per outfit on the requested date, most clicked first. */
  outfits: { date: string; production: { slug: string; clicks: number }[]; truncated: boolean };
  /** Clicks in range whose timestamp could not be read; in no day. */
  unreadableTimestamps: number;
};

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar date, YYYY-MM-DD, or null. */
export function parseDate(value: string | null): string | null {
  const match = DATE.exec(value ?? "");
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  return at.getUTCFullYear() === y && at.getUTCMonth() === m - 1 && at.getUTCDate() === d ? (value as string) : null;
}

export function parseSummaryRequest(params: URLSearchParams): { ok: true; value: SummaryRequest } | { ok: false; error: string } {
  const date = parseDate(params.get("date"));
  if (!date) return { ok: false, error: "date must be YYYY-MM-DD" };
  const rawDays = params.get("days");
  const days = rawDays === null ? DEFAULT_DAYS : Number(rawDays);
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) return { ok: false, error: `days must be an integer from 1 to ${MAX_DAYS}` };
  return { ok: true, value: { date, days } };
}

/** The UTC instant at which an IST calendar day begins. */
export function istDayStart(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) - IST_OFFSET_MS;
}

/** The IST calendar date `offset` days from `date`. */
export function addDays(date: string, offset: number): string {
  return new Date(istDayStart(date) + IST_OFFSET_MS + offset * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The half-open UTC range [from, to) covering `days` IST days ending with
 * `date`, as ISO strings. `at` is stored by toISOString(), so plain string
 * comparison on it is chronological.
 */
export function summaryRange({ date, days }: SummaryRequest) {
  const dates = Array.from({ length: days }, (_, i) => addDays(date, i - days + 1));
  return {
    dates,
    from: new Date(istDayStart(dates[0])).toISOString(),
    to: new Date(istDayStart(date) + DAY_MS).toISOString(),
  };
}

const emptyTotals = (): DayTotals => ({ total: 0, original: 0, swap: 0, otherSide: 0, paid: 0, unpaid: 0, otherPaid: 0 });

export function summariseClicks(groups: ClickGroup[], request: SummaryRequest, generatedAt: string): ClickSummary {
  const { dates, from, to } = summaryRange(request);
  const byDate = new Map<string, DaySummary>(
    dates.map((date) => [date, { date, production: emptyTotals(), unclassified: 0, otherEnvironments: { preview: 0, development: 0, local: 0 } }]),
  );
  const outfitClicks = new Map<string, number>();
  let unreadableTimestamps = 0;

  for (const group of groups) {
    const clicks = Number.isInteger(group.clicks) && group.clicks > 0 ? group.clicks : 0;
    if (!clicks) continue;
    const day = group.day ? byDate.get(group.day) : undefined;
    if (!day) {
      unreadableTimestamps += clicks;
      continue;
    }
    if (group.env === "preview" || group.env === "development" || group.env === "local") {
      day.otherEnvironments[group.env] += clicks;
      continue;
    }
    if (group.env !== "production") {
      day.unclassified += clicks;
      continue;
    }
    const totals = day.production;
    totals.total += clicks;
    if (group.side === "original") totals.original += clicks;
    else if (group.side === "swap") totals.swap += clicks;
    else totals.otherSide += clicks;
    if (group.affiliate === true) totals.paid += clicks;
    else if (group.affiliate === false) totals.unpaid += clicks;
    else totals.otherPaid += clicks;
    if (day.date === request.date) {
      const slug = typeof group.outfitSlug === "string" && group.outfitSlug ? group.outfitSlug : "(unknown)";
      outfitClicks.set(slug, (outfitClicks.get(slug) ?? 0) + clicks);
    }
  }

  const outfits = [...outfitClicks.entries()]
    .map(([slug, clicks]) => ({ slug, clicks }))
    .sort((a, b) => b.clicks - a.clicks || a.slug.localeCompare(b.slug));

  return {
    version: 1,
    source: "linkClicks",
    timeZone: REPORT_TIME_ZONE,
    generatedAt,
    range: { from, to },
    days: dates.map((date) => byDate.get(date) as DaySummary),
    outfits: { date: request.date, production: outfits.slice(0, MAX_OUTFITS), truncated: outfits.length > MAX_OUTFITS },
    unreadableTimestamps,
  };
}

/**
 * The read-only aggregation the route runs: every click in range, grouped by
 * IST day and the fields the report counts. No $out or $merge: it writes
 * nothing.
 */
export function clickPipeline(range: { from: string; to: string }) {
  return [
    { $match: { at: { $gte: range.from, $lt: range.to } } },
    {
      $group: {
        _id: {
          day: {
            $dateToString: {
              format: "%Y-%m-%d",
              timezone: REPORT_TIME_ZONE,
              date: { $dateFromString: { dateString: "$at", onError: null, onNull: null } },
              onNull: null,
            },
          },
          env: "$env",
          side: "$side",
          affiliate: "$affiliate",
          outfitSlug: "$outfitSlug",
        },
        clicks: { $sum: 1 },
      },
    },
  ];
}
