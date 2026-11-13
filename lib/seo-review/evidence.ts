/**
 * Keyword demand evidence: what an editor found, where, when, and for which
 * market — never a number this code made up.
 *
 * Each item is one observation copied from a source a person can re-check.
 * Nothing here estimates search volume, difficulty, ranking chances or
 * traffic, and nothing adds observations from different sources together:
 * a Keyword Planner range, a Trends index and a count of Bing impressions are
 * different things and stay side by side.
 *
 * "No evidence" is its own state and is never shown as zero. A recorded 0
 * (say, 0 impressions in Search Console) is real evidence and is shown as 0.
 *
 * Pure: no I/O, no clock (the caller passes today's date).
 */

export const EVIDENCE_SOURCES = [
  "search-console",
  "keyword-planner",
  "google-trends",
  "bing-webmaster",
  "reader-requests",
  "other",
] as const;
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];

export type Confidence = "high" | "medium" | "low";

type Metric = "impressions" | "monthly-range" | "relative-interest" | "count" | "value";

/** What each source can tell us, and the most it can be trusted for Google demand. */
export const SOURCE_INFO: Record<
  EvidenceSource,
  { label: string; metric: Metric; unit: string; base: Confidence; caveat: string; example: string }
> = {
  "search-console": {
    label: "Google Search Console (our site)",
    metric: "impressions",
    unit: "impressions",
    base: "high",
    caveat: "Measured on our own pages. Rare queries are hidden by Google for privacy, so this is a floor, not a total.",
    example: "64",
  },
  "keyword-planner": {
    label: "Google Keyword Planner",
    metric: "monthly-range",
    unit: "average monthly searches (range)",
    base: "medium",
    caveat: "Google's own range of average monthly searches. Ranges are broad, especially for accounts without ad spend.",
    example: "100–1K",
  },
  "google-trends": {
    label: "Google Trends",
    metric: "relative-interest",
    unit: "relative interest, 0–100",
    base: "low",
    caveat: "Interest relative to the peak in the chosen period. It says whether interest rose or fell — never how many searches.",
    example: "37",
  },
  "bing-webmaster": {
    label: "Bing Webmaster keyword research",
    metric: "impressions",
    unit: "Bing impressions",
    base: "low",
    caveat: "Bing searches, not Google. A relative signal only; Bing's share in India is small.",
    example: "120",
  },
  "reader-requests": {
    label: "Reader requests on our site",
    metric: "count",
    unit: "requests",
    base: "low",
    caveat: "What our readers asked us to decode. Interest from our audience, not search demand.",
    example: "3",
  },
  other: {
    label: "Other verifiable source",
    metric: "value",
    unit: "as recorded",
    base: "low",
    caveat: "Must link to where it can be re-checked. Treated as weak evidence.",
    example: "see link",
  },
};

export type Evidence = {
  id: string;
  source: EvidenceSource;
  /** Exactly as the source showed it: "100–1K", "64", "37". */
  value: string;
  /** The window the value covers: "last 28 days", "last 12 months". */
  period: string;
  /** Two-letter country code, or "GLOBAL". */
  market: string;
  /** The day it was looked up, YYYY-MM-DD. */
  collectedAt: string;
  /** Where it can be re-checked. Required for "other". https only. */
  url?: string;
  note?: string;
};

/** The market this site writes for. Evidence for another market counts for less. */
export const TARGET_MARKET = "IN";
/** Demand moves: evidence older than this is marked stale. */
export const STALE_DAYS = 180;

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const isDay = (value: string) => {
  const m = DAY.exec(value);
  if (!m) return false;
  const at = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return at.getUTCFullYear() === +m[1] && at.getUTCMonth() === +m[2] - 1 && at.getUTCDate() === +m[3];
};
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

const MULTIPLIER: Record<string, number> = { "": 1, k: 1_000, m: 1_000_000 };
const RANGE_PART = /^(\d[\d,]*(?:\.\d+)?)\s*([kKmM]?)$/;
const parsePart = (part: string) => {
  const m = RANGE_PART.exec(part.trim());
  return m ? Number(m[1].replace(/,/g, "")) * MULTIPLIER[m[2].toLowerCase()] : null;
};

/** "100–1K" → { low: 100, high: 1000 }, or null. Keyword Planner's own format. */
export function parseRange(value: string): { low: number; high: number } | null {
  const parts = value.split(/\s*[–—-]\s*|\s+to\s+/i);
  if (parts.length !== 2) return null;
  const [low, high] = parts.map(parsePart);
  return low !== null && high !== null && low <= high ? { low, high } : null;
}

