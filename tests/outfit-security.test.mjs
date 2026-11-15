import { test } from "node:test";
import assert from "node:assert/strict";
import { isSameOriginAdminRequest } from "../lib/admin-request.ts";
import { assertImportEnvironment } from "../lib/db/imported-outfits.ts";
import { parseResearch } from "../lib/outfit-research.ts";
import { jsonLd } from "../lib/seo.ts";
import { researchFixture } from "./outfit-research-fixtures.mjs";
import { readFileSync } from "node:fs";

test("security: browser mutations reject cross-origin, null and missing origins", () => {
  const check = (over) => isSameOriginAdminRequest(new Headers({ host: "admin.example.test", origin: "https://admin.example.test", ...over }));
  assert.equal(check({}), true);
  for (const origin of ["https://evil.test", "null", "", "https://admin.example.test.evil.test", "https://admin.example.test/path", "https://admin.example.test:444"]) assert.equal(check({ origin }), false, origin);
  assert.equal(check({ "sec-fetch-site": "cross-site" }), false);
  assert.equal(check({ host: "internal:3000", "x-forwarded-host": "admin.example.test" }), true);
});
test("security: remote import persistence is disabled until approved production opt-in", () => {
  const env = { NODE_ENV: "production", MONGODB_URI: "mongodb+srv://cluster.example.mongodb.net/" };
  assert.throws(() => assertImportEnvironment(env), /disabled/);
  assert.throws(() => assertImportEnvironment({ ...env, VERCEL_ENV: "production" }), /disabled/);
  assert.doesNotThrow(() => assertImportEnvironment({ ...env, VERCEL_ENV: "production", CP_OUTFIT_IMPORT_WRITES: "enabled" }));
  assert.throws(() => assertImportEnvironment({ ...env, VERCEL_ENV: "preview", CP_OUTFIT_IMPORT_WRITES: "enabled" }), /preview/);
  assert.doesNotThrow(() => assertImportEnvironment({ NODE_ENV: "production", MONGODB_URI: "mongodb://127.0.0.1:27017" }));
});
test("security: imported JSON is bounded before schema work and errors are bounded", () => {
  const r = researchFixture();
  r.sources = Array.from({ length: 3000 }, () => null);
  assert.throws(() => parseResearch(JSON.stringify(r)), /complex|oversized/);
  let nested = null;
  for (let i = 0; i < 20; i++) nested = { next: nested };
  assert.throws(() => parseResearch(JSON.stringify(nested)), /complex/);
  assert.throws(() => parseResearch(JSON.stringify({ unexpected: "x".repeat(1000) })), (e) => e.message.length < 5000);
  const malformed = researchFixture(); malformed.inputs.productUrl = "not a URL";
  assert.throws(() => parseResearch(JSON.stringify(malformed)), /productUrl/);
});
test("security: imported executable markup cannot close the JSON-LD script", () => {
  const attack = '</script><script>globalThis.__OUTFIT_XSS__=1</script><img src=x onerror="alert(1)">';
  const text = jsonLd([{ "@type": "Article", headline: attack }]);
  assert.equal(text.includes("<"), false);
  assert.equal(JSON.parse(text)["@graph"][0].headline, attack, "escaped serialization preserves factual content");
});
test("security: save authenticates and checks request origin before catalog reads", () => {
  const source = readFileSync(new URL("../app/admin/(panel)/outfits/actions.ts", import.meta.url), "utf8");
  const action = source.slice(source.indexOf("export async function saveOutfit"));
  assert.ok(action.indexOf("if (!admin)") < action.indexOf("getOccasionViews()"));
  assert.ok(action.indexOf("isSameOriginAdminRequest") < action.indexOf("getOccasionViews()"));
});
