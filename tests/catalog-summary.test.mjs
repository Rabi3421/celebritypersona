// Run with: npm test   (node --test tests/*.test.mjs)
// Pure modules only: nothing here touches MongoDB.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as catalog from "../lib/report/catalog-summary.ts";
import * as clicks from "../lib/report/click-summary.ts";
import { isBuyable, isMonetised, isPublished, pieceLink } from "../lib/types.ts";
import { reportTokenValid } from "../lib/report/report-auth.ts";

const { catalogRange, parseCatalogRequest, summariseCatalog } = catalog;
const helpers = { isPublished, pieceLink, isBuyable, isMonetised, slugOf: (o) => `look-${o.id}` };
const link = (status, extra = {}) => ({ retailer: "Shop", url: "https://shop.example/p", network: "none", status, ...extra });

const OUTFITS = [
  // Live: swap + price. Original ok (checked recently), swap unverified (never checked).
  { id: 1, celebrity: "A", occasion: "Festive", publishedAt: "2026-11-10", items: [{ name: "Saree", worn: 100, wornLink: link("ok", { checkedAt: "2026-11-11T00:00:00Z" }), swap: 50, swapBrand: "S", swapLink: link("unverified") }] },
  // Live with no publish date; legacy wornUrl + soldOut → derived sold_out link.
  { id: 2, celebrity: "B", occasion: "Festive", items: [{ name: "Kurta", worn: 200, wornUrl: "https://old.example/k", soldOut: true }] },
  // Draft: never live, whatever it holds.
  { id: 3, celebrity: "C", occasion: "Casual", status: "draft", items: [{ name: "Tee", worn: 10, wornLink: link("ok") }] },
  // Not a draft but nothing decoded (no swap, no confirmed price): not live.
  { id: 4, celebrity: "D", occasion: "Casual", items: [{ name: "Jeans", wornLink: link("ok") }] },
  // Live, old publish date; a dead monetised link checked long ago, and a piece with no link at all.
  { id: 5, celebrity: "A", occasion: "Airport", publishedAt: "2026-09-07", items: [{ name: "Bag", worn: 5, wornLink: link("dead", { checkedAt: "2026-09-01T00:00:00Z", affiliateUrl: "https://aff.example/x", network: "amazon" }) }, { name: "Shoes", swap: 9, swapBrand: "B" }] },
];
const g = (day, env, side, affiliate, outfitSlug, n) => ({ day, env, side, affiliate, outfitSlug, clicks: n });
const GROUPS = [
  g("2026-11-10", "production", "original", false, "look-1", 2),
  g("2026-11-12", "production", "swap", true, "look-1", 1),
  g("2026-11-11", undefined, "original", false, "look-2", 3),
  g("2026-11-03", "production", "original", false, "look-5", 1),
  g("2026-10-20", "preview", "original", false, "look-1", 4),
  g("2026-11-16", "production", "original", false, "look-1", 2),
  g(null, "production", "original", false, "look-1", 1),
];
const INPUT = { outfits: OUTFITS, clickGroups: GROUPS, requestsByStatus: { New: 2, Queued: 1 }, priceReportsByStatus: {}, activeSubscribers: 1, activeSubscribersJoinedThisWeek: 0 };
const REQUEST = { week: "2026-11-09", weeks: 4 };
const summary = summariseCatalog(INPUT, REQUEST, helpers, "2026-11-16T04:00:00Z");

test("request: week must be a Monday; weeks bounded", () => {
  const parse = (q) => parseCatalogRequest(new URLSearchParams(q));
  assert.deepEqual(parse("week=2026-11-09"), { ok: true, value: { week: "2026-11-09", weeks: 4 } });
  assert.equal(parse("week=2026-11-09&weeks=8").value.weeks, 8);
  for (const q of ["week=2026-11-10", "week=2026-11-09&weeks=0", "week=2026-11-09&weeks=9", "week=2026-11-09&weeks=1.5", "", "week=2026-02-30"]) assert.equal(parse(q).ok, false, q);
});

test("range: four IST weeks ending Sunday 15 Nov 24:00 IST", () => {
  assert.deepEqual(catalogRange(REQUEST), {
    starts: ["2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09"],
    from: "2026-10-18T18:30:00.000Z",
    to: "2026-11-15T18:30:00.000Z",
  });
});

test("date arithmetic agrees with click-summary.ts", () => {
  for (const d of ["2026-11-09", "2026-12-31", "2027-03-01", "2028-02-29"]) {
    assert.equal(catalog.istDayStart(d), clicks.istDayStart(d));
    assert.equal(catalog.addDays(d, -1), clicks.addDays(d, -1));
    assert.equal(catalog.addDays(d, 7), clicks.addDays(d, 7));
  }
  for (const d of ["2026-02-29", "2026-1-1", null, "2026-11-09"]) assert.equal(catalog.parseDate(d), clicks.parseDate(d));
});

