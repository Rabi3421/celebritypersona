import test from "node:test";
import assert from "node:assert/strict";
import { summariseQueries } from "@/lib/report/search-queries";

const site = "https://www.celebritypersona.com";
const row = (keys, clicks, impressions, position) => ({ keys, clicks, impressions, position });

test("near misses are page-2 queries, most seen first", () => {
  const out = summariseQueries({
    queryPages28: [
      row(["kiara red saree", `${site}/outfits/kiara-red-saree`], 0, 40, 12.4),
      row(["alia white suit", `${site}/outfits/alia-white-suit`], 1, 90, 9),
      row(["deepika gown", `${site}/outfits/deepika-gown`], 5, 200, 3),
      row(["rare query", `${site}/outfits/x`], 0, 3, 45),
    ],
    queries7: [],
    queriesBefore: [],
    pages7: [],
    pagesPrev7: [],
  });
  assert.deepEqual(out.nearMisses.map((m) => [m.query, m.path, m.position]), [
    ["alia white suit", "/outfits/alia-white-suit", 9],
    ["kiara red saree", "/outfits/kiara-red-saree", 12.4],
  ]);
  assert.equal(out.top[0].query, "deepika gown");
});

test("new queries are ones not seen in the four weeks before", () => {
  const out = summariseQueries({
    queryPages28: [],
    queries7: [row(["old"], 1, 10, 5), row(["fresh"], 0, 4, 18)],
    queriesBefore: [row(["old"], 2, 30, 6)],
    pages7: [],
    pagesPrev7: [],
  });
  assert.deepEqual(out.newQueries.map((q) => q.query), ["fresh"]);
});

test("a drop needs at least 5 clicks before and a loss of more than 30%", () => {
  const out = summariseQueries({
    queryPages28: [],
    queries7: [],
    queriesBefore: [],
    pages7: [row([`${site}/outfits/a`], 2, 50, 8), row([`${site}/outfits/b`], 4, 50, 8)],
    pagesPrev7: [row([`${site}/outfits/a`], 10, 80, 7), row([`${site}/outfits/b`], 5, 50, 8), row([`${site}/outfits/c`], 3, 9, 9)],
  });
  assert.deepEqual(out.drops, [{ path: "/outfits/a", clicks: 2, before: 10 }]);
});

test("two of our pages showing for one query are flagged", () => {
  const out = summariseQueries({
    queryPages28: [
      row(["alia saree", `${site}/outfits/alia-red-saree`], 0, 20, 15),
      row(["alia saree", `${site}/celebrities/alia-bhatt`], 0, 8, 30),
      row(["solo", `${site}/outfits/solo`], 0, 8, 30),
    ],
    queries7: [],
    queriesBefore: [],
    pages7: [],
    pagesPrev7: [],
  });
  assert.deepEqual(out.shared, [{ query: "alia saree", paths: ["/celebrities/alia-bhatt", "/outfits/alia-red-saree"] }]);
  // Position is weighted by impressions across the two pages: (15*20 + 30*8) / 28
  assert.equal(out.top.find((q) => q.query === "alia saree").position, 19.3);
});
