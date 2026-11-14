import "server-only";
import { daysOf, type Period } from "@/lib/bi/period";
import { parseTraffic, trafficConfig, trafficQueries, type TrafficSummary } from "@/lib/bi/traffic";

/**
 * Fetches the Overview's traffic from PostHog's query API, server-side only.
 *
 * - The key is read here and sent only in the Authorization header; it is
 *   never returned, logged or put in an error message.
 * - Three queries per period, one after another (PostHog allows three
 *   concurrent per project), each with a 10-second timeout.
 * - One result per period is kept for ten minutes (a failure for one), so
 *   reloading the page or switching back to a range costs no new queries.
 *   Requests that arrive while a period is being fetched share that fetch.
 *   At most CACHE_MAX periods are kept; the oldest is dropped first.
 */

const TTL_MS = 10 * 60_000;
const ERROR_TTL_MS = 60_000;
const TIMEOUT_MS = 10_000;
const CACHE_MAX = 40;
const cache = new Map<string, { at: number; ttl: number; value: Promise<TrafficSummary> }>();

/** Whether the dashboard has a key at all — known without a network call. */
export function trafficConnection() {
  const config = trafficConfig(process.env);
  return config.ok ? ({ configured: true } as const) : ({ configured: false, reason: config.reason } as const);
}

export function getTraffic(period: Period, now = Date.now()): Promise<TrafficSummary> {
  const config = trafficConfig(process.env);
  if (!config.ok) return Promise.resolve({ status: "not-connected", reason: config.reason });
  const cacheKey = `${period.from}|${period.to}`;
  const hit = cache.get(cacheKey);
  if (hit && now - hit.at < hit.ttl) return hit.value;

  const queries = trafficQueries(period, config.siteHosts);
  const run = async (name: string, sql: string) => {
    const response = await fetch(`${config.host}/api/projects/${config.projectId}/query/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query: sql }, name: `cp-overview-${name}` }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) throw new Error("PostHog refused the dashboard's key.");
    if (response.status === 429) throw new Error("PostHog's query limit was reached; try again in a few minutes.");
    if (!response.ok) throw new Error(`PostHog answered HTTP ${response.status}.`);
    const body = (await response.json()) as { results?: unknown[][] };
    return Array.isArray(body.results) ? body.results : [];
  };

  const value = (async (): Promise<TrafficSummary> => {
    try {
      const daily = await run("daily", queries.daily);
      const totals = await run("totals", queries.totals);
      const breakdowns = await run("breakdowns", queries.breakdowns);
      return parseTraffic({ daily, totals, breakdowns }, daysOf(period), Date.now());
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      const reason = timedOut
        ? "PostHog did not answer within 10 seconds."
        : error instanceof Error && /PostHog|query limit/.test(error.message)
          ? error.message
          : "PostHog could not be reached.";
      return { status: "error", reason };
    }
  })();

  cache.delete(cacheKey);
  cache.set(cacheKey, { at: now, ttl: TTL_MS, value });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
  // A failure is kept for a minute only, so a recovered PostHog shows up soon
  // without a failing one being hammered on every reload.
  void value.then((v) => {
    const entry = cache.get(cacheKey);
    if (v.status !== "ok" && entry?.value === value) entry.ttl = ERROR_TTL_MS;
  });
  return value;
}
