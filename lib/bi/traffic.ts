/**
 * Site traffic from PostHog, for the Overview — the query and parsing half
 * (no network; the fetch is in lib/bi/posthog.ts).
 *
 * Population: browsers that ACCEPTED analytics on the production site. PostHog
 * loads only after consent, so these are consenting browsers, never "all
 * visitors". Production is decided exactly as the Cloudflare Worker's daily
 * report decides it (celebritypersona-monitor src/posthog.js):
 *   cp_env = 'production', not cp_test, $lib = 'web', $host one of the site's.
 *
 * Every value placed into a query is computed here (whole Unix seconds) or a
 * hostname checked against a strict pattern, so nothing from a request can
 * change a query.
 */

import type { Period } from "@/lib/bi/period";

const HOST = /^[a-z0-9.-]{1,253}$/;
export const BREAKDOWN_LIMIT = 8;

export type TrafficConfig =
  | { ok: true; apiKey: string; projectId: string; host: string; siteHosts: string[] }
  | { ok: false; reason: string };

/**
 * Read from the environment. A personal API key with only the "Query Read"
 * scope (POSTHOG_QUERY_API_KEY) and the project id; never the public project
 * key the browser uses. A plain-http host is allowed only off production, for
 * a local stand-in during tests.
 */
export function trafficConfig(env: Record<string, string | undefined>): TrafficConfig {
  const apiKey = (env.POSTHOG_QUERY_API_KEY ?? "").trim();
  const projectId = (env.POSTHOG_PROJECT_ID ?? "").trim();
  const host = (env.POSTHOG_HOST || "https://us.posthog.com").trim().replace(/\/+$/, "");
  if (!apiKey || !projectId) return { ok: false, reason: "No read-only PostHog key is set for the dashboard (POSTHOG_QUERY_API_KEY and POSTHOG_PROJECT_ID)." };
  if (!/^\d{1,12}$/.test(projectId)) return { ok: false, reason: "POSTHOG_PROJECT_ID is not a project number." };
  let url: URL;
  try {
    url = new URL(host);
  } catch {
    return { ok: false, reason: "POSTHOG_HOST is not a URL." };
  }
  const local = url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname) && env.NODE_ENV !== "production";
  if (url.protocol !== "https:" && !local) return { ok: false, reason: "POSTHOG_HOST must be https." };
  return { ok: true, apiKey, projectId, host, siteHosts: siteHosts(env.NEXT_PUBLIC_SITE_URL) };
}

/** The production hostnames: the site's own, with and without www. */
export function siteHosts(siteUrl: string | undefined): string[] {
  let host = "www.celebritypersona.com";
  try {
    if (siteUrl) host = new URL(siteUrl).hostname.toLowerCase();
  } catch {}
  const bare = host.replace(/^www\./, "");
  return [...new Set([bare, `www.${bare}`])].filter((h) => HOST.test(h));
}

const sqlList = (values: string[]) => values.map((v) => `'${v}'`).join(", ");
const seconds = (ms: number) => Math.floor(ms / 1000);

/** "A browser event from the production site that is not a test" — the Worker's rule. */
export function verifiedBrowser(hosts: string[]) {
  const safe = hosts.filter((h) => HOST.test(h));
  if (!safe.length) throw new Error("No site hostnames to filter on");
  return (
    `(coalesce(toString(properties.cp_env), '') = 'production'` +
    ` AND coalesce(toString(properties.cp_test), '') NOT IN ('true', '1')` +
    ` AND coalesce(toString(properties.$lib), '') = 'web'` +
    ` AND lower(coalesce(toString(properties.$host), '')) IN (${sqlList(safe)}))`
  );
}

const istDayExpr = `toString(toDate(toTimeZone(timestamp, 'Asia/Kolkata')))`;

