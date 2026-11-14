// Run with: npm test. Pure modules, plus the PostHog fetcher against a stubbed
// fetch — nothing here touches MongoDB, PostHog or the network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, compare, coverage, daysOf, istDay, istStamp, istStart, resolvePeriod } from "../lib/bi/period.ts";
import { briefing, dailyFacts } from "../lib/bi/summary.ts";
import { clicksPipeline, summariseClicks } from "../lib/bi/clicks.ts";
import { contentSnapshot } from "../lib/bi/content.ts";
import { parseTraffic, siteHosts, trafficConfig, trafficQueries, verifiedBrowser } from "../lib/bi/traffic.ts";
import { buildActions } from "../lib/bi/actions.ts";
import { recentActivity } from "../lib/bi/activity.ts";
import { clickSource, databaseSource, trafficSource, UNCONNECTED } from "../lib/bi/sources.ts";
import { CSV_COLUMNS, overviewCsv } from "../lib/bi/csv.ts";

// 14 Nov 2026, 11:45 IST.
const NOW = Date.parse("2026-11-14T06:15:00Z");

// ---------- periods ----------

test("period: IST day boundaries, not UTC", () => {
  assert.equal(istDay(Date.parse("2026-11-13T18:29:59Z")), "2026-11-13", "23:59:59 IST is still the 13th");
  assert.equal(istDay(Date.parse("2026-11-13T18:30:00Z")), "2026-11-14", "00:00 IST is the 14th");
  assert.equal(new Date(istStart("2026-11-14")).toISOString(), "2026-11-13T18:30:00.000Z");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("period: presets end on complete days; today is marked incomplete", () => {
  const today = resolvePeriod({ range: "today" }, NOW);
  assert.deepEqual([today.from, today.to, today.complete, today.days], ["2026-11-14", "2026-11-14", false, 1]);
  assert.deepEqual([today.previous.from, today.previous.to], ["2026-11-13", "2026-11-13"]);

  const yesterday = resolvePeriod({ range: "yesterday" }, NOW);
  assert.deepEqual([yesterday.from, yesterday.to, yesterday.complete], ["2026-11-13", "2026-11-13", true]);

  const week = resolvePeriod({ range: "7d" }, NOW);
  assert.deepEqual([week.from, week.to, week.days, week.complete], ["2026-11-07", "2026-11-13", 7, true]);
  assert.deepEqual([week.previous.from, week.previous.to, week.previous.days], ["2026-10-31", "2026-11-06", 7]);
  assert.equal(week.endMs - week.startMs, 7 * 86_400_000);
  assert.equal(week.previous.endMs, week.startMs, "periods are contiguous");

  const def = resolvePeriod({}, NOW);
  assert.deepEqual([def.key, def.from, def.to, def.days], ["28d", "2026-10-17", "2026-11-13", 28]);
  assert.equal(resolvePeriod({ range: "junk" }, NOW).key, "28d");
});

test("period: custom ranges are validated and fall back with a notice", () => {
  const ok = resolvePeriod({ range: "custom", from: "2026-11-01", to: "2026-11-10" }, NOW);
  assert.deepEqual([ok.key, ok.days, ok.notice], ["custom", 10, undefined]);
  assert.deepEqual([ok.previous.from, ok.previous.to], ["2026-10-22", "2026-10-31"]);
  assert.equal(resolvePeriod({ range: "custom", from: "2026-11-14", to: "2026-11-14" }, NOW).complete, false, "a custom range that includes today is incomplete");

  for (const [from, to, why] of [
    ["2026-11-10", "2026-11-01", /after the end/],
    ["2026-11-01", "2026-11-15", /future/],
    ["2026-01-01", "2026-11-10", /92 days/],
    ["2026-02-30", "2026-03-02", /both dates/],
    ["", "2026-11-01", /both dates/],
    ["2026-11-01'; DROP", "2026-11-02", /both dates/],
  ]) {
    const p = resolvePeriod({ range: "custom", from, to }, NOW);
    assert.equal(p.key, "28d", `${from}..${to}`);
    assert.match(p.notice, why);
  }
  assert.equal(daysOf(ok).length, 10);
});

test("comparison: only between complete periods covered by data; small bases as differences", () => {
  const week = resolvePeriod({ range: "7d" }, NOW);
  assert.equal(compare(5, 2, resolvePeriod({ range: "today" }, NOW), "2026-01-01").kind, "none");
  assert.match(compare(5, 2, week, "2026-11-10").text, /data starts/);
  assert.match(compare(5, 2, week, null).text, /no data/);
  assert.match(compare(null, 2, week, "2026-01-01").text, /unavailable/);
  const small = compare(5, 2, week, "2026-01-01");
  assert.deepEqual([small.kind, small.pct, small.direction], ["change", null, "up"]);
  assert.equal(small.text, "+3 vs the previous 7 days");
  const big = compare(30, 40, week, "2026-01-01");
  assert.equal(big.pct, -25);
  assert.match(big.text, /^−10 \(−25%\)/);
  assert.equal(compare(4, 4, resolvePeriod({ range: "yesterday" }, NOW), "2026-01-01").text, "Same as the day before");
  assert.match(istStamp(NOW), /14 Nov 2026.*11:45 IST/);
});

// ---------- shop clicks ----------

test("clicks: the pipeline queries ISO bounds over both periods and buckets by IST day", () => {
  const week = resolvePeriod({ range: "7d" }, NOW);
  const [match, add] = clicksPipeline(week);
  assert.deepEqual(match.$match.at, { $gte: "2026-10-30T18:30:00.000Z", $lt: "2026-11-13T18:30:00.000Z" });
  assert.equal(add.$addFields.day.$dateToString.timezone, "Asia/Kolkata");
});

test("clicks: production only, previous separated, days zero-filled, nothing invented", () => {
  const week = resolvePeriod({ range: "7d" }, NOW);
  const row = (day, env, side, affiliate, clicks) => ({ _id: { day, env, side, affiliate }, clicks });
  const s = summariseClicks(
    {
      days: [
        row("2026-11-13", "production", "original", false, 3),
        row("2026-11-13", "production", "swap", true, 1),
        row("2026-11-07", "production", "original", false, 2),
        row("2026-11-12", "preview", "original", false, 5),
        row("2026-11-12", "local", "original", false, 4),
        row("2026-11-12", "development", "swap", false, 1),
        row("2026-11-12", null, "original", false, 7),
        row("2026-11-01", "production", "original", false, 6),
        row("2026-11-01", null, "original", false, 9),
      ],
      outfits: [{ _id: { id: 4, slug: "a-look" }, clicks: 6 }],
      retailers: [{ _id: null, clicks: 1 }],
      pieces: [],
    },
    week,
    "2026-09-23",
  );
  assert.deepEqual(s.current, { total: 6, original: 5, swap: 1, other: 0, affiliate: 1, direct: 5 });
  assert.equal(s.previous.total, 6);
  assert.deepEqual(s.excluded, { unclassified: 7, preview: 5, local: 5 });
  assert.equal(s.daily.length, 7);
  assert.equal(s.daily.find((d) => d.day === "2026-11-10").total, 0);
  assert.equal(s.daily.find((d) => d.day === "2026-11-13").total, 4);
  assert.equal(s.retailers[0].name, "Unknown");
  assert.equal(summariseClicks(undefined, week, null).current.total, 0);
});

// ---------- content ----------

const look = (id, over = {}) => ({
  id,
  celebrity: `Star ${id}`,
  event: "Premiere",
  date: "2026-09-01",
  occasion: "Party",
  items: [],
  ...over,
});
const priced = { name: "Dress", worn: 1000, wornBrand: "Label" };

test("content: live / draft / held back, publishing in period, search gaps, link health", () => {
  const week = resolvePeriod({ range: "7d" }, NOW);
  const outfits = [
    look(1, { publishedAt: "2026-11-08", primaryKeyword: "star 1 dress", seoTitle: "t", seoDescription: "d", items: [{ ...priced, wornLink: { retailer: "Shop", url: "https://shop.example/a", network: "none", status: "ok", checkedAt: "2026-11-01" } }] }),
    look(2, { publishedAt: "2026-09-10", items: [{ ...priced, wornLink: { retailer: "", url: "https://www.gone.example/b", network: "none", status: "sold_out", checkedAt: "2026-09-01" } }] }),
    look(3, { items: [{ ...priced, swap: 500, swapBrand: "High St", swapUrl: "https://hs.example/c" }] }),
    look(4, { status: "draft", items: [priced] }),
    look(5, { items: [{ name: "Bag" }] }),
  ];
  const c = contentSnapshot(outfits, week, NOW);
  assert.deepEqual(c.looks, { total: 5, live: 3, drafts: 1, heldBack: 1, pieces: 3 });
  assert.deepEqual(c.publishing.publishedInPeriod.map((p) => p.id), [1]);
  assert.equal(c.publishing.withoutDate, 1);
  assert.equal(c.publishing.last, "2026-11-08");
  assert.deepEqual(c.search.withoutKeyword.map((l) => l.id), [2, 3]);
  assert.equal(c.links.total, 3);
  assert.deepEqual(c.links.byStatus, { ok: 1, unverified: 1, pending: 0, sold_out: 1, dead: 0 });
  assert.equal(c.links.problems[0].retailer, "gone.example");
  assert.equal(c.links.neverChecked.length, 1, "the legacy swap URL was never checked");
  assert.equal(c.links.stale.length, 1, "checked over 30 days ago");
  assert.equal(c.links.affiliate, 0);
});

// ---------- PostHog traffic ----------

test("traffic: not connected without a query key; never the public browser key", () => {
  assert.equal(trafficConfig({}).ok, false);
  assert.equal(trafficConfig({ NEXT_PUBLIC_POSTHOG_KEY: "phc_public" }).ok, false);
  assert.equal(trafficConfig({ POSTHOG_QUERY_API_KEY: "k", POSTHOG_PROJECT_ID: "12a" }).ok, false);
  assert.equal(trafficConfig({ POSTHOG_QUERY_API_KEY: "k", POSTHOG_PROJECT_ID: "1", POSTHOG_HOST: "http://evil.example" }).ok, false);
  assert.equal(trafficConfig({ POSTHOG_QUERY_API_KEY: "k", POSTHOG_PROJECT_ID: "1", POSTHOG_HOST: "http://127.0.0.1:9", NODE_ENV: "production" }).ok, false, "no plain http in production");
  const local = trafficConfig({ POSTHOG_QUERY_API_KEY: "k", POSTHOG_PROJECT_ID: "1", POSTHOG_HOST: "http://127.0.0.1:9/", NODE_ENV: "development" });
  assert.equal(local.ok && local.host, "http://127.0.0.1:9");
  const prod = trafficConfig({ POSTHOG_QUERY_API_KEY: " k ", POSTHOG_PROJECT_ID: "715056", NEXT_PUBLIC_SITE_URL: "https://www.celebritypersona.com" });
  assert.deepEqual(prod.ok && [prod.apiKey, prod.host, prod.siteHosts], ["k", "https://us.posthog.com", ["celebritypersona.com", "www.celebritypersona.com"]]);
  assert.deepEqual(siteHosts("not a url"), ["celebritypersona.com", "www.celebritypersona.com"]);
});

test("traffic: production filter matches the Worker's rule; nothing unsafe reaches a query", () => {
  const v = verifiedBrowser(["celebritypersona.com", "www.celebritypersona.com", "x' OR 1=1 --"]);
  assert.match(v, /cp_env\), ''\) = 'production'/);
  assert.match(v, /cp_test\), ''\) NOT IN \('true', '1'\)/);
  assert.match(v, /\$lib\), ''\) = 'web'/);
  assert.ok(!v.includes("OR 1=1"));
  assert.throws(() => verifiedBrowser(["'"]));
  const q = trafficQueries(resolvePeriod({ range: "7d" }, NOW), ["celebritypersona.com"]);
  const start = Math.floor(Date.parse("2026-11-06T18:30:00Z") / 1000);
  assert.ok(q.daily.includes(`fromUnixTimestamp(${start})`));
  assert.ok(q.daily.includes("toTimeZone(timestamp, 'Asia/Kolkata')"));
  assert.equal(q.breakdowns.split("UNION ALL").length, 5);
});

