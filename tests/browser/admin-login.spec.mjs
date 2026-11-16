import { test, expect } from "@playwright/test";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import { jwtVerify } from "jose";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createWriteStream } from "node:fs";

const email = "synthetic@example.test";
const password = "Synthetic-local-login-only-2026!";
let client, db;

test.beforeAll(async () => {
  if (!process.env.MONGODB_URI?.startsWith("mongodb://127.0.0.1:") || !process.env.MONGODB_DB?.startsWith("cp_outfit_e2e_")) throw new Error("Disposable local database required");
  client = await new MongoClient(process.env.MONGODB_URI).connect();
  db = client.db(process.env.MONGODB_DB);
  await db.collection("adminUsers").insertOne({ _id: "synthetic-login-admin", email, passwordHash: await bcrypt.hash(password, 12) });
});
test.afterAll(async () => {
  if (db) { await db.command({ collMod: "adminUsers", validator: {} }); await db.collection("adminUsers").deleteOne({ _id: "synthetic-login-admin" }); }
  await client?.close();
});

async function submit(page, enteredPassword = password) {
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(enteredPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
async function isolatedPreview(uri, name, run) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SystemRoot|WINDIR|COMSPEC|PATHEXT|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|ProgramFiles|ProgramFiles\(x86\)|NUMBER_OF_PROCESSORS|AUTH_SECRET|ADMIN_EMAIL)$/i.test(key)));
  Object.assign(env, { NODE_ENV: "production", VERCEL_ENV: "preview", NEXT_TELEMETRY_DISABLED: "1" });
  if (uri !== undefined) env.MONGODB_URI = uri;
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3098"], { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  const output = createWriteStream(`.scratch/auth-${name}-runtime.log`);
  child.stdout.pipe(output); child.stderr.pipe(output);
  const base = "http://127.0.0.1:3098";
  try {
    let ready = false;
    for (let i = 0; i < 50; i++) {
      if (child.exitCode !== null) throw new Error("Isolated Preview server exited");
      try { if ((await fetch(`${base}/admin/login`)).ok) { ready = true; break; } } catch { /* startup */ }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    expect(ready).toBe(true);
    await run(base);
  } finally {
    if (child.exitCode === null) { child.kill(); await once(child, "exit"); }
    output.end();
  }
}

test("signed-out editor redirects; synthetic login checks credentials, cookie and revocation", async ({ page, context }) => {
  await context.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  const response = await context.request.get("/admin/outfits/new", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(new URL(response.headers().location, "http://127.0.0.1:3097").pathname).toBe("/admin/login");
  expect(new URL(response.headers().location, "http://127.0.0.1:3097").searchParams.get("from")).toBe("/admin/outfits/new");
  await page.goto("/admin/outfits/new");
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  await submit(page, "incorrect-synthetic-password");
  await expect(page.locator('form [role="alert"]')).toHaveText("Those details do not match.");
  expect((await context.cookies()).some((c) => c.name === "cp_admin_session")).toBe(false);
  expect((await db.collection("adminUsers").findOne({ email })).lastLoginAt).toBeUndefined();
  await submit(page);
  await expect(page).toHaveURL(/\/admin\/outfits\/new$/);
  const cookie = (await context.cookies()).find((c) => c.name === "cp_admin_session");
  expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax" });
  expect((await jwtVerify(cookie.value, new TextEncoder().encode(process.env.AUTH_SECRET))).payload.email).toBe(email);
  expect((await db.collection("adminUsers").findOne({ email })).lastLoginAt).toBeInstanceOf(Date);
  // Authoritative database revocation still wins over a valid signed cookie.
  await db.collection("adminUsers").updateOne({ email }, { $set: { sessionsValidAfter: new Date(Date.now() + 1000) } });
  await page.goto("/admin/outfits/new");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  await db.collection("adminUsers").updateOne({ email }, { $unset: { sessionsValidAfter: "" } });
});

test("failed login audit write never creates a session or crashes the login form", async ({ page, context }) => {
  await db.command({ collMod: "adminUsers", validator: { lastLoginAt: { $exists: false } } });
  try {
    await page.goto("/admin/login?from=%2Fadmin%2Foutfits%2Fnew");
    await submit(page);
    await expect(page.locator('form [role="alert"]')).toHaveText("Sign-in is unavailable in this environment. Try again later.");
    expect((await context.cookies()).some((c) => c.name === "cp_admin_session")).toBe(false);
    await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  } finally { await db.command({ collMod: "adminUsers", validator: {} }); }
});

for (const [name, uri] of [["missing-database", undefined], ["unreachable-database", "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=200&connectTimeoutMS=200"]]) {
  test(`Preview login renders with ${name}; protected redirect and unavailable sign-in fail closed`, async ({ page, context }) => {
    await isolatedPreview(uri, name, async (base) => {
      const response = await context.request.get(`${base}/admin/outfits/new`, { maxRedirects: 0 });
      expect(response.status()).toBe(307);
      await page.goto(`${base}/admin/outfits/new`);
      await expect(page).toHaveURL(/\/admin\/login\?from=%2Fadmin%2Foutfits%2Fnew/);
      await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
      await submit(page);
      await expect(page.locator('form [role="alert"]')).toHaveText("Sign-in is unavailable in this environment. Try again later.");
      expect((await context.cookies()).some((c) => c.name === "cp_admin_session")).toBe(false);
      await page.reload();
      await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
    });
  });
}
