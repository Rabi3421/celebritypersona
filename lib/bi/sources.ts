/**
 * Every source the Overview reads, or would read, and its state:
 *  - connected: read on this load, with recent data;
 *  - stale: read on this load, but its newest record is older than expected —
 *    either nobody did the thing it records, or recording has broken;
 *  - error: queried on this load and failed;
 *  - not-connected: no integration exists, so nothing is shown in its place.
 */

import { addDays } from "@/lib/bi/period";
import type { TrafficSummary } from "@/lib/bi/traffic";

export type SourceState = "connected" | "stale" | "error" | "not-connected";
export type Source = { key: string; name: string; provides: string; state: SourceState; detail: string };

/** No production click for this long reads as "check the /go redirect". */
export const CLICKS_STALE_DAYS = 14;
/** No production PostHog event for this long reads as "check the snippet and consent banner". */
export const TRAFFIC_STALE_DAYS = 3;

const fmt = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

export function clickSource(clicks: { ok: boolean; since: string | null; lastDay: string | null }, today: string): Source {
  const base = { key: "clicks", name: "Shop-click log (/go redirect)", provides: "Production shop clicks: look, piece, side, retailer, affiliate flag" };
  if (!clicks.ok) return { ...base, state: "error", detail: "The click aggregation failed on this load." };
  if (!clicks.lastDay) return { ...base, state: "stale", detail: "No production-tagged click recorded yet." };
  const covered = `Recorded server-side, bots filtered by user agent. Production-tagged from ${fmt(clicks.since ?? clicks.lastDay)}; newest ${fmt(clicks.lastDay)}.`;
  if (clicks.lastDay < addDays(today, -CLICKS_STALE_DAYS))
    return { ...base, state: "stale", detail: `${covered} Nothing for over ${CLICKS_STALE_DAYS} days: either no one clicked Buy, or the redirect stopped recording.` };
  return { ...base, state: "connected", detail: covered };
}

export function trafficSource(traffic: TrafficSummary, today: string): Source {
  const base = { key: "posthog", name: "PostHog (consenting browsers)", provides: "Page views, outfit views, browsers, devices, countries, referrers" };
  if (traffic.status === "not-connected") return { ...base, state: "not-connected", detail: traffic.reason };
  if (traffic.status === "error") return { ...base, state: "error", detail: traffic.reason };
  const covered = `Production browsers that accepted analytics only. Cached up to 10 minutes.${traffic.since ? ` Data from ${fmt(traffic.since)}` : ""}${traffic.lastDay ? `; newest ${fmt(traffic.lastDay)}.` : "."}`;
  if (!traffic.lastDay) return { ...base, state: "stale", detail: "Connected, but no production event has been recorded." };
  if (traffic.lastDay < addDays(today, -TRAFFIC_STALE_DAYS))
    return { ...base, state: "stale", detail: `${covered} Nothing for over ${TRAFFIC_STALE_DAYS} days: either no consenting visitors, or tracking stopped.` };
  return { ...base, state: "connected", detail: covered };
}

export function databaseSource(ok: boolean): Source {
  return {
    key: "mongodb",
    name: "MongoDB Atlas",
    provides: "Looks, shop links, subscribers, mail, reader reports",
    state: ok ? "connected" : "error",
    detail: ok ? "Read live on every load." : "Unreachable on this load. Figures from it are missing.",
  };
}

/** Sources that are not integrated. Listed so the gaps are visible, never filled. */
export const UNCONNECTED: Source[] = [
  {
    key: "gsc",
    name: "Google Search Console",
    provides: "Google clicks, impressions, queries, positions, indexing",
    state: "not-connected",
    detail: "No integration exists yet. Needs your approval and a read-only Google credential.",
  },
  {
    key: "monitor",
    name: "Uptime monitor (Cloudflare Worker)",
    provides: "Uptime checks, incidents, daily and weekly reports",
    state: "not-connected",
    detail: "Runs separately and alerts in Slack. Its status endpoint needs a token this site does not hold.",
  },
  {
    key: "vercel",
    name: "Vercel deployments",
    provides: "Deploys, build status",
    state: "not-connected",
    detail: "Not read by the site. Deploy history is in Vercel and GitHub.",
  },
  {
    key: "affiliate",
    name: "Affiliate networks",
    provides: "Orders, commission, revenue",
    state: "not-connected",
    detail: "No affiliate account is linked, so no revenue figure exists anywhere on this dashboard.",
  },
];