test("traffic: parsing zero-fills days and reads totals and the first day of data", () => {
  const week = resolvePeriod({ range: "7d" }, NOW);
  const t = parseTraffic(
    {
      daily: [["2026-11-12", 9, 4, 2], ["2026-11-13", "2", "0", "1"]],
      totals: [["current", 11, 4, 3, "2026-11-10"], ["before", 3, 0, 1, "2026-11-10"]],
      breakdowns: [["device", "Mobile", 7], ["outfit", "a-look", 4], ["nope", "x", 1], ["page", "", 2]],
    },
    daysOf(week),
    NOW,
  );
  assert.equal(t.status, "ok");
  assert.deepEqual(t.current, { pageviews: 11, outfitViews: 4, browsers: 3 });
  assert.deepEqual(t.previous, { pageviews: 0, outfitViews: 0, browsers: 0 });
  assert.equal(t.since, "2026-11-10");
  assert.equal(t.daily.length, 7);
  assert.deepEqual(t.daily.at(-1), { day: "2026-11-13", pageviews: 2, outfitViews: 0, browsers: 1 });
  assert.deepEqual(t.breakdowns.device, [{ value: "Mobile", n: 7 }]);
  assert.equal(t.breakdowns.page.length, 0);
});

test("traffic fetch: not connected, success with cache, and errors that never echo the key", async () => {
  const { getTraffic } = await import("../lib/bi/posthog.ts");
  const saved = { ...process.env };
  const realFetch = globalThis.fetch;
  try {
    delete process.env.POSTHOG_QUERY_API_KEY;
    delete process.env.POSTHOG_PROJECT_ID;
    assert.equal((await getTraffic(resolvePeriod({ range: "7d" }, NOW), NOW)).status, "not-connected");

    process.env.POSTHOG_QUERY_API_KEY = "phx_secret_value";
    process.env.POSTHOG_PROJECT_ID = "715056";
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url, auth: init.headers.Authorization, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ results: [] }), { status: 200 });
    };
    const period = resolvePeriod({ range: "custom", from: "2026-11-01", to: "2026-11-05" }, NOW);
    const first = await getTraffic(period, NOW);
    assert.equal(first.status, "ok");
    assert.equal(calls.length, 3, "three queries, one after another");
    assert.equal(calls[0].url, "https://us.posthog.com/api/projects/715056/query/");
    assert.equal(calls[0].auth, "Bearer phx_secret_value");
    assert.equal(calls[0].body.query.kind, "HogQLQuery");
    await getTraffic(period, NOW + 60_000);
    assert.equal(calls.length, 3, "served from cache");

    globalThis.fetch = async () => new Response("denied phx_secret_value", { status: 403 });
    const denied = await getTraffic(resolvePeriod({ range: "custom", from: "2026-10-01", to: "2026-10-05" }, NOW), NOW);
    assert.equal(denied.status, "error");
    assert.ok(!JSON.stringify(denied).includes("phx_secret"), "the key never appears in the result");

    globalThis.fetch = async () => {
      throw new Error("connect ECONNREFUSED phx_secret_value");
    };
    const down = await getTraffic(resolvePeriod({ range: "custom", from: "2026-09-01", to: "2026-09-05" }, NOW), NOW);
    assert.deepEqual(down, { status: "error", reason: "PostHog could not be reached." });
  } finally {
    globalThis.fetch = realFetch;
    process.env = saved;
  }
});

