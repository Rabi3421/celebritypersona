/**
 * One calendar for the whole site, and it is India's.
 *
 * Dates here are stored as bare YYYY-MM-DD days — a look's date, an occasion's
 * next date, the day a price was checked. A bare day has no time and no zone,
 * so every place that turned one into a `Date` picked a zone by accident:
 *
 *   new Date("2026-11-15T00:00:00")   local midnight, wherever the server is
 *   Date.parse("2026-11-15T00:00:00Z") UTC midnight
 *   Math.round((event - Date.now())/DAY)  a fraction of a day, rounded
 *
 * The occasions hub used the second and the occasion page's delivery
 * calculator used the third, so the same event was 46 days away on one page
 * and 47 on the other — and the calculator's answer changed depending on what
 * time of day it was read.
 *
 * Everything below anchors to the calendar day in Asia/Kolkata, because that
 * is where the readers and the festivals are. A day difference computed here
 * is a difference between two calendar days, not between two instants, so it
 * does not drift with the clock.
 */

export const IST = "Asia/Kolkata";

const DAY = 86_400_000;

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today's calendar date in India, as YYYY-MM-DD. */
export function istToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which is the shape everything here stores.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * A YYYY-MM-DD day as a number, for comparing and subtracting.
 *
 * Anchored at UTC midnight — not because the day is a UTC day, but because
 * both sides of every subtraction use the same anchor, so the offset cancels
 * and what is left is a whole number of calendar days.
 */
export function dayValue(day: string | null | undefined): number | null {
  const match = day ? ISO_DAY.exec(day) : null;
  if (!match) return null;
  const [, year, month, date] = match;
  const value = Date.UTC(Number(year), Number(month) - 1, Number(date));
  const back = new Date(value);
  // Rejects 2026-02-31 and friends, which Date.UTC would roll forward.
  return back.getUTCFullYear() === Number(year) &&
    back.getUTCMonth() === Number(month) - 1 &&
    back.getUTCDate() === Number(date)
    ? value
    : null;
}

/** Whole calendar days from `day` until today in India. Negative in the past. */
export function daysSinceDay(day: string, now: Date = new Date()): number {
  const then = dayValue(day);
  const today = dayValue(istToday(now));
  if (then === null || today === null) return Number.POSITIVE_INFINITY;
  return Math.round((today - then) / DAY);
}

/** Whole calendar days from today in India until `day`. Negative once past. */
export const daysUntilDay = (day: string, now: Date = new Date()) => -daysSinceDay(day, now);

/**
 * A stored day rendered for a reader, without a timezone shifting it.
 *
 * Formatting `new Date("2026-11-15T00:00:00")` on a server west of IST prints
 * the 14th. The day is built at UTC midnight and formatted in UTC, so the
 * date that comes out is always the date that went in.
 */
export function formatDay(
  day: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
): string | null {
  const value = dayValue(day);
  if (value === null) return null;
  return new Intl.DateTimeFormat("en-IN", { ...options, timeZone: "UTC" }).format(new Date(value));
}
