import test from "node:test";
import assert from "node:assert/strict";
import { isStaffRequest, staffCookie, staffMarkFrom, STAFF_COOKIE } from "@/lib/staff";

test("a team browser is recognised from its cookie, among others", () => {
  assert.equal(isStaffRequest(`cp_consent=accepted; ${STAFF_COOKIE}=1; other=x`), true);
  assert.equal(isStaffRequest(`${STAFF_COOKIE}=1`), true);
});

test("readers, switched-off browsers and look-alike cookies are counted", () => {
  assert.equal(isStaffRequest(null), false);
  assert.equal(isStaffRequest(""), false);
  assert.equal(isStaffRequest("cp_consent=accepted"), false);
  assert.equal(isStaffRequest(`${STAFF_COOKIE}=off`), false);
  assert.equal(isStaffRequest(`x${STAFF_COOKIE}=1`), false);
  assert.equal(isStaffRequest(`${STAFF_COOKIE}=yes`), false);
  assert.equal(staffMarkFrom(`${STAFF_COOKIE}=off`), "off");
});

test("the cookie is readable by the page scripts and lasts 400 days", () => {
  const cookie = staffCookie("1", true);
  assert.equal(cookie.httpOnly, false);
  assert.equal(cookie.path, "/");
  assert.equal(cookie.secure, true);
  assert.equal(cookie.maxAge, 400 * 24 * 60 * 60);
});
