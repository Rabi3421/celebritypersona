import test from "node:test";
import assert from "node:assert/strict";
import { seoChecks } from "@/lib/seo-checks";

const draft = (over) => ({
  primaryKeyword: "palak tiwari abhinav mishra outfit",
  seoTitle: "Palak Tiwari's Abhinav Mishra Outfit: Price and Swap",
  seoDescription: "Palak Tiwari's powder blue Abhinav Mishra outfit costs ₹5,20,000.",
  slug: "palak-tiwari-powder-blue-abhinav-mishra-franchesca",
  celebrity: "Palak Tiwari",
  event: "Instagram post",
  notes: ["Palak Tiwari wore an Abhinav Mishra outfit."],
  items: [],
  images: [],
  ...over,
});
const slugCheck = (d) => seoChecks(d, { owners: [] }).find((c) => c.id === "keyword-slug");

test("filler words like 'outfit' are not required in the address", () => {
  assert.equal(slugCheck(draft()).ok, true);
});

test("a real word of the keyword missing from the address still fails", () => {
  const check = slugCheck(draft({ slug: "palak-tiwari-powder-blue-franchesca" }));
  assert.equal(check.ok, false);
  assert.match(check.detail, /abhinav, mishra/);
  assert.doesNotMatch(check.detail, /outfit/);
});
