// Run with: npm test   (node --test tests/*.test.mjs)
// Node 24 strips the types from the imported .ts module; no extra dependencies.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isPostHogEnabled,
  isExcludedPath,
  isExtensionNoise,
  pathOf,
  redactText,
  sanitizeProperties,
  sanitizeUrl,
} from "../lib/posthog/privacy.ts";

test("gating: only Production with a key, or an explicit local test, enables PostHog", () => {
  assert.equal(isPostHogEnabled("phc_x", "production", ""), true);
  assert.equal(isPostHogEnabled("phc_x", "preview", ""), false, "preview deployments never send");
  assert.equal(isPostHogEnabled("phc_x", "development", ""), false);
  assert.equal(isPostHogEnabled("phc_x", "local", ""), false, "ordinary local builds never send");
  assert.equal(isPostHogEnabled("phc_x", undefined, undefined), false);
  assert.equal(isPostHogEnabled("phc_x", "local", "1"), true, "explicit local test");
  assert.equal(isPostHogEnabled("phc_x", "preview", "1"), true, "the flag is honoured wherever it is set, so it must never be set in Vercel");
  assert.equal(isPostHogEnabled("", "production", ""), false, "no key, nothing");
  assert.equal(isPostHogEnabled("   ", "production", "1"), false);
  assert.equal(isPostHogEnabled(undefined, "production", ""), false);
});

test("the panel, its API and its sign-in page are excluded; public pages are not", () => {
  for (const path of ["/admin", "/admin/", "/admin/login", "/admin/outfits/12", "/api/admin", "/api/admin/session"]) {
    assert.equal(isExcludedPath(path), true, path);
  }
  for (const path of ["/", "/administrator-style", "/outfits/admin-look", "/api/subscribe/confirm", "/adminx", "/celebrities"]) {
    assert.equal(isExcludedPath(path), false, path);
  }
});

test("sensitive query parameters are redacted whatever their value", () => {
  const out = sanitizeUrl("https://www.celebritypersona.com/api/unsubscribe?token=abc123&email=a%40b.com&access_token=x&user-email=y&sig=z");
  const url = new URL(out);
  for (const name of ["token", "email", "access_token", "user-email", "sig"]) assert.equal(url.searchParams.get(name), "[redacted]", name);
});

test("ordinary parameters survive, including words that merely contain a sensitive word", () => {
  const out = new URL(sanitizeUrl("https://x.test/search?q=alia%20bhatt&design=red&author=rabi&page=2&utm_source=news"));
  assert.equal(out.searchParams.get("q"), "alia bhatt");
  assert.equal(out.searchParams.get("design"), "red");
  assert.equal(out.searchParams.get("author"), "rabi");
  assert.equal(out.searchParams.get("page"), "2");
  assert.equal(out.searchParams.get("utm_source"), "news");
});

test("emails and phone numbers inside ordinary query values are removed", () => {
  const out = new URL(sanitizeUrl("https://x.test/search?q=me%40example.com&ref=call%20%2B91%2098765%2043210&id=12345"));
  assert.equal(out.searchParams.get("q"), "[redacted]");
  assert.equal(out.searchParams.get("ref"), "call [redacted]");
  assert.equal(out.searchParams.get("id"), "12345", "short numbers are not phone numbers");
});

test("fragments are dropped and emails in paths removed; relative URLs stay relative", () => {
  assert.equal(sanitizeUrl("https://x.test/page#access_token=abc"), "https://x.test/page");
  assert.equal(sanitizeUrl("/u/me@example.com/settings"), "/u/[redacted]/settings");
  assert.equal(sanitizeUrl("/outfits/look-2026-11-05-1234567?x=1"), "/outfits/look-2026-11-05-1234567?x=1", "dates and IDs in slugs are kept");
  assert.equal(sanitizeUrl(""), "");
});

test("free text loses emails but keeps numbers such as error digests", () => {
  assert.equal(redactText("Failed for a.b@example.co.in at step 2"), "Failed for [redacted] at step 2");
  assert.equal(redactText("digest 1793929643123"), "digest 1793929643123");
});

test("properties: URL-like keys are sanitized, nested text loses emails, other values unchanged", () => {
  const out = sanitizeProperties({
    $current_url: "https://x.test/a?token=1",
    $referrer: "https://mail.example/?email=a@b.co",
    $initial_current_url: "https://x.test/?code=9",
    outfit_id: "alia-in-red",
    result_count: 3,
    $exception_list: [{ value: "No user bob@example.com", stacktrace: { frames: [{ filename: "https://x.test/_next/a.js", lineno: 10 }] } }],
  });
  assert.equal(new URL(out.$current_url).searchParams.get("token"), "[redacted]");
  assert.equal(new URL(out.$referrer).searchParams.get("email"), "[redacted]");
  assert.equal(new URL(out.$initial_current_url).searchParams.get("code"), "[redacted]");
  assert.equal(out.outfit_id, "alia-in-red");
  assert.equal(out.result_count, 3);
  assert.equal(out.$exception_list[0].value, "No user [redacted]");
  assert.equal(out.$exception_list[0].stacktrace.frames[0].lineno, 10);
});

test("pathOf handles absolute, relative and empty values", () => {
  assert.equal(pathOf("https://x.test/admin/login?from=/x"), "/admin/login");
  assert.equal(pathOf("/admin?x=1"), "/admin");
  assert.equal(pathOf(undefined), "");
});

test("exceptions thrown only from browser extensions are noise; ours are not", () => {
  const frames = (...files) => ({ $exception_list: [{ stacktrace: { frames: files.map((filename) => ({ filename })) } }] });
  assert.equal(isExtensionNoise(frames("chrome-extension://abc/content.js")), true);
  assert.equal(isExtensionNoise(frames("chrome-extension://abc/x.js", "https://www.celebritypersona.com/_next/a.js")), false);
  assert.equal(isExtensionNoise(frames("https://www.celebritypersona.com/_next/a.js")), false);
  assert.equal(isExtensionNoise({}), false);
});
