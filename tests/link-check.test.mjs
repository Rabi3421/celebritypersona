import test from "node:test";
import assert from "node:assert/strict";
import { checkLink, nextStatus, runLinkCheck, statusFromHtml } from "@/lib/link-check";

const ld = (availability) => `<script type="application/ld+json">${JSON.stringify({ offers: [{ availability }] })}</script>`;

test("only the page's own structured data says sold out", () => {
  assert.equal(statusFromHtml(ld("https://schema.org/OutOfStock")).status, "sold_out");
  assert.equal(statusFromHtml(ld("https://schema.org/InStock")).status, "ok");
  // Shopify button labels on every page are not a signal.
  assert.equal(statusFromHtml(`<button>Sold Out</button> productFormSoldOut: "Sold Out"`).status, "ok");
});

test("404 is dead, 403 tells us nothing", async () => {
  const fake = (status, body = "") => async () => new Response(body, { status });
  assert.equal((await checkLink("https://shop.test/a", fake(404))).status, "dead");
  assert.equal((await checkLink("https://shop.test/a", fake(410))).status, "dead");
  assert.equal((await checkLink("https://shop.test/a", fake(403))).status, "unverified");
  assert.equal((await checkLink("https://shop.test/a", async () => { throw new Error("x"); })).status, "unverified");
  assert.equal((await checkLink("https://shop.test/a", fake(200, ld("OutOfStock")))).status, "sold_out");
});

test("a blocked check never overwrites a status that was established", () => {
  const blocked = { status: "unverified", reason: "HTTP 403" };
  assert.equal(nextStatus("ok", blocked), "ok");
  assert.equal(nextStatus("dead", blocked), "dead");
  assert.equal(nextStatus("sold_out", blocked), "sold_out");
  assert.equal(nextStatus("pending", blocked), "unverified");
  assert.equal(nextStatus(undefined, blocked), "unverified");
  assert.equal(nextStatus("ok", { status: "dead", reason: "HTTP 404" }), "dead");
});

const link = (url, status, checkedAt) => ({ retailer: "Shop", url, network: "none", status, checkedAt });
const outfits = () => [
  {
    id: 1,
    celebrity: "Kiara Advani",
    event: "Promo",
    items: [
      { name: "Red saree", wornLink: link("https://a.test/saree", "ok", "2026-11-01"), swapLink: link("https://b.test/swap", "ok", "2026-11-10") },
      { name: "Earrings" },
    ],
  },
  { id: 2, celebrity: "Alia Bhatt", event: "Airport", items: [{ name: "Jacket", wornLink: link("https://c.test/j", "ok", "2026-10-01") }] },
];

test("a run records what changed and leaves blocked links alone", async () => {
  const answers = { "https://a.test/saree": { status: "dead", reason: "HTTP 404" }, "https://b.test/swap": { status: "unverified", reason: "HTTP 403" }, "https://c.test/j": { status: "ok", reason: "HTTP 200" } };
  const run = await runLinkCheck(outfits(), { check: async (url) => answers[url], sleep: async () => {}, today: "2026-11-30" });
  assert.equal(run.checked, 3);
  assert.deepEqual(run.changes.map((c) => [c.outfitId, c.piece, c.side, c.from, c.to]), [[1, "Red saree", "original", "ok", "dead"]]);
  const one = run.updates.find((u) => u.id === 1);
  assert.equal(one.moved, true);
  assert.deepEqual(one.items[0].wornLink, { ...link("https://a.test/saree", "dead", "2026-11-30") });
  // Blocked: status and checked date both kept.
  assert.deepEqual(one.items[0].swapLink, link("https://b.test/swap", "ok", "2026-11-10"));
  assert.deepEqual(one.items[1], { name: "Earrings" });
  assert.equal(run.updates.find((u) => u.id === 2).moved, false);
});

test("a run out of time checks the stalest links first and skips the rest", async () => {
  let clock = 0;
  const seen = [];
  const run = await runLinkCheck(outfits(), {
    check: async (url) => { seen.push(url); clock += 1000; return { status: "ok", reason: "HTTP 200" }; },
    sleep: async () => {},
    now: () => clock,
    budgetMs: 1500,
  });
  assert.deepEqual(seen, ["https://c.test/j", "https://a.test/saree"]);
  assert.equal(run.skipped, 1);
});
