/**
 * Google's index coverage of the sitemap, summarised for the weekly Slack
 * message: how many pages Google has indexed, what the rest are waiting on,
 * and which looks are not in Google yet. Pure, for tests.
 */

export type CoverageRow = { url: string; coverage: string; lastCrawl: string | null };

export type CoverageSummary = {
  version: 1;
  generatedAt: string;
  total: number;
  indexed: number;
  /** coverage state → count, e.g. "Discovered - currently not indexed": 23 */
  states: Record<string, number>;
  indexedPaths: string[];
  /** Look pages (/outfits/<slug>) Google has not indexed yet. */
  looksWaiting: string[];
  /** Pages whose last crawl failed (4xx/5xx/blocked); they need a recrawl. */
  problems: { path: string; coverage: string; lastCrawl: string | null }[];
  search: { last7: { clicks: number; impressions: number }; prev7: { clicks: number; impressions: number } } | null;
  errors: number;
};

const path = (url: string) => new URL(url).pathname.replace(/\/$/, "") || "/";
const isIndexed = (coverage: string) => coverage === "Submitted and indexed" || coverage === "Indexed, not submitted in sitemap";
const isProblem = (coverage: string) => /blocked|error|4xx|5xx|not found|redirect|soft 404/i.test(coverage);

export function summariseCoverage(
  rows: CoverageRow[],
  search: CoverageSummary["search"],
  errors: number,
  now = new Date(),
): CoverageSummary {
  const states: Record<string, number> = {};
  for (const row of rows) states[row.coverage] = (states[row.coverage] ?? 0) + 1;
  const indexed = rows.filter((row) => isIndexed(row.coverage));
  return {
    version: 1,
    generatedAt: now.toISOString(),
    total: rows.length,
    indexed: indexed.length,
    states,
    indexedPaths: indexed.map((row) => path(row.url)).sort(),
    looksWaiting: rows
      .filter((row) => !isIndexed(row.coverage) && path(row.url).startsWith("/outfits/"))
      .map((row) => path(row.url))
      .sort(),
    problems: rows
      .filter((row) => isProblem(row.coverage))
      .map((row) => ({ path: path(row.url), coverage: row.coverage, lastCrawl: row.lastCrawl })),
    search,
    errors,
  };
}