test("outfits: live uses the site's isPublished; stored = live + draft + other", () => {
  assert.deepEqual(summary.catalog.outfits, { stored: 5, live: 3, draft: 1, notLiveOther: 1 });
  assert.equal(summary.catalog.liveCelebrities, 2);
  assert.deepEqual(summary.catalog.liveByOccasion, [{ occasion: "Festive", outfits: 2 }, { occasion: "Airport", outfits: 1 }]);
});

test("publish dates: unknown is counted, never guessed", () => {
  assert.deepEqual(summary.catalog.publishDates, { liveKnown: 2, liveUnknown: 1, publishedThisWeek: 1, publishedLast28Days: 1, latestKnown: "2026-11-10" });
  assert.deepEqual(summary.catalog.liveOutfits, [
    { slug: "look-1", publishedAt: "2026-11-10" },
    { slug: "look-2", publishedAt: null },
    { slug: "look-5", publishedAt: "2026-09-07" },
  ]);
});

test("pieces and product links are distinct, statuses mutually exclusive, legacy links counted", () => {
  assert.deepEqual(summary.catalog.pieces, { total: 4, withOriginalLink: 3, withSwapLink: 1, withNoLink: 1 });
  const l = summary.catalog.productLinks;
  assert.equal(l.total, 4);
  assert.deepEqual(l.byStatus, { ok: 1, unverified: 1, pending: 0, sold_out: 1, dead: 1 });
  assert.equal(Object.values(l.byStatus).reduce((a, b) => a + b, 0) + l.otherStatus, l.total, "every link has exactly one status");
  assert.equal(l.buyable, l.byStatus.ok + l.byStatus.unverified);
  assert.equal(l.monetised, 1);
  assert.equal(l.neverChecked, 2, "the unverified swap and the derived legacy link");
  assert.equal(l.checkedOver30DaysAgo, 1);
  assert.equal(summary.catalog.pieces.withOriginalLink + summary.catalog.pieces.withSwapLink, l.total, "links = original + swap sides");
});

test("clicks: production by IST week; untagged unclassified; out-of-range not counted", () => {
  const [w1, , w3, w4] = summary.clicks.weeks;
  assert.equal(w4.start, "2026-11-09");
  assert.deepEqual(w4.production, { total: 3, original: 2, swap: 1, otherSide: 0, paid: 1, unpaid: 2, otherPaid: 0 });
  assert.equal(w4.unclassified, 3);
  assert.equal(w3.production.total, 1);
  assert.deepEqual(w1.otherEnvironments, { preview: 4, development: 0, local: 0 });
  assert.equal(w1.production.total, 0);
  assert.equal(summary.clicks.unreadableTimestamps, 3);
  assert.deepEqual(summary.clicks.productionByOutfit.week, [{ slug: "look-1", clicks: 3 }]);
  assert.deepEqual(summary.clicks.productionByOutfit.last28Days, [{ slug: "look-1", clicks: 3 }, { slug: "look-5", clicks: 1 }]);
});

test("requests, price reports and newsletter: counts only", () => {
  assert.deepEqual(summary.requests, { celebrityRequests: { total: 3, new: 2 }, priceReports: { total: 0, new: 0 } });
  assert.deepEqual(summary.newsletter, { active: 1, joinedThisWeek: 0 });
});

test("empty data: zeros everywhere, nothing missing, nothing invented", () => {
  const empty = summariseCatalog({ outfits: [], clickGroups: [], requestsByStatus: {}, priceReportsByStatus: {}, activeSubscribers: 0, activeSubscribersJoinedThisWeek: 0 }, REQUEST, helpers, "x");
  assert.deepEqual(empty.catalog.outfits, { stored: 0, live: 0, draft: 0, notLiveOther: 0 });
  assert.equal(empty.catalog.publishDates.latestKnown, null);
  assert.equal(empty.clicks.weeks.length, 4);
  assert.ok(empty.clicks.weeks.every((w) => w.production.total === 0 && w.unclassified === 0));
});

test("the response carries no URLs, retailers, piece names, emails or reader text", () => {
  const text = JSON.stringify(summary);
  for (const banned of ["https://", "shop.example", "aff.example", "Saree", "Kurta", "retailer", "email", "@", "url"]) assert.ok(!text.includes(banned), `leaked ${banned}`);
});

test("auth: the catalog route uses the same fail-closed check as the clicks route", () => {
  const token = "c".repeat(64);
  assert.equal(reportTokenValid(`Bearer ${token}`, token), true);
  assert.equal(reportTokenValid(null, token), false);
  assert.equal(reportTokenValid(`Bearer ${token}`, undefined), false);
});
