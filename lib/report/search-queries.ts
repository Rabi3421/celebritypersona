/**
 * What Google search already shows the site for, summarised for the Monday
 * Slack message (the "SEO insights" part of the growth plan):
 *
 *   top         the queries with the most impressions over the last 28 days
 *   nearMisses  queries on page 1–2 (position 8–20) with impressions: the
 *               cheapest wins — a better title, an FAQ, a link from a hub
 *   newQueries  searches that showed the site this week and not in the four
 *               weeks before; they often name the next look to publish
 *   drops       pages that lost more than 30% of their clicks week on week
 *   shared      queries two of our own pages both appear for
 *
 * Pure, for tests. Positions are impression-weighted across pages.
 */

export type SearchRow = { keys: string[]; clicks: number; impressions: number; position: number };

export type QueryLine = { query: string; clicks: number; impressions: number; position: number };
export type SearchQueries = {
  top: QueryLine[];
  nearMisses: (QueryLine & { path: string })[];
  newQueries: QueryLine[];
  drops: { path: string; clicks: number; before: number }[];
  shared: { query: string; paths: string[] }[];
};

const path = (url: string) => {
  try {
    return new URL(url).pathname.replace(/\/$/, "") || "/";
  } catch {
    return url;
  }
};
const round = (value: number) => Math.round(value * 10) / 10;

/** Adds rows up by their first key (query or page), position weighted by impressions. */
function byFirstKey(rows: SearchRow[]): Map<string, QueryLine> {
  const totals = new Map<string, { clicks: number; impressions: number; weighted: number }>();
  for (const row of rows) {
    const key = row.keys[0];
    const total = totals.get(key) ?? { clicks: 0, impressions: 0, weighted: 0 };
    total.clicks += row.clicks;
    total.impressions += row.impressions;
    total.weighted += row.position * row.impressions;
    totals.set(key, total);
  }
  const out = new Map<string, QueryLine>();
  for (const [query, t] of totals) {
    out.set(query, { query, clicks: t.clicks, impressions: t.impressions, position: t.impressions ? round(t.weighted / t.impressions) : 0 });
  }
  return out;
}

const mostSeen = (a: QueryLine, b: QueryLine) => b.impressions - a.impressions || b.clicks - a.clicks || a.position - b.position;

export function summariseQueries(input: {
  /** dimensions [query, page], last 28 days */
  queryPages28: SearchRow[];
  /** dimensions [query], last 7 days */
  queries7: SearchRow[];
  /** dimensions [query], the 28 days before those 7 */
  queriesBefore: SearchRow[];
  /** dimensions [page], last 7 days and the 7 before */
  pages7: SearchRow[];
  pagesPrev7: SearchRow[];
}, limit = 5): SearchQueries {
  const queries28 = byFirstKey(input.queryPages28);

  const nearMisses = input.queryPages28
    .filter((row) => row.position >= 8 && row.position <= 20 && row.impressions > 0)
    .map((row) => ({ query: row.keys[0], path: path(row.keys[1]), clicks: row.clicks, impressions: row.impressions, position: round(row.position) }))
    .sort(mostSeen)
    .slice(0, limit);

  const seenBefore = new Set(input.queriesBefore.map((row) => row.keys[0]));
  const newQueries = [...byFirstKey(input.queries7).values()].filter((line) => !seenBefore.has(line.query)).sort(mostSeen).slice(0, limit);

  const before = new Map(input.pagesPrev7.map((row) => [path(row.keys[0]), row.clicks]));
  const now = new Map(input.pages7.map((row) => [path(row.keys[0]), row.clicks]));
  const drops = [...before]
    .filter(([page, clicks]) => clicks >= 5 && (now.get(page) ?? 0) < clicks * 0.7)
    .map(([page, clicks]) => ({ path: page, clicks: now.get(page) ?? 0, before: clicks }))
    .sort((a, b) => b.before - b.clicks - (a.before - a.clicks))
    .slice(0, limit);

  const pagesPerQuery = new Map<string, Set<string>>();
  for (const row of input.queryPages28) {
    if (!row.impressions) continue;
    const set = pagesPerQuery.get(row.keys[0]) ?? new Set<string>();
    set.add(path(row.keys[1]));
    pagesPerQuery.set(row.keys[0], set);
  }
  const shared = [...pagesPerQuery]
    .filter(([, pages]) => pages.size >= 2)
    .map(([query, pages]) => ({ query, paths: [...pages].sort(), impressions: queries28.get(query)?.impressions ?? 0 }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 3)
    .map(({ query, paths }) => ({ query, paths }));

  return { top: [...queries28.values()].sort(mostSeen).slice(0, limit), nearMisses, newQueries, drops, shared };
}
