import test from "node:test";
import assert from "node:assert/strict";
import { jsonLd, scriptJson } from "@/lib/seo";

const payloads = [
  "</script><script>alert(1)</script>",
  "</SCRIPT><img src=x onerror=alert(1)>",
  "<!-- <script>",
  "]]><svg onload=alert(1)>",
  "a & b > c < d",
];

test("nothing in the data can end the script element", () => {
  for (const text of payloads) {
    const out = jsonLd([{ "@type": "FAQPage", text }]);
    assert.doesNotMatch(out, /<|>/, `raw angle bracket survived: ${text}`);
    assert.doesNotMatch(out, /<\/script/i);
  }
});

test("the JSON value is unchanged: it parses back to exactly the input", () => {
  const value = {
    name: "Kiara Advani's red saree — ₹1,30,100 & a ₹999 swap",
    unicode: "Café naïve 日本語 emoji 👗 ✨",
    separators: `line${String.fromCharCode(0x2028)}para${String.fromCharCode(0x2029)}end`,
    quotes: `"double" quote and a \ backslash`,
    html: payloads,
    nested: [{ n: 1, ok: true, nothing: null }],
  };
  const out = scriptJson(value);
  assert.deepEqual(JSON.parse(out), value);
  assert.ok(!out.includes(String.fromCharCode(0x2028)) && !out.includes(String.fromCharCode(0x2029)), "line separators are escaped");
  assert.ok(out.includes("\\u2028") && out.includes("\\u2029"));
});

test("ordinary text stays readable and the schema context is kept", () => {
  const out = jsonLd([{ "@type": "Person", name: "Alia Bhatt" }]);
  assert.equal(out, '{"@context":"https://schema.org","@graph":[{"@type":"Person","name":"Alia Bhatt"}]}');
  assert.equal(scriptJson(undefined), "null");
});
