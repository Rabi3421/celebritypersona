/**
 * Plain-language lines for the top of the Overview — the "30-second read".
 * Each one restates a figure shown below it; nothing here is computed that
 * the page does not also show with its source.
 */

import type { Action } from "@/lib/bi/actions";
import { TOP_N, type ClickSummary } from "@/lib/bi/clicks";
import type { ContentSnapshot } from "@/lib/bi/content";
import { compare, coverage, type Period } from "@/lib/bi/period";

const n = (v: number) => v.toLocaleString("en-IN");
const s = (v: number, one: string, many = `${one}s`) => `${n(v)} ${v === 1 ? one : many}`;

export function briefing(input: { period: Period; clicks: ClickSummary | null; content: ContentSnapshot; actions: Action[] }) {
  const { period, clicks, content, actions } = input;
  let shopping: string;
  if (!clicks) shopping = "Shop clicks could not be read.";
  else if (coverage(period, clicks.since) === "none") shopping = "No shop-click data covers this period.";
  else if (clicks.current.total === 0) shopping = "No production shop clicks.";
  else {
    const looks = clicks.topOutfits.length;
    const across = looks >= TOP_N ? `${TOP_N}+ looks` : s(looks, "look");
    const change = compare(clicks.current.total, clicks.previous.total, period, clicks.since);
    shopping = `${s(clicks.current.total, "production shop click")} across ${across}${change.kind === "change" ? ` (${change.text})` : ""}.`;
  }
  const published = content.publishing.publishedInPeriod.length;
  const publishing = `${published ? s(published, "look") : "No looks"} first published; ${n(content.looks.live)} live in total.`;
  const top = actions.find((a) => a.priority === "high") ?? actions[0];
  return { shopping, publishing, top: top ? top.title : null };
}

/** Facts about a daily series, counting only days the source covers. */
export function dailyFacts(points: { day: string; value: number }[], since: string | null) {
  const covered = points.filter((p) => since && p.day >= since);
  const active = covered.filter((p) => p.value > 0);
  const best = active.reduce<{ day: string; value: number } | null>((b, p) => (!b || p.value > b.value ? p : b), null);
  return { total: covered.reduce((t, p) => t + p.value, 0), coveredDays: covered.length, activeDays: active.length, best };
}