test("traffic fetch: concurrent loads share one fetch; timeouts say so; 'later' events give the newest day", async () => {
  const { getTraffic } = await import("../lib/bi/posthog.ts");
  const saved = { ...process.env };
  const realFetch = globalThis.fetch;
  try {
    process.env.POSTHOG_QUERY_API_KEY = "phx_secret_value";
    process.env.POSTHOG_PROJECT_ID = "715056";
    let calls = 0;
    globalThis.fetch = async (_url, init) => {
      calls++;
      await new Promise((r) => setTimeout(r, 20));
      const name = JSON.parse(init.body).name;
      const results = name.endsWith("totals") ? [["current", 5, 1, 2, "2026-08-01", "2026-08-03"], ["later", 2, 0, 1, "2026-08-01", "2026-11-13"]] : [];
      return new Response(JSON.stringify({ results }), { status: 200 });
    };
    const period = resolvePeriod({ range: "custom", from: "2026-08-01", to: "2026-08-03" }, NOW);
    const [a, b, c] = await Promise.all([getTraffic(period, NOW), getTraffic(period, NOW), getTraffic(period, NOW)]);
    assert.equal(calls, 3, "three simultaneous page loads cost one set of three queries");
    assert.equal(a, b);
    assert.equal(c.lastDay, "2026-11-13");
    assert.deepEqual(c.current, { pageviews: 5, outfitViews: 1, browsers: 2 }, "'later' rows never count towards the period");

    globalThis.fetch = async () => {
      throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    };
    const slow = await getTraffic(resolvePeriod({ range: "custom", from: "2026-08-04", to: "2026-08-05" }, NOW), NOW);
    assert.deepEqual(slow, { status: "error", reason: "PostHog did not answer within 10 seconds." });
  } finally {
    globalThis.fetch = realFetch;
    process.env = saved;
  }
});

