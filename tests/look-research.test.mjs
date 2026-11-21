import test from "node:test";
import assert from "node:assert/strict";
import { extractJson, freeSlug, researchSchema, researchToOutfitInput } from "@/lib/look-research";
import { outfitSchema } from "@/lib/validation";

const good = () => ({
  celebrity: "Example Star",
  event: "Film promotions in Mumbai",
  occasion: "Promotions",
  occasions: ["Party"],
  date: "2026-11-18",
  slug: "example-star-black-midi-dress-promotions",
  seoTitle: "Example Star's black midi dress: price and swap",
  seoDescription: "The exact black midi dress Example Star wore to promotions, its ₹12,999 price, and a ₹2,499 swap that gives the same look.",
  primaryKeyword: "example star black midi dress",
  secondaryKeywords: ["example star promotions outfit"],
  notes: [
    "Example Star wore a black midi dress from Label Example to the film's Mumbai promotions on 18 November 2026.",
    "The dress costs ₹12,999; a similar cut from High Street Example costs ₹2,499 and keeps the square neck and the midi length.",
  ],
  faqs: [{ question: "What dress did Example Star wear to the promotions?", answer: "A black square-neck midi dress by Label Example, priced at ₹12,999." }],
  photoCredit: "Instagram / @examplestar",
  photoAlt: "Example Star in a black square-neck midi dress at film promotions in Mumbai",
  items: [
    {
      name: "Square-neck midi dress",
      category: "dress",
      colours: ["black"],
      wornBrand: "Label Example",
      worn: 12999,
      wornUrl: "https://label.example.com/products/square-neck-midi",
      swapBrand: "High Street Example",
      swap: 2499,
      swapUrl: "https://shop.example.in/p/midi-dress-black",
      note: "Crepe, fitted through the bodice; wear it with block heels.",
    },
    {
      name: "Gold hoop earrings",
      category: "earrings",
      colours: [],
      wornBrand: null,
      worn: null,
      wornUrl: null,
      swapBrand: null,
      swap: null,
      swapUrl: null,
      note: null,
    },
  ],
  evidence: [{ claim: "Worn to the Mumbai promotions on 18 Nov 2026", sources: ["https://news.example.com/star-promotions"], confidence: "confirmed" }],
  checks: ["Earrings not identified; confirm or remove the piece."],
});

test("good research becomes a draft the editor's own validation accepts", () => {
  const research = researchSchema.parse(good());
  const input = researchToOutfitInput(research, { url: "https://firebasestorage.googleapis.com/v0/b/x/o/a?alt=media&token=1", path: "outfits/a/a-1-0a1b2c3d.webp" });
  const parsed = outfitSchema.safeParse(input);
  assert.ok(parsed.success, JSON.stringify(parsed.error?.issues));
  assert.equal(parsed.data.status, "draft", "the runner can only ever make drafts");
  assert.equal(parsed.data.images[0].alt, research.photoAlt);
  assert.equal(parsed.data.items.length, 2);
});

test("research cannot ask to publish, and unknown fields are dropped", () => {
  const input = researchToOutfitInput(researchSchema.parse({ ...good(), status: "published" }), undefined);
  assert.equal(input.status, "draft");
  assert.deepEqual(input.images, []);
});

test("invented or malformed facts are refused", () => {
  const fails = (change) => !researchSchema.safeParse({ ...good(), ...change(good()) }).success;
  assert.ok(fails(() => ({ date: "18 Nov 2026" })), "date format");
  assert.ok(fails((g) => ({ items: [{ ...g.items[0], worn: 12999.5 }] })), "fractional rupees");
  assert.ok(fails((g) => ({ items: [{ ...g.items[0], worn: "₹12,999" }] })), "price as text");
  assert.ok(fails((g) => ({ items: [{ ...g.items[0], wornUrl: "http://label.example.com/x" }] })), "non-https link");
  assert.ok(fails((g) => ({ items: [{ ...g.items[0], category: "onesie" }] })), "category off the list");
  assert.ok(fails((g) => ({ items: [{ ...g.items[0], colours: ["blackish"] }] })), "colour off the list");
  assert.ok(fails(() => ({ evidence: [] })), "no evidence at all");
  assert.ok(fails(() => ({ notes: ["Too short."] })), "thin write-up");
  assert.ok(fails(() => ({ seoTitle: "x".repeat(61) })), "title too long");
});

test("a taken slug gets the next free number", () => {
  assert.equal(freeSlug("a-look", ["b"]), "a-look");
  assert.equal(freeSlug("a-look", ["a-look", "a-look-2"]), "a-look-3");
});

test("the JSON is found in a bare or fenced reply", () => {
  assert.deepEqual(extractJson('Here you go:\n```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('{"a":{"b":2}}'), { a: { b: 2 } });
  assert.throws(() => extractJson("I could not find it."));
});
