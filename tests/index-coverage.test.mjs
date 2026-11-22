import test from "node:test";
import assert from "node:assert/strict";
import { summariseCoverage } from "@/lib/report/index-coverage";

const B = "https://www.celebritypersona.com";

test("coverage counts indexed pages, lists looks still waiting and pages that need a recrawl", () => {
  const summary = summariseCoverage(
    [
      { url: `${B}/`, coverage: "Submitted and indexed", lastCrawl: "2026-11-18" },
      { url: `${B}/outfits`, coverage: "Submitted and indexed", lastCrawl: "2026-11-02" },
      { url: `${B}/outfits/a-look`, coverage: "Discovered - currently not indexed", lastCrawl: null },
      { url: `${B}/outfits/b-look`, coverage: "URL is unknown to Google", lastCrawl: null },
      { url: `${B}/celebrities`, coverage: "Blocked due to other 4xx issue", lastCrawl: "2026-10-25" },
    ],
    { last7: { clicks: 1, impressions: 11 }, prev7: { clicks: 0, impressions: 4 } },
    0,
    new Date("2026-11-23T04:00:00Z"),
  );
  assert.equal(summary.total, 5);
  assert.equal(summary.indexed, 2);
  assert.deepEqual(summary.indexedPaths, ["/", "/outfits"]);
  assert.deepEqual(summary.looksWaiting, ["/outfits/a-look", "/outfits/b-look"]);
  assert.deepEqual(summary.problems, [{ path: "/celebrities", coverage: "Blocked due to other 4xx issue", lastCrawl: "2026-10-25" }]);
  assert.equal(summary.states["Discovered - currently not indexed"], 1);
});