// ---------- actions, activity, sources, CSV ----------

const emptyContent = () => contentSnapshot([], resolvePeriod({}, NOW), NOW);

test("actions: from records only, sorted by priority, with evidence and a destination", () => {
  const week = resolvePeriod({ range: "7d" }, NOW);
  const content = contentSnapshot(
    [look(1, { items: [{ ...priced, wornLink: { retailer: "S", url: "https://s.example", network: "none", status: "dead" } }] }), look(2, { status: "draft" })],
    week,
    NOW,
  );
  const actions = buildActions({ content, health: [{ key: "reports", label: "Reader reports waiting", detail: "d", count: 2, href: "/admin/reports", ok: false }], clicks: null, traffic: { configured: false, reason: "No key" }, periodLabel: week.label });
  const ids = actions.map((a) => a.id);
  for (const id of ["broken-links", "no-keyword", "drafts", "posthog", "gsc", "health-reports", "no-affiliate"]) assert.ok(ids.includes(id), id);
  const rank = { high: 0, medium: 1, low: 2 };
  assert.deepEqual(actions.map((a) => rank[a.priority]), [...actions].map((a) => rank[a.priority]).sort());
  for (const a of actions) {
    assert.ok(a.title && a.why && a.evidence && a.next && a.href, a.id);
    assert.ok(a.examples.length <= 3);
  }
  assert.equal(actions.find((a) => a.id === "posthog").evidence, "No key");
  assert.equal(buildActions({ content: emptyContent(), health: [], clicks: null, traffic: { configured: false, reason: "x" }, periodLabel: "x" }).some((a) => a.id === "no-affiliate"), false, "no links, no affiliate action");
  assert.equal(buildActions({ content: emptyContent(), health: [], clicks: null, traffic: { configured: true }, periodLabel: "x" }).some((a) => a.id === "posthog"), false, "configured: no connect action");

  // Broken links cite verified clicks on the affected looks, never an estimate.
  const clicks = summariseClicks({ days: [], outfits: [{ _id: { id: 1, slug: "s" }, clicks: 4 }, { _id: { id: 9, slug: "o" }, clicks: 7 }], retailers: [], pieces: [] }, week, "2026-01-01");
  const broken = buildActions({ content, health: [], clicks, traffic: { configured: true }, periodLabel: "Last 7 complete days" }).find((a) => a.id === "broken-links");
  assert.match(broken.evidence, /Those looks received 4 production shop clicks in last 7 complete days\./);
});

