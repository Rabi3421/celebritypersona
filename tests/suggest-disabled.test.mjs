// The unofficial Google autocomplete is switched off: no outbound request, no client call.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("autocomplete: the route makes no outbound request and the form no longer calls it", () => {
  const route = readFileSync(new URL("../app/api/admin/suggest/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /fetch\(|suggestqueries|google\.com/);
  assert.match(route, /readSession\(\)/, "still signed-in only");
  const form = readFileSync(new URL("../components/admin/seo/KeywordSection.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(form, /\/api\/admin\/suggest/);
});
