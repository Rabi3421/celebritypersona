import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { signSession, verifySession } from "../lib/auth/token.ts";
import { checkRateLimit, recordFailure, clearAttempts } from "../lib/auth/rate-limit.ts";

function checkImport(uri, operation = "") {
  const env = { ...process.env, NODE_ENV: "production", VERCEL_ENV: "preview" };
  delete env.MONGODB_URI;
  if (uri !== undefined) env.MONGODB_URI = uri;
  return execFileSync(process.execPath, ["--import", "./tests/register.mjs", "--input-type=module", "-e",
    `import assert from 'node:assert/strict'; const db = await import('./lib/mongodb.ts'); ${operation} console.log('ok');`],
  { env, encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "pipe"] }).trim();
}

test("login: importing database helpers without MONGODB_URI is safe; actual database access still fails closed", () => {
  assert.equal(checkImport(undefined, "await assert.rejects(db.getDb(), /MONGODB_URI is not set/); await assert.rejects(db.getMongoClient(), /MONGODB_URI is not set/);"), "ok");
});
test("login: signed-out helper imports neither parse invalid URIs nor start unreachable connections", () => {
  assert.equal(checkImport("not-a-mongodb-uri"), "ok");
  assert.equal(checkImport("mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=100&connectTimeoutMS=100"), "ok");
});
test("login: unreachable database access remains an awaited rejection", () => {
  assert.equal(checkImport("mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=100&connectTimeoutMS=100", "await assert.rejects(db.getDb());"), "ok");
});
test("login: signed tokens still require the configured account and signing secret", async () => {
  const before = { ADMIN_EMAIL: process.env.ADMIN_EMAIL, AUTH_SECRET: process.env.AUTH_SECRET };
  try {
    process.env.ADMIN_EMAIL = "synthetic@example.test";
    process.env.AUTH_SECRET = "synthetic-test-only-secret-for-session-validation";
    const token = await signSession("synthetic@example.test");
    assert.equal((await verifySession(token)).email, "synthetic@example.test");
    assert.equal(await verifySession(token + "tampered"), null);
    assert.equal(await verifySession(await signSession("other@example.test")), null);
    assert.equal(await verifySession(await signSession("synthetic@example.test", Date.now() - 31 * 86400_000)), null);
    delete process.env.AUTH_SECRET;
    assert.equal(await verifySession(token), null);
    assert.equal(await verifySession(undefined), null);
    await assert.rejects(signSession("synthetic@example.test"), /AUTH_SECRET/);
  } finally { for (const [key, value] of Object.entries(before)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});
test("login: failed attempts retain the existing five-attempt rate limit", () => {
  const key = "synthetic-login-regression";
  try {
    for (let i = 0; i < 5; i++) { assert.equal(checkRateLimit(key).ok, true); recordFailure(key); }
    assert.equal(checkRateLimit(key).ok, false);
    clearAttempts(key);
    assert.equal(checkRateLimit(key).ok, true);
  } finally { clearAttempts(key); }
});