test("content: link health for live looks is separate from drafts", () => {
  const c = contentSnapshot(
    [
      look(1, { items: [{ ...priced, wornLink: { retailer: "S", url: "https://s.example/1", network: "none", status: "ok" } }] }),
      look(2, { status: "draft", items: [{ ...priced, wornLink: { retailer: "S", url: "https://s.example/2", network: "none", status: "dead" } }] }),
    ],
    resolvePeriod({}, NOW),
    NOW,
  );
  assert.equal(c.links.total, 2);
  assert.deepEqual(c.links.live, { total: 1, byStatus: { ok: 1, unverified: 0, pending: 0, sold_out: 0, dead: 0 } });
});

test("coverage, briefing and chart facts: no data is never shown as zero", () => {
  const week = resolvePeriod({ range: "7d" }, NOW);
  assert.equal(coverage(week, null), "none");
  assert.equal(coverage(week, "2026-11-14"), "none", "data starts after the period");
  assert.equal(coverage(week, "2026-11-10"), "partial");
  assert.equal(coverage(week, "2026-01-01"), "full");

  const facts = dailyFacts([{ day: "2026-11-08", value: 0 }, { day: "2026-11-10", value: 3 }, { day: "2026-11-11", value: 0 }, { day: "2026-11-12", value: 5 }], "2026-11-10");
  assert.deepEqual(facts, { total: 8, coveredDays: 3, activeDays: 2, best: { day: "2026-11-12", value: 5 } });
  assert.equal(dailyFacts([{ day: "2026-11-08", value: 0 }], null).coveredDays, 0);

  const content = emptyContent();
  const clicks = summariseClicks({ days: [{ _id: { day: "2026-11-13", env: "production", side: "original", affiliate: false }, clicks: 2 }], outfits: [{ _id: { id: 1, slug: "a" }, clicks: 2 }], retailers: [], pieces: [] }, week, "2026-01-01");
  const b = briefing({ period: week, clicks, content, actions: [{ priority: "high", title: "Fix it" }] });
  assert.equal(b.shopping, "2 production shop clicks across 1 look (+2 vs the previous 7 days).");
  assert.equal(b.publishing, "No looks first published; 0 live in total.");
  assert.equal(b.top, "Fix it");
  assert.equal(briefing({ period: week, clicks: summariseClicks(undefined, week, null), content, actions: [] }).shopping, "No shop-click data covers this period.");
  assert.equal(briefing({ period: week, clicks: null, content, actions: [] }).shopping, "Shop clicks could not be read.");
});

