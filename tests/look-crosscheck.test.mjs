import test from "node:test";
import assert from "node:assert/strict";
import { crosscheckSchema, mergeCrosscheck, withCheck } from "@/lib/look-crosscheck";
import { researchSchema } from "@/lib/look-research";

const research = () =>
  researchSchema.parse({
    celebrity: "Example Star",
    event: "Film promotions in Mumbai",
    occasion: "Promotions",
    occasions: [],
    date: "2026-11-18",
    slug: "example-star-black-midi-dress",
    seoTitle: "Example Star's black midi dress: price and swap",
    seoDescription: "The exact black midi dress Example Star wore to promotions, its ₹12,999 price, and a ₹2,499 swap that gives the same look.",
    primaryKeyword: "example star black midi dress",
    secondaryKeywords: ["example star promotions outfit"],
    notes: [
      "Example Star wore a black midi dress from Label Example to the film's Mumbai promotions on 18 November 2026.",
      "The dress costs ₹12,999; a similar cut from High Street Example costs ₹2,499 and keeps the square neck.",
    ],
    photoCredit: "Instagram / @examplestar",
    photoAlt: "Example Star in a black square-neck midi dress at film promotions",
    items: [
      {
        name: "Square-neck midi dress",
        category: "dress",
        colours: ["black"],
        wornBrand: "Label Example",
        worn: 12999,
        wornUrl: "https://label.example.com/products/midi",
        swapBrand: "High Street Example",
        swap: 2499,
        swapUrl: "https://shop.example.in/p/midi",
        note: null,
      },
    ],
    evidence: [
      { claim: "Worn to the Mumbai promotions on 18 Nov 2026", sources: ["https://news.example.com/a"], confidence: "confirmed" },
      { claim: "The swap costs ₹2,499", sources: ["https://shop.example.in/p/midi"], confidence: "confirmed" },
      { claim: "The dress is crepe", sources: [], confidence: "likely" },
    ],
    checks: ["Confirm the earrings."],
  });

test("a disputed fact loses its confidence and becomes the editor's first check", () => {
  const check = crosscheckSchema.parse({
    verdicts: [
      { claim: "worn to the mumbai promotions on 18 nov 2026", verdict: "agrees", note: "", sources: ["https://magazine.example.com/b"] },
      { claim: "The swap costs ₹2,499", verdict: "disagrees", note: "The shop lists it at ₹2,999", sources: ["https://shop.example.in/p/midi"] },
      { claim: "The dress is crepe", verdict: "cannot_check", note: "The page does not say", sources: [] },
    ],
    problems: ["The swap is out of stock in sizes S and M."],
  });
  const { research: merged, disputed, agreed } = mergeCrosscheck(research(), check);
  assert.equal(disputed, 1);
  assert.equal(agreed, 1);
  assert.equal(merged.evidence[0].confidence, "confirmed");
  assert.deepEqual(merged.evidence[0].sources, ["https://news.example.com/a", "https://magazine.example.com/b"], "agreement adds sources");
  assert.equal(merged.evidence[1].confidence, "unverified", "a dispute never leaves a fact confirmed");
  assert.equal(merged.evidence[2].confidence, "likely", "cannot_check changes nothing");
  assert.match(merged.checks[0], /^Codex disputes "The swap costs ₹2,499": The shop lists it at ₹2,999/);
  assert.equal(merged.checks[1], "Codex: The swap is out of stock in sizes S and M.");
  assert.equal(merged.checks[2], "Confirm the earrings.", "Claude's own checks stay");
});

test("Codex cannot raise a fact's confidence, invent facts, or smuggle in bad links", () => {
  const start = research();
  const check = crosscheckSchema.parse({
    verdicts: [
      { claim: "The dress is crepe", verdict: "agrees", note: "", sources: ["javascript:alert(1)", "http://insecure.example.com", "https://ok.example.com/c"] },
      { claim: "A claim Claude never made", verdict: "disagrees", note: "x", sources: [] },
    ],
    problems: [],
  });
  const { research: merged } = mergeCrosscheck(start, check);
  assert.equal(merged.evidence[2].confidence, "likely");
  assert.deepEqual(merged.evidence[2].sources, ["https://ok.example.com/c"]);
  assert.equal(merged.evidence.length, start.evidence.length);
  assert.deepEqual(merged.checks, start.checks, "an unmatched verdict adds nothing");
});

test("the check list stays within the site's limit", () => {
  const check = crosscheckSchema.parse({
    verdicts: [],
    problems: Array.from({ length: 10 }, (_, i) => `Problem number ${i + 1} worth a look.`),
  });
  const start = { ...research(), checks: Array.from({ length: 15 }, (_, i) => `Claude check ${i + 1}`) };
  const { research: merged } = mergeCrosscheck(start, check);
  assert.equal(merged.checks.length, 20);
  assert.ok(researchSchema.safeParse(merged).success);
  assert.equal(withCheck(merged, "One more check").checks.length, 20);
  assert.equal(withCheck(merged, "One more check").checks.at(-1), "One more check");
});
