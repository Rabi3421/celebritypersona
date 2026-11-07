// Run with: npm test   (node --test tests/*.test.mjs)
// Node 24 strips the types from the imported .ts module; no extra dependencies.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isPostHogEnabled,
  isExcludedPath,
  isExtensionNoise,
  localTestFlag,
  pathOf,
  redactServerText,
  redactText,
  sanitizeProperties,
  sanitizeUrl,
} from "../lib/posthog/privacy.ts";

test("test flag: honoured locally, never on Vercel", () => {
  assert.equal(localTestFlag("1", undefined), "1");
  assert.equal(localTestFlag("1", ""), "1");
  assert.equal(localTestFlag("1", "1"), "", "set by mistake in Vercel: ignored");
  assert.equal(localTestFlag("", undefined), "");
  assert.equal(localTestFlag("true", undefined), "", "only the exact value 1");
  assert.equal(localTestFlag(undefined, undefined), "");
});

// A realistic worst case for a server error message.
const NASTY = [
  "MongoServerError: auth failed for mongodb+srv://celebuser:S3cr3t%21@cluster0.abcd.mongodb.net/prod?retryWrites=true&w=majority",
  "while handling GET https://www.celebritypersona.com/api/unsubscribe?token=tok_9f8e7d&email=reader%40example.com#frag",
  "and /api/subscribe/confirm?token=abc123&x=1 for reader@example.com",
  "Authorization: Bearer sk_live_51HxYz.abc-def",
  "jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
  'config {"password":"hunter2", api_key=AKIA123456, session: s%3Aabc.def, client_secret="xyz"}',
].join("\n");
const SECRETS = ["celebuser", "S3cr3t", "tok_9f8e7d", "reader@example.com", "reader%40example.com", "abc123", "sk_live_51HxYz", "eyJhbGciOiJIUzI1NiJ9", "hunter2", "AKIA123456", "s%3Aabc", "xyz", "retryWrites", "#frag"];

test("server text: credentials, tokens, emails, secrets and every query string are removed", () => {
  const out = redactServerText(NASTY);
  for (const secret of SECRETS) assert.ok(!out.includes(secret), `leaked: ${secret}\n${out}`);
  assert.match(out, /mongodb\+srv:\/\/\[redacted\]@cluster0\.abcd\.mongodb\.net\/prod(\s|$)/);
  assert.match(out, /https:\/\/www\.celebritypersona\.com\/api\/unsubscribe(\s|$)/, "URL kept, query dropped");
  assert.match(out, /\/api\/subscribe\/confirm for \[redacted\]/, "relative path kept, query dropped");
  assert.match(out, /Authorization: \[redacted\]/);
});

test("browser text: the same secrets are removed; ordinary query values in URLs survive", () => {
  const out = redactText(NASTY + "\nsee https://www.celebritypersona.com/search?q=red%20saree&page=2");
  for (const secret of SECRETS.filter((s) => s !== "retryWrites")) assert.ok(!out.includes(secret), `leaked: ${secret}`);
  assert.match(out, /search\?q=red(\+|%20)saree&page=2/);
});

test("server-mode properties: nested exception text and URL keys lose queries and secrets", () => {
  const event = {
    $exception_list: [{ type: "Error", value: NASTY, stacktrace: { frames: [{ filename: "/var/task/.next/server/app/page.js", lineno: 3 }] } }],
    path: "/api/unsubscribe?token=abc",
    $current_url: "https://x.test/a?email=a@b.co",
    digest: "1793929643",
  };
  const out = sanitizeProperties(event, "", "server");
  const text = JSON.stringify(out);
  for (const secret of [...SECRETS, "a@b.co", "token=abc"]) assert.ok(!text.includes(secret), `leaked: ${secret}`);
  assert.equal(out.path, "/api/unsubscribe");
  assert.equal(out.$current_url, "https://x.test/a");
  assert.equal(out.digest, "1793929643", "digests survive");
  assert.equal(out.$exception_list[0].stacktrace.frames[0].filename, "/var/task/.next/server/app/page.js");
});

test("ordinary error text is left readable", () => {
  const msg = "TypeError: Cannot read properties of undefined (reading 'items') at OutfitDetail (/var/task/.next/server/chunks/12.js:1:2345)";
  assert.equal(redactServerText(msg), msg);
  assert.equal(redactText("Each child in a list should have a unique \"key\" prop."), "Each child in a list should have a unique \"key\" prop.");
});

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
