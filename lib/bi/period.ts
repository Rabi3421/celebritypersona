/**
 * Dashboard periods and comparisons, in India Standard Time.
 *
 * Every figure on the Overview is for a calendar period in Asia/Kolkata (IST,
 * always UTC+05:30 — India has no daylight saving). The rules:
 *
 *  - "7 days" and "28 days" are the last 7 / 28 *complete* IST days, ending
 *    yesterday, so a comparison never sets a part-day against whole days.
 *  - "Today" is today so far. It is never compared as if it were a full day.
 *  - A comparison is shown only when both periods are complete and the earlier
 *    one is wholly covered by the source's data. With small counts it is a
 *    difference ("+3"), never a percentage ("+300%").
 *
 * No imports, so it can be tested on its own.
 */

export const TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
export const MAX_CUSTOM_DAYS = 92;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export type RangeKey = "today" | "yesterday" | "7d" | "28d" | "custom";
export type Span = { from: string; to: string; startMs: number; endMs: number; days: number };
export type Period = Span & {
  key: RangeKey;
  label: string;
  /** False only for a period that includes today. */
  complete: boolean;
  /** The equal-length period immediately before. */
  previous: Span;
  /** Why a requested custom range was not used, if it was not. */
  notice?: string;
};

/** The IST calendar day of an instant, YYYY-MM-DD. */
export const istDay = (ms: number) => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
/** UTC milliseconds at 00:00 IST on a day. */
export const istStart = (day: string) => Date.parse(`${day}T00:00:00Z`) - IST_OFFSET_MS;
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

const span = (from: string, to: string): Span => ({
  from,
  to,
  startMs: istStart(from),
  endMs: istStart(to) + DAY_MS,
  days: Math.round((istStart(to) - istStart(from)) / DAY_MS) + 1,
});

const valid = (day: unknown): day is string => typeof day === "string" && DAY.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) && new Date(`${day}T00:00:00Z`).toISOString().startsWith(day);

const fmt = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export function resolvePeriod(input: { range?: string; from?: string; to?: string }, now: number): Period {
  const today = istDay(now);
  const yesterday = addDays(today, -1);
  const make = (key: RangeKey, label: string, from: string, to: string, notice?: string): Period => {
    const current = span(from, to);
    return { ...current, key, label, complete: to < today, previous: span(addDays(from, -current.days), addDays(from, -1)), ...(notice ? { notice } : {}) };
  };
  switch (input.range) {
    case "today":
      return make("today", "Today so far", today, today);
    case "yesterday":
      return make("yesterday", "Yesterday", yesterday, yesterday);
    case "7d":
      return make("7d", "Last 7 complete days", addDays(today, -7), yesterday);
    case "custom": {
      const { from, to } = input;
      let problem: string | undefined;
      if (!valid(from) || !valid(to)) problem = "Pick both dates.";
      else if (from > to) problem = "The start date is after the end date.";
      else if (to > today) problem = "The end date is in the future.";
      else if (span(from, to).days > MAX_CUSTOM_DAYS) problem = `Choose ${MAX_CUSTOM_DAYS} days or fewer.`;
      if (!problem) return make("custom", "Custom range", from!, to!);
      return make("28d", "Last 28 complete days", addDays(today, -28), yesterday, `Custom range not used: ${problem} Showing the last 28 complete days.`);
    }
    default:
      return make("28d", "Last 28 complete days", addDays(today, -28), yesterday);
  }
}

/** Every IST day in a span, in order. */
export function daysOf(s: Pick<Span, "from" | "days">): string[] {
  return Array.from({ length: s.days }, (_, i) => addDays(s.from, i));
}

export type Comparison =
  | { kind: "none"; text: string }
  | { kind: "change"; delta: number; pct: number | null; text: string; direction: "up" | "down" | "flat" };

/** Below this, a change is reported as a difference, not a percentage. */
export const SMALL_BASE = 20;

/**
 * Current against the previous equal period, or a plain reason there is none.
 * `dataSince` is the first day the source has data for; a previous period that
 * starts earlier is not a fair comparison (it would read as growth from zero).
 */
export function compare(current: number | null, previous: number | null, period: Period, dataSince: string | null): Comparison {
  if (current === null || previous === null) return { kind: "none", text: "No comparison: data unavailable" };
  if (!period.complete) return { kind: "none", text: "In progress — no comparison" };
  if (!dataSince || period.previous.from < dataSince) return { kind: "none", text: dataSince ? `No comparison: data starts ${fmt(dataSince)}` : "No comparison: no data yet" };
  const delta = current - previous;
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const span = period.days === 1 ? "the day before" : `the previous ${period.days} days`;
  if (delta === 0) return { kind: "change", delta, pct: null, direction, text: `Same as ${span}` };
  const signed = `${delta > 0 ? "+" : "−"}${Math.abs(delta).toLocaleString("en-IN")}`;
  if (previous < SMALL_BASE) return { kind: "change", delta, pct: null, direction, text: `${signed} vs ${span}` };
  const pct = Math.round((delta / previous) * 100);
  return { kind: "change", delta, pct, direction, text: `${signed} (${pct > 0 ? "+" : "−"}${Math.abs(pct)}%) vs ${span}` };
}

/** "14 Nov 2026, 11:45 IST" */
export function istStamp(ms: number) {
  return `${new Date(ms).toLocaleString("en-IN", { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })} IST`;
}

/**
 * How much of a period a source has data for, given its first day of data:
 * "none" (show "No data", never 0), "partial" (show the figure, say from when),
 * or "full".
 */
export type Coverage = "none" | "partial" | "full";
export function coverage(period: Pick<Span, "from" | "to">, since: string | null): Coverage {
  if (!since || period.to < since) return "none";
  return period.from < since ? "partial" : "full";
}
