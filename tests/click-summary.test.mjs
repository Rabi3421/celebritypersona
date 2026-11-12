// Run with: npm test   (node --test tests/*.test.mjs)
// Pure modules only: nothing here touches MongoDB or calls /go.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  clickPipeline,
  istDayStart,
  MAX_OUTFITS,
  parseDate,
  parseSummaryRequest,
  summariseClicks,
  summaryRange,
} from "../lib/report/click-summary.ts";
import { reportTokenValid } from "../lib/report/report-auth.ts";
import { clickEnvironment } from "../lib/click-environment.ts";

const GOOD_TOKEN = "a".repeat(32) + "-report-token";

test("environment tag: production only when Vercel says so", () => {
  assert.equal(clickEnvironment("production"), "production");
  assert.equal(clickEnvironment("preview"), "preview");
  assert.equal(clickEnvironment("development"), "development");
  assert.equal(clickEnvironment(undefined), "local");
  assert.equal(clickEnvironment(""), "local");
  assert.equal(clickEnvironment("Production"), "local", "exact value only");
});

test("token: fails closed when unset, short, wrong or malformed", () => {
  assert.equal(reportTokenValid(`Bearer ${GOOD_TOKEN}`, GOOD_TOKEN), true);
  assert.equal(reportTokenValid(`bearer ${GOOD_TOKEN}  `, `${GOOD_TOKEN}\n`), true, "case and trailing whitespace");
  assert.equal(reportTokenValid(`Bearer ${GOOD_TOKEN}`, undefined), false, "unset on the server");
  assert.equal(reportTokenValid("Bearer ", ""), false);
  assert.equal(reportTokenValid("Bearer short", "short"), false, "a short configured token is refused even when it matches");
  assert.equal(reportTokenValid(`Bearer ${GOOD_TOKEN}x`, GOOD_TOKEN), false);
  assert.equal(reportTokenValid(GOOD_TOKEN, GOOD_TOKEN), false, "no Bearer scheme");
  assert.equal(reportTokenValid(null, GOOD_TOKEN), false);
  assert.equal(reportTokenValid(`Bearer ${GOOD_TOKEN} extra`, GOOD_TOKEN), false);
});

test("dates: real calendar dates only", () => {
  assert.equal(parseDate("2026-11-11"), "2026-11-11");
  assert.equal(parseDate("2026-02-29"), null);
  assert.equal(parseDate("2028-02-29"), "2028-02-29");
  assert.equal(parseDate("2026-11-1"), null);
  assert.equal(parseDate("2026-11-11T00:00"), null);
  assert.equal(parseDate(null), null);
});

test("request: days defaults to 2 and is bounded", () => {
  const parse = (q) => parseSummaryRequest(new URLSearchParams(q));
  assert.deepEqual(parse("date=2026-11-11"), { ok: true, value: { date: "2026-11-11", days: 2 } });
  assert.deepEqual(parse("date=2026-11-11&days=8").value, { date: "2026-11-11", days: 8 });
  for (const q of ["date=2026-11-11&days=0", "date=2026-11-11&days=9", "date=2026-11-11&days=1.5", "date=2026-11-11&days=x", "days=2", "date=11-11-2026"]) {
    assert.equal(parse(q).ok, false, q);
  }
});

test("IST day boundaries are 18:30 UTC", () => {
  assert.equal(new Date(istDayStart("2026-11-11")).toISOString(), "2026-11-10T18:30:00.000Z");
  assert.equal(addDays("2026-11-01", -1), "2026-10-31");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.deepEqual(summaryRange({ date: "2026-11-11", days: 2 }), {
    dates: ["2026-11-10", "2026-11-11"],
    from: "2026-11-09T18:30:00.000Z",
    to: "2026-11-11T18:30:00.000Z",
  });
});