const WHOLE = /^\d[\d,]*$/;

/** Problems with one evidence item, as plain sentences; empty when it is fine. */
export function evidenceProblems(item: Partial<Evidence>, today: string): string[] {
  const problems: string[] = [];
  const info = item.source && (EVIDENCE_SOURCES as readonly string[]).includes(item.source) ? SOURCE_INFO[item.source] : null;
  if (!info) return ["Choose where this came from."];
  const value = (item.value ?? "").trim();
  if (!value) problems.push(`Enter the ${info.unit} exactly as ${info.label} showed it.`);
  else if (info.metric === "monthly-range" && !parseRange(value)) problems.push('Enter the range as shown, e.g. "100–1K" or "1K–10K".');
  else if ((info.metric === "impressions" || info.metric === "count") && !WHOLE.test(value)) problems.push("Enter a whole number.");
  else if (info.metric === "relative-interest" && !(WHOLE.test(value) && Number(value) <= 100)) problems.push("Trends interest is a whole number from 0 to 100.");
  if (!(item.period ?? "").trim()) problems.push('Say which period it covers, e.g. "last 12 months".');
  const market = (item.market ?? "").trim().toUpperCase();
  if (!/^([A-Z]{2}|GLOBAL)$/.test(market)) problems.push('Market is a two-letter country code (IN) or "GLOBAL".');
  const collected = item.collectedAt ?? "";
  if (!isDay(collected)) problems.push("Enter the day you looked it up.");
  else if (collected > today) problems.push("The lookup date is in the future.");
  else if (collected < "2000-01-01") problems.push("The lookup date is not plausible.");
  if (item.url) {
    let ok = false;
    try {
      ok = new URL(item.url).protocol === "https:";
    } catch {}
    if (!ok) problems.push("The link must be a full https:// address.");
  } else if (item.source === "other") problems.push("Link to where this can be re-checked.");
  return problems;
}

const LOWER: Record<Confidence, Confidence> = { high: "medium", medium: "low", low: "low" };

/** How far this one observation can be trusted for Google search demand in India, and why. */
export function confidenceOf(item: Evidence, today: string): { level: Confidence; reasons: string[] } {
  const info = SOURCE_INFO[item.source];
  let level = info.base;
  const reasons = [info.caveat];
  const age = isDay(item.collectedAt) ? daysBetween(item.collectedAt, today) : Infinity;
  if (age > STALE_DAYS) {
    level = LOWER[level];
    reasons.push(`Looked up ${age} days ago; demand may have moved since.`);
  }
  if (item.market.toUpperCase() !== TARGET_MARKET) {
    level = LOWER[level];
    reasons.push(`For ${item.market.toUpperCase()}, not India.`);
  }
  return { level, reasons };
}

/** "100–1K average monthly searches (range)" — the value with its unit, never converted. */
export const describeValue = (item: Evidence) => `${item.value.trim()} ${SOURCE_INFO[item.source].unit}`;

const RANK: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };

export type DemandSummary =
  | { status: "none"; statement: string }
  | { status: "evidence"; strongest: Confidence; count: number; statement: string; items: (Evidence & { confidence: Confidence; reasons: string[] })[] };

/**
 * What is known about demand for one keyword. With nothing recorded it says
 * so; with something recorded it lists it, strongest first. It never sums,
 * averages or converts.
 */
export function demandSummary(evidence: Evidence[] | undefined, today: string): DemandSummary {
  const valid = (evidence ?? []).filter((item) => evidenceProblems(item, today).length === 0);
  if (!valid.length) {
    return { status: "none", statement: "No demand evidence recorded. Unknown — not zero." };
  }
  const items = valid
    .map((item) => ({ ...item, ...confidenceOf(item, today) }))
    .map(({ level, ...rest }) => ({ ...rest, confidence: level }))
    .sort((a, b) => RANK[b.confidence] - RANK[a.confidence] || b.collectedAt.localeCompare(a.collectedAt));
  const top = items[0];
  return {
    status: "evidence",
    strongest: top.confidence,
    count: items.length,
    statement: `${items.length} ${items.length === 1 ? "observation" : "observations"} · strongest ${top.confidence}: ${SOURCE_INFO[top.source].label}, ${describeValue(top)}, ${top.period}, ${top.market.toUpperCase()}, looked up ${top.collectedAt}`,
    items,
  };
}
