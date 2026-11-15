import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CLAIM_FIELDS, IMPORT_FIELDS, canonicalProduct, instagramPost, parseResearch, proposedFields, mergeResearch, researchDuplicates, validateDraft } from "../lib/outfit-research.ts";
import { importApproval } from "../lib/outfit-import-approval.ts";
import { assertImportEnvironment } from "../lib/db/imported-outfits.ts";
import { researchFixture, emptyDraft } from "./outfit-research-fixtures.mjs";
const parse = (r) => parseResearch(JSON.stringify(r), "2026-11-14");

test("research: valid post/reel canonicalization and malicious URLs", () => {
  assert.equal(instagramPost("https://instagram.com/reel/Abc_123/?igsh=tracking"), "https://www.instagram.com/p/Abc_123/");
  for (const url of ["http://instagram.com/p/abc", "https://instagram.com.evil.test/p/abc", "https://user:pass@instagram.com/p/abc", "https://instagram.com/stories/abc", "https://instagram.com/name", "javascript:alert(1)"]) assert.equal(instagramPost(url), null);
  for (const url of ["http://shop.test/x", "https://127.0.0.1/x", "https://localhost/x", "https://shop.internal/x", "https://user:pass@shop.test/x", "https://shop.test:8080/x"]) {
    const r = researchFixture(); r.inputs.productUrl = url; assert.throws(() => parse(r));
  }
  assert.equal(canonicalProduct("https://www.shop.test/p/?variant=blue&utm_source=x#frag"), "https://shop.test/p?variant=blue");
});
test("research: strict bounded JSON, evidence references, dates and unknown facts", () => {
  assert.equal(parse(researchFixture()).schema, "cp-outfit-research/1");
  for (const mutate of [r => r.claims.price.sourceIds = [], r => r.claims.brand.sourceIds = ["S9"], r => r.claims.outfitDate.value = "2026-02-30", r => r.sources[0].accessedAt = "2027-01-01", r => r.extra = "surprise", r => r.claims.photoCredit.value = "invented", r => r.seo.keywords[0].demand = "high", r => r.seo.notes = ["This will rank and deliver 1000 monthly searches"]]) {
    const r = researchFixture(); mutate(r); assert.throws(() => parse(r));
  }
  assert.throws(() => parseResearch('{"__proto__":{}}'));
  assert.throws(() => parseResearch("x".repeat(100001)));
  assert.throws(() => parseResearch("not json"));
  assert.deepEqual(Object.keys(parse(researchFixture()).claims), [...CLAIM_FIELDS]);
});
test("research: inaccessible Instagram and unknown dates never receive placeholders", () => {
  const r = researchFixture();
  for (const key of ["celebrity", "event", "outfitDate", "instagramPostDate"]) r.claims[key] = { value: null, status: "unknown", sourceIds: [], note: "Instagram unavailable; request caption or screenshot" };
  const fields = proposedFields(parse(r), false);
  assert.equal(fields.celebrity, ""); assert.equal(fields.date, ""); assert.equal(fields.event, "");
  assert.equal(validateDraft(mergeResearch(emptyDraft(), fields, IMPORT_FIELDS)).success, false);
});
test("research: original identity and prices require distinct verified evidence", () => {
  const r = researchFixture();
  r.claims.price.status = "inferred";
  assert.equal(proposedFields(parse(r), true).items[0].worn, "");
  r.claims.price.status = "verified"; r.claims.currency.value = "USD";
  assert.equal(proposedFields(parse(r), true).items[0].worn, "");
  r.claims.currency.value = "INR"; r.claims.price.value = "12000.50";
  assert.equal(proposedFields(parse(r), true).items[0].worn, "");
  r.claims.productMatch.value = "similar";
  assert.equal(proposedFields(parse(r), true).items[0].wornBrand, "");
  assert.equal(proposedFields(parse(r), true).items[0].wornUrl, "");
});
test("research: selected merge preserves images, unselected edits and repeated imports", () => {
  const current = { ...emptyDraft(), event: "Keep my event", images: [{ url: "https://photo.test/x", path: "dev/test/x", alt: "Keep", credit: "@test" }], items: [{ name: "Keep earrings", hotspotX: "25", hotspotY: "30" }] };
  const fields = proposedFields(parse(researchFixture()), false);
  const first = mergeResearch(current, fields, ["celebrity", "seoTitle"]);
  assert.equal(first.event, current.event); assert.deepEqual(first.images, current.images); assert.deepEqual(first.items, current.items);
  assert.deepEqual(mergeResearch(first, fields, ["celebrity", "seoTitle"]), first);
  assert.equal(validateDraft(mergeResearch(emptyDraft(), fields, IMPORT_FIELDS)).success, true, "image-free draft needs no invented photo credit");
});
test("research: duplicates distinguish same post, product reuse, similarity and slug conflicts", () => {
  const r = parse(researchFixture());
  const o = { id: 1, celebrity: "Test Person", event: "Other", date: "2026-01-01", slug: r.seo.slug, items: [{ name: "Saree", category: "saree", wornUrl: r.inputs.productUrl }], researchImport: { instagramUrl: r.inputs.instagramUrl, productUrl: r.inputs.productUrl } };
  const duplicate = researchDuplicates(r, [o])[0];
  assert.equal(duplicate.blocked, true); assert.equal(duplicate.reasons.length, 4);
  const legacy = researchDuplicates(r, [{ ...o, researchImport: undefined }])[0];
  assert.equal(legacy.blocked, false); assert.ok(legacy.reasons.includes("Same retailer product"));
});
test("research: new-draft approval required server-side; previews always refused", () => {
  const raw = JSON.stringify({ research: researchFixture(), approvedFields: ["celebrity"] });
  for (const values of [{ id: 1, status: "draft", confirmed: true }, { id: 0, status: "published", confirmed: true }, { id: 0, status: "draft", confirmed: false }]) assert.throws(() => importApproval(raw, values));
  assert.equal(importApproval(raw, { id: 0, status: "draft", confirmed: true }).approvedFields[0], "celebrity");
  assert.throws(() => assertImportEnvironment({ NODE_ENV: "production", VERCEL_ENV: "preview", MONGODB_URI: "mongodb://localhost:27017" }));
  assert.throws(() => assertImportEnvironment({ NODE_ENV: "development", MONGODB_URI: "mongodb+srv://remote.test" }));
});
test("research: preview has no persistence or automatic request capability", () => {
  const ui = readFileSync(new URL("../components/admin/OutfitResearchImport.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(ui, /\bfetch\(|saveOutfit\(|createOutfit\(|use server/);
});