test("pipeline: read-only, range on the ISO string, grouped by IST day", () => {
  const pipeline = clickPipeline({ from: "A", to: "B" });
  assert.deepEqual(pipeline[0], { $match: { at: { $gte: "A", $lt: "B" } } });
  assert.deepEqual(pipeline.map((stage) => Object.keys(stage)[0]), ["$match", "$group"], "no $out or $merge stage");
  assert.match(JSON.stringify(pipeline), /"timezone":"Asia\/Kolkata"/);
});

const g = (day, env, side, affiliate, outfitSlug, clicks) => ({ day, env, side, affiliate, outfitSlug, clicks });

test("summary: only env=production is production; untagged is unclassified, never added", () => {
  const groups = [
    g("2026-11-11", "production", "original", false, "look-a", 4),
    g("2026-11-11", "production", "swap", true, "look-a", 2),
    g("2026-11-11", "production", "swap", false, "look-b", 3),
    g("2026-11-11", undefined, "original", false, "look-a", 5),
    g("2026-11-11", null, "swap", false, "look-c", 1),
    g("2026-11-11", "staging", "swap", false, "look-c", 1),
    g("2026-11-11", "preview", "original", false, "look-a", 7),
    g("2026-11-11", "local", "swap", true, "look-b", 2),
    g("2026-11-11", "development", "swap", true, "look-b", 1),
    g("2026-11-10", "production", "original", true, "look-z", 1),
    g(null, "production", "original", false, "look-a", 9),
    g("2026-11-12", "production", "original", false, "look-a", 6),
  ];
  const summary = summariseClicks(groups, { date: "2026-11-11", days: 2 }, "2026-11-12T03:30:00.000Z");
  const [prev, day] = summary.days;
  assert.equal(prev.date, "2026-11-10");
  assert.deepEqual(prev.production, { total: 1, original: 1, swap: 0, otherSide: 0, paid: 1, unpaid: 0, otherPaid: 0 });
  assert.deepEqual(day.production, { total: 9, original: 4, swap: 5, otherSide: 0, paid: 2, unpaid: 7, otherPaid: 0 });
  assert.equal(day.unclassified, 7, "missing, null and unknown env values");
  assert.deepEqual(day.otherEnvironments, { preview: 7, development: 1, local: 2 });
  assert.equal(summary.unreadableTimestamps, 15, "null day and a day outside the range");
  assert.deepEqual(summary.outfits.production, [
    { slug: "look-a", clicks: 6 },
    { slug: "look-b", clicks: 3 },
  ]);
  assert.equal(summary.outfits.truncated, false);
});

test("summary: an empty range is zeros for every day, not missing days", () => {
  const summary = summariseClicks([], { date: "2026-11-11", days: 3 }, "x");
  assert.deepEqual(summary.days.map((d) => d.date), ["2026-11-09", "2026-11-10", "2026-11-11"]);
  assert.ok(summary.days.every((d) => d.production.total === 0 && d.unclassified === 0));
  assert.deepEqual(summary.outfits.production, []);
});

test("summary: odd side or affiliate values are reported, not guessed", () => {
  const summary = summariseClicks([g("2026-11-11", "production", "both", "yes", "", 2), g("2026-11-11", "production", "swap", true, "x", 0)], { date: "2026-11-11", days: 1 }, "x");
  assert.deepEqual(summary.days[0].production, { total: 2, original: 0, swap: 0, otherSide: 2, paid: 0, unpaid: 0, otherPaid: 2 });
  assert.deepEqual(summary.outfits.production, [{ slug: "(unknown)", clicks: 2 }]);
});

test("summary: per-outfit list is capped and says so", () => {
  const groups = Array.from({ length: MAX_OUTFITS + 3 }, (_, i) => g("2026-11-11", "production", "swap", false, `look-${i}`, 1));
  const summary = summariseClicks(groups, { date: "2026-11-11", days: 1 }, "x");
  assert.equal(summary.outfits.production.length, MAX_OUTFITS);
  assert.equal(summary.outfits.truncated, true);
  assert.equal(summary.days[0].production.total, MAX_OUTFITS + 3, "totals are not capped");
});