test("activity: counts only for subscribers and clicks; no addresses", () => {
  const items = recentActivity({
    outfits: [look(1, { publishedAt: "2026-11-08", pricesCheckedAt: "2026-11-09" })],
    mailJobs: [{ createdAt: "2026-11-10T05:00:00Z", status: "Sent", subject: "New look", sent: 1 }],
    subscribers: [{ joinedAt: "2026-11-11T20:00:00Z", email: "reader@example.test" }],
    clickDays: [{ day: "2026-11-12", total: 2 }, { day: "2026-11-11", total: 0 }],
  });
  assert.deepEqual(items.map((i) => i.day), ["2026-11-12", "2026-11-12", "2026-11-10", "2026-11-09", "2026-11-08"], "newest day first");
  assert.equal(items.find((i) => i.kind === "subscribers").day, "2026-11-12", "joined 20:00 UTC = 01:30 IST next day");
  assert.ok(!JSON.stringify(items).includes("reader@"));
});

test("sources: connected, stale, failing and not connected are distinct", () => {
  const today = "2026-11-14";
  assert.equal(databaseSource(true).state, "connected");
  assert.equal(databaseSource(false).state, "error");
  assert.equal(clickSource({ ok: false, since: null, lastDay: null }, today).state, "error");
  assert.equal(clickSource({ ok: true, since: null, lastDay: null }, today).state, "stale");
  assert.equal(clickSource({ ok: true, since: "2026-09-23", lastDay: "2026-11-13" }, today).state, "connected");
  const oldClicks = clickSource({ ok: true, since: "2026-09-23", lastDay: "2026-10-20" }, today);
  assert.equal(oldClicks.state, "stale");
  assert.match(oldClicks.detail, /either no one clicked Buy, or the redirect stopped recording/);
  assert.equal(trafficSource({ status: "not-connected", reason: "No key" }, today).state, "not-connected");
  assert.equal(trafficSource({ status: "error", reason: "PostHog answered HTTP 500." }, today).detail, "PostHog answered HTTP 500.");
  const ok = parseTraffic({ daily: [], totals: [["later", 1, 0, 1, "2026-11-10", "2026-11-14"]], breakdowns: [] }, [], NOW);
  assert.equal(trafficSource(ok, today).state, "connected");
  const quiet = parseTraffic({ daily: [], totals: [["current", 1, 0, 1, "2026-11-01", "2026-11-05"]], breakdowns: [] }, [], NOW);
  assert.equal(trafficSource(quiet, today).state, "stale");
  assert.ok(UNCONNECTED.every((s) => s.state === "not-connected"));
  assert.deepEqual(UNCONNECTED.map((s) => s.key), ["gsc", "monitor", "vercel", "affiliate"]);
});

test("csv: daily aggregates only, blank before a source has data", () => {
  const week = resolvePeriod({ range: "7d" }, NOW);
  const clicks = summariseClicks({ days: [{ _id: { day: "2026-11-13", env: "production", side: "swap", affiliate: false }, clicks: 2 }], outfits: [{ _id: { id: 9, slug: "secret-slug" }, clicks: 2 }], retailers: [], pieces: [] }, week, "2026-11-09");
  const traffic = parseTraffic({ daily: [["2026-11-12", 9, 4, 2]], totals: [["current", 9, 4, 2, "2026-11-12"]], breakdowns: [] }, daysOf(week), NOW);
  const lines = overviewCsv(week, clicks, traffic).trim().split("\r\n");
  assert.equal(lines[0], CSV_COLUMNS.join(","));
  assert.equal(lines.length, 8);
  assert.equal(lines[1], "2026-11-07,,,,,,,", "before either source has data");
  assert.equal(lines[3], "2026-11-09,0,0,0,0,,,");
  assert.equal(lines[6], "2026-11-12,0,0,0,0,9,4,2");
  assert.equal(lines[7], "2026-11-13,2,0,2,0,0,0,0");
  assert.ok(!lines.join().includes("secret-slug"));
  assert.equal(overviewCsv(week, null, { status: "not-connected", reason: "x" }).split("\r\n")[1], "2026-11-07,,,,,,,");
});