/** Three queries, run one after another: daily series, period totals (+ first day of data), breakdowns. */
export function trafficQueries(period: Period, hosts: string[]) {
  const v = verifiedBrowser(hosts);
  const prev = seconds(period.previous.startMs);
  const cur = seconds(period.startMs);
  const end = seconds(period.endMs);
  return {
    daily: `SELECT ${istDayExpr} AS day,
  countIf(event = '$pageview') AS pageviews,
  countIf(event = 'outfit_view') AS outfit_views,
  count(DISTINCT if(event = '$pageview', distinct_id, NULL)) AS browsers
FROM events
WHERE event IN ('$pageview', 'outfit_view')
  AND timestamp >= fromUnixTimestamp(${cur}) AND timestamp < fromUnixTimestamp(${end})
  AND ${v}
GROUP BY day ORDER BY day LIMIT 200`,
    // No upper time bound on purpose: events after the period land in 'later',
    // so last_day is the newest production event at all — the freshness check.
    totals: `SELECT multiIf(timestamp >= fromUnixTimestamp(${end}), 'later', timestamp >= fromUnixTimestamp(${cur}), 'current', timestamp >= fromUnixTimestamp(${prev}), 'previous', 'before') AS bucket,
  countIf(event = '$pageview') AS pageviews,
  countIf(event = 'outfit_view') AS outfit_views,
  count(DISTINCT if(event = '$pageview', distinct_id, NULL)) AS browsers,
  toString(toDate(toTimeZone(min(timestamp), 'Asia/Kolkata'))) AS first_day,
  toString(toDate(toTimeZone(max(timestamp), 'Asia/Kolkata'))) AS last_day
FROM events
WHERE event IN ('$pageview', 'outfit_view')
  AND timestamp >= now() - INTERVAL 400 DAY
  AND ${v}
GROUP BY bucket LIMIT 10`,
    breakdowns: (["device", "country", "source", "page", "outfit"] as const)
      .map((dim) => {
        const value = {
          device: `coalesce(nullIf(toString(properties.$device_type), ''), 'Unknown')`,
          country: `coalesce(nullIf(toString(properties.$geoip_country_name), ''), 'Unknown')`,
          source: `multiIf(coalesce(toString(properties.utm_source), '') != '', concat('Campaign: ', lower(toString(properties.utm_source))), coalesce(toString(properties.$referring_domain), '') IN ('', '$direct'), 'Direct or unknown', lower(toString(properties.$referring_domain)))`,
          page: `coalesce(nullIf(toString(properties.$pathname), ''), '/')`,
          outfit: `coalesce(toString(properties.outfit_id), '')`,
        }[dim];
        const event = dim === "outfit" ? "outfit_view" : "$pageview";
        return `SELECT '${dim}' AS dim, ${value} AS value, count() AS n
FROM events
WHERE event = '${event}' AND timestamp >= fromUnixTimestamp(${cur}) AND timestamp < fromUnixTimestamp(${end}) AND ${v}
GROUP BY value ORDER BY n DESC, value ASC LIMIT ${BREAKDOWN_LIMIT}`;
      })
      .join("\nUNION ALL\n"),
  };
}

export type TrafficTotals = { pageviews: number; outfitViews: number; browsers: number };
export type TrafficSummary =
  | {
      status: "ok";
      current: TrafficTotals;
      previous: TrafficTotals;
      since: string | null;
      /** Newest IST day with any production event, for the freshness check. */
      lastDay: string | null;
      daily: { day: string; pageviews: number; outfitViews: number; browsers: number }[];
      breakdowns: Record<"device" | "country" | "source" | "page" | "outfit", { value: string; n: number }[]>;
      fetchedAt: number;
    }
  | { status: "not-connected"; reason: string }
  | { status: "error"; reason: string };

type Rows = unknown[][];
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const s = (v: unknown) => (typeof v === "string" ? v : String(v ?? ""));

/** Query results → summary. Days with no events are zero-filled; nothing else is invented. */
export function parseTraffic(results: { daily: Rows; totals: Rows; breakdowns: Rows }, days: string[], fetchedAt: number): TrafficSummary {
  const byDay = new Map(results.daily.map((r) => [s(r[0]), { pageviews: n(r[1]), outfitViews: n(r[2]), browsers: n(r[3]) }]));
  const bucket = (name: string): TrafficTotals => {
    const row = results.totals.find((r) => r[0] === name);
    return row ? { pageviews: n(row[1]), outfitViews: n(row[2]), browsers: n(row[3]) } : { pageviews: 0, outfitViews: 0, browsers: 0 };
  };
  const isDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d > "1971";
  const firsts = results.totals.map((r) => s(r[4])).filter(isDay).sort();
  const lasts = results.totals.map((r) => s(r[5])).filter(isDay).sort();
  const breakdowns = { device: [], country: [], source: [], page: [], outfit: [] } as Extract<TrafficSummary, { status: "ok" }>["breakdowns"];
  for (const r of results.breakdowns) {
    const dim = s(r[0]) as keyof typeof breakdowns;
    if (dim in breakdowns && s(r[1])) breakdowns[dim].push({ value: s(r[1]).slice(0, 200), n: n(r[2]) });
  }
  return {
    status: "ok",
    current: bucket("current"),
    previous: bucket("previous"),
    since: firsts[0] ?? null,
    lastDay: lasts.at(-1) ?? null,
    daily: days.map((day) => ({ day, ...(byDay.get(day) ?? { pageviews: 0, outfitViews: 0, browsers: 0 }) })),
    breakdowns,
    fetchedAt,
  };
}
