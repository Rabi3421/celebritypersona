// Run with: npm test   (node --test tests/*.test.mjs)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  cookieDomainsFor,
  isGoogleAnalyticsCookie,
  isPostHogStorageKey,
  parseConsent,
  serializeConsent,
} from "../lib/consent-core.ts";

test("nothing stored, or anything unreadable, is undecided", () => {
  for (const raw of [null, undefined, "", "yes", "{", "null", "[]", "{}", '{"analytics":"accepted"}']) {
    assert.equal(parseConsent(raw), "undecided", String(raw));
  }
});

test("accepted and rejected round-trip with a version and timestamp", () => {
  for (const choice of ["accepted", "rejected"]) {
    const raw = serializeConsent(choice, Date.parse("2026-11-07T10:00:00Z"));
    assert.deepEqual(JSON.parse(raw), { v: CONSENT_VERSION, analytics: choice, at: "2026-11-07T10:00:00.000Z" });
    assert.equal(parseConsent(raw), choice);
  }
});

test("an answer from another version, or an unknown value, asks again", () => {
  assert.equal(parseConsent(JSON.stringify({ v: CONSENT_VERSION + 1, analytics: "accepted" })), "undecided");
  assert.equal(parseConsent(JSON.stringify({ v: 0, analytics: "accepted" })), "undecided");
  assert.equal(parseConsent(JSON.stringify({ v: CONSENT_VERSION, analytics: "maybe" })), "undecided");
  assert.equal(parseConsent(JSON.stringify({ v: CONSENT_VERSION, analytics: "ACCEPTED" })), "undecided", "never guesses yes");
});

test("the storage key is stable", () => {
  assert.equal(CONSENT_STORAGE_KEY, "cp_analytics_consent");
});

test("Google Analytics cookies are recognised, and nothing else", () => {
  for (const name of ["_ga", "_ga_QT0P30DBHG", "_ga_ABC123"]) assert.equal(isGoogleAnalyticsCookie(name), true, name);
  for (const name of ["_gat", "_gid", "ga", "_ga_", "cp_admin_session", "_ga-x", "my_ga"]) assert.equal(isGoogleAnalyticsCookie(name), false, name);
});

test("PostHog storage keys are recognised; the consent record and saved looks are not", () => {
  for (const key of ["ph_phc_abc_posthog", "__ph_opt_in_out_phc_abc", "ph_phc_abc_window_id"]) assert.equal(isPostHogStorageKey(key), true, key);
  for (const key of ["cp_analytics_consent", "cp-saved-looks", "graph", "alpha_ph_x"]) assert.equal(isPostHogStorageKey(key), false, key);
});

test("cookie deletion covers the host and every parent domain gtag may have used", () => {
  assert.deepEqual(cookieDomainsFor("www.celebritypersona.com"), ["", ".www.celebritypersona.com", ".celebritypersona.com"]);
  assert.deepEqual(cookieDomainsFor("localhost"), [""]);
  assert.deepEqual(cookieDomainsFor("127.0.0.1"), [""]);
});
