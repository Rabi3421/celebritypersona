/**
 * The Overview's daily CSV: one row per IST day, aggregates only — no look,
 * piece, visitor, email or click identifier. A day before a source has any
 * data is left blank rather than written as zero.
 */

import type { ClickSummary } from "@/lib/bi/clicks";
import type { Period } from "@/lib/bi/period";
import { daysOf } from "@/lib/bi/period";
import type { TrafficSummary } from "@/lib/bi/traffic";

export const CSV_COLUMNS = [
  "day_ist",
  "production_shop_clicks",
  "clicks_to_original",
  "clicks_to_swap",
  "clicks_monetised",
  "consenting_browser_pageviews",
  "consenting_browser_outfit_views",
  "consenting_browsers",
] as const;

export function overviewCsv(period: Period, clicks: ClickSummary | null, traffic: TrafficSummary) {
  const clickDay = new Map((clicks?.daily ?? []).map((d) => [d.day, d]));
  const tv = traffic.status === "ok" ? traffic : null;
  const trafficDay = new Map((tv?.daily ?? []).map((d) => [d.day, d]));
  const rows = daysOf(period).map((day) => {
    const c = clicks && clicks.since && day >= clicks.since ? clickDay.get(day) : undefined;
    const t = tv && tv.since && day >= tv.since ? trafficDay.get(day) : undefined;
    return [day, c?.total, c?.original, c?.swap, c?.affiliate, t?.pageviews, t?.outfitViews, t?.browsers].map((v) => (v === undefined ? "" : String(v))).join(",");
  });
  return [CSV_COLUMNS.join(","), ...rows].join("\r\n") + "\r\n";
}
