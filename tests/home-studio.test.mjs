// Homepage Studio logic (lib/home-studio.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dirtySections,
  duplicateNumbers,
  inSequence,
  isSitePath,
  moveItem,
  previewMessage,
  sectionOfError,
  sequenceNumber,
  STUDIO_SECTIONS,
} from "../lib/home-studio.ts";
import { homeContentSchema } from "../lib/validation.ts";

const home = () => ({
  showStats: false,
  swapSteps: [{ n: "01", title: "Identify", body: "By hand." }, { n: "02", title: "Swap", body: "Closest match." }],
  trustPoints: [{ n: "01", title: "A person", body: "Not a scraper." }],
  campaign: { eyebrow: "Wedding season", title: "Six weeks", body: "decoded.", cta: "Open →", href: "/occasions" },
});

test("sections: the public order, and only the automatic one is read-only", () => {
  assert.deepEqual(STUDIO_SECTIONS.map((s) => s.id), ["automatic", "counters", "steps", "campaign", "trust"]);
  assert.deepEqual(STUDIO_SECTIONS.filter((s) => !s.editable).map((s) => s.id), ["automatic"]);
});

test("save errors land in the right section; form-wide messages in none", () => {
  assert.equal(sectionOfError("campaign.href"), "campaign");
  assert.equal(sectionOfError("swapSteps"), "steps");
  assert.equal(sectionOfError("swapSteps.1.title"), "steps");
  assert.equal(sectionOfError("trustPoints.0.body"), "trust");
  assert.equal(sectionOfError("showStats"), "counters");
  assert.equal(sectionOfError("form"), null);
  // Every key the real schema can produce maps to a section.
  const bad = homeContentSchema.safeParse({ showStats: false, swapSteps: [{ n: "", title: "", body: "" }], trustPoints: [], campaign: { eyebrow: "", title: "", body: "", cta: "", href: "occasions" } });
  assert.equal(bad.success, false);
  for (const issue of bad.error.issues) assert.ok(sectionOfError(issue.path.join(".")), issue.path.join("."));
});

test("unsaved changes are tracked per section", () => {
  const saved = home();
  assert.equal(dirtySections(saved, home()).size, 0);
  assert.deepEqual([...dirtySections(saved, { ...home(), showStats: true })], ["counters"]);
  assert.deepEqual([...dirtySections(saved, { ...home(), campaign: { ...home().campaign, cta: "Go" } })], ["campaign"]);
  const reordered = { ...home(), swapSteps: moveItem(home().swapSteps, 0, 1) };
  assert.deepEqual([...dirtySections(saved, reordered)], ["steps"], "a reorder is a change");
  assert.deepEqual([...dirtySections({ ...saved, showStats: undefined }, saved)], [], "absent and false are the same setting");
});

test("list operations: move, renumber check, duplicate numbers", () => {
  const list = [{ n: "01" }, { n: "02" }, { n: "03" }];
  assert.deepEqual(moveItem(list, 2, 0).map((i) => i.n), ["03", "01", "02"]);
  assert.deepEqual(moveItem(list, 0, 5).map((i) => i.n), ["01", "02", "03"], "out of range is a no-op");
  assert.equal(inSequence(list), true);
  assert.equal(inSequence(moveItem(list, 0, 1)), false);
  assert.equal(sequenceNumber(9), "10");
  assert.deepEqual(duplicateNumbers([{ n: "01" }, { n: "02" }, { n: " 01 " }]), ["01"]);
});

test("the campaign link check agrees with the save's own rule", () => {
  for (const href of ["/occasions", "/occasions/wedding?x=1", "/", "//evil.example", "https://example.com", "occasions", " /spaced", ""]) {
    const schema = homeContentSchema.safeParse({ ...home(), campaign: { ...home().campaign, href } });
    assert.equal(isSitePath(href), schema.success, href);
  }
});

test("the preview accepts only the expected shape, as plain capped text", () => {
  assert.equal(previewMessage(null), null);
  assert.equal(previewMessage({ type: "other", section: "trust", content: home() }), null);
  assert.equal(previewMessage({ type: "cp-home-preview", section: "admin", content: home() }), null, "unknown section");
  const m = previewMessage({ type: "cp-home-preview", section: "trust", content: { ...home(), trustPoints: [{ n: 1, title: { toString: () => "x" }, body: "<img src=x onerror=alert(1)>" }], extra: "ignored" } });
  assert.deepEqual(m.content.trustPoints, [{ n: "", title: "", body: "<img src=x onerror=alert(1)>" }], "non-strings become empty; markup stays inert text for React");
  assert.equal("extra" in m.content, false);
  const big = previewMessage({ type: "cp-home-preview", section: "steps", content: { ...home(), swapSteps: Array.from({ length: 100 }, () => ({ n: "1", title: "x".repeat(5000), body: "" })) } });
  assert.equal(big.content.swapSteps.length, 24);
  assert.equal(big.content.swapSteps[0].title.length, 2000);
});
