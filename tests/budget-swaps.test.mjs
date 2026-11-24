import test from "node:test";
import assert from "node:assert/strict";
import { parseBudgetSwaps } from "@/lib/validation";
import { budgetSwapsOf, budgetSwapsText, budgetTier } from "@/lib/types";
import { runLinkCheck } from "@/lib/link-check";
import { keepBudgetSwapStatus } from "@/lib/budget-swaps";

test("the editor box reads Brand | price | link, with rupee signs and commas", () => {
  const { swaps, errors } = parseBudgetSwaps("Libas | ₹999 | https://libas.test/a\n\n  W | 2,299 | https://w.test/b  ");
  assert.deepEqual(errors, []);
  assert.deepEqual(swaps.map((s) => [s.brand, s.price, s.link.url, s.link.status]), [
    ["Libas", 999, "https://libas.test/a", "unverified"],
    ["W", 2299, "https://w.test/b", "unverified"],
  ]);
  assert.equal(budgetSwapsText(swaps), "Libas | 999 | https://libas.test/a\nW | 2299 | https://w.test/b");
});

test("bad lines say what is wrong", () => {
  const { errors } = parseBudgetSwaps("Libas 999 https://x.test\nA | free | https://x.test\nB | 7000 | https://x.test\nC | 500 | x.test");
  assert.equal(errors.length, 4);
  assert.match(errors[0], /Line 1: write it as Brand \| price \| link/);
  assert.match(errors[1], /whole number/);
  assert.match(errors[2], /above ₹5,000/);
  assert.match(errors[3], /http/);
  assert.match(parseBudgetSwaps(["a", "b", "c", "d"].map((b) => `${b} | 100 | https://x.test/${b}`).join("\n")).errors[0], /At most 3/);
});

test("bands: under 1,000 / 2,500 / 5,000, cheapest first", () => {
  assert.equal(budgetTier(999), 1000);
  assert.equal(budgetTier(1000), 1000);
  assert.equal(budgetTier(1001), 2500);
  assert.equal(budgetTier(5000), 5000);
  assert.equal(budgetTier(5001), null);
  const link = (url) => ({ retailer: "R", url, network: "none", status: "ok" });
  assert.deepEqual(
    budgetSwapsOf({ budgetSwaps: [{ brand: "B", price: 2400, link: link("https://b") }, { brand: "A", price: 800, link: link("https://a") }] }).map((s) => s.brand),
    ["A", "B"],
  );
});

test("a save keeps what the link check learned about an unchanged budget link", () => {
  const before = [{ id: "p1", name: "Saree", budgetSwaps: [{ brand: "A", price: 800, link: { retailer: "Libas", url: "https://a", network: "none", status: "sold_out", checkedAt: "2026-11-30" } }] }];
  const posted = [{ id: "p1", name: "Saree", budgetSwaps: [
    { brand: "A", price: 850, link: { retailer: "a", url: "https://a", network: "none", status: "unverified" } },
    { brand: "B", price: 2000, link: { retailer: "b", url: "https://b", network: "none", status: "unverified" } },
  ] }];
  const [item] = keepBudgetSwapStatus(posted, before);
  assert.deepEqual(item.budgetSwaps[0], { brand: "A", price: 850, link: { retailer: "Libas", url: "https://a", network: "none", status: "sold_out", checkedAt: "2026-11-30" } });
  assert.equal(item.budgetSwaps[1].link.status, "unverified");
});

test("the weekly check reads budget links too, and names them in a change", async () => {
  const outfits = [{ id: 9, celebrity: "Kiara", event: "Promo", items: [{ name: "Saree", budgetSwaps: [{ brand: "A", price: 800, link: { retailer: "R", url: "https://a.test/x", network: "none", status: "ok", checkedAt: "2026-11-01" } }] }] }];
  const run = await runLinkCheck(outfits, { check: async () => ({ status: "dead", reason: "HTTP 404" }), sleep: async () => {}, today: "2026-11-30" });
  assert.equal(run.checked, 1);
  assert.equal(run.changes[0].piece, "Saree (₹800 swap)");
  assert.equal(run.updates[0].items[0].budgetSwaps[0].link.status, "dead");
  assert.equal(run.updates[0].items[0].budgetSwaps[0].link.checkedAt, "2026-11-30");
  // The input is not mutated.
  assert.equal(outfits[0].items[0].budgetSwaps[0].link.status, "ok");
});
