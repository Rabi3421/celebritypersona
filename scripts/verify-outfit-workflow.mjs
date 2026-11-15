// Disposable local verification. Never loads .env or inherits application secrets.
import { spawn } from "node:child_process";
import { mkdtemp, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { MongoClient } from "mongodb";
import { IMPORT_INDEXES } from "../lib/db/imported-outfits.ts";

const args = process.argv.slice(2);
for (const name of [".env", ".env.local", ".env.production", ".env.production.local"]) if (existsSync(name)) throw new Error(`Use an isolated worktree without ${name}; verification never loads application credentials`);
const pos = args.indexOf("--mongod");
if (pos < 0 || !args[pos + 1]) throw new Error("Pass --mongod C:/path/to/mongod.exe (local MongoDB binary)");
const binary = resolve(args[pos + 1]);
await access(binary);
const scratch = await mkdtemp(join(tmpdir(), "cp-outfit-verification-"));
const dbName = `cp_outfit_e2e_${process.pid}`;
const uri = "mongodb://127.0.0.1:27139/?replicaSet=cp_outfit_test";
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SystemRoot|WINDIR|COMSPEC|PATHEXT|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|ProgramFiles|ProgramFiles\(x86\)|NUMBER_OF_PROCESSORS)$/i.test(key)));
Object.assign(env, { MONGODB_URI: uri, MONGODB_DB: dbName, SEO_TEST_MONGODB_URI: uri, OUTFIT_TEST_MONGODB_URI: uri,
  ADMIN_EMAIL: "synthetic@example.test", AUTH_SECRET: randomBytes(32).toString("hex"), NEXT_TELEMETRY_DISABLED: "1" });

function start(file, args, extra = {}) {
  const child = spawn(file, args, { cwd: process.cwd(), env, windowsHide: true, stdio: "inherit", ...extra });
  child.on("error", (e) => console.error(e.message));
  return child;
}
async function run(file, args) {
  const child = start(file, args);
  const [code] = await once(child, "exit");
  if (code !== 0) throw new Error(`${args.join(" ")} exited ${code}`);
}
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const mongo = start(binary, ["--dbpath", scratch, "--bind_ip", "127.0.0.1", "--port", "27139", "--replSet", "cp_outfit_test", "--logpath", join(scratch, "mongod.log")], { stdio: "ignore" });
let client;
let server;
try {
  for (let i = 0; i < 80; i++) {
    try {
      client = await new MongoClient("mongodb://127.0.0.1:27139/?directConnection=true", { serverSelectionTimeoutMS: 500 }).connect();
      break;
    } catch { await pause(250); }
  }
  if (!client) throw new Error("Disposable mongod did not start");
  // Refuse to use a pre-existing server: this process must own the listening instance.
  const status = await client.db("admin").command({ serverStatus: 1 });
  if (status.pid !== mongo.pid) throw new Error("Port 27139 belongs to another MongoDB instance; refusing to use it");
  await client.db("admin").command({ replSetInitiate: { _id: "cp_outfit_test", members: [{ _id: 0, host: "127.0.0.1:27139" }] } });
  await client.close();
  client = await new MongoClient(uri, { serverSelectionTimeoutMS: 30000 }).connect();
  await client.db("admin").command({ ping: 1 });
  await client.db(dbName).collection("siteContent").insertOne({ key: "home", value: {
    swapSteps: [{ n: "01", title: "Synthetic test step", body: "Disposable verification fixture" }],
    trustPoints: [{ n: "01", title: "Synthetic test note", body: "Disposable verification fixture" }],
    campaign: { eyebrow: "Synthetic fixture", title: "Local test", body: "Disposable verification fixture", cta: "View", href: "/outfits" }, showStats: false,
  } });
  console.log(`Disposable replica set ready. Application database: ${dbName}`);
  if (!args.includes("--browser-only")) {
    await run(process.execPath, ["--import", "./tests/register.mjs", "--test", "tests/*.test.mjs"]);
    await run(process.execPath, ["node_modules/eslint/bin/eslint.js", "."]);
    await run(process.execPath, ["node_modules/next/dist/bin/next", "build"]);
    await run(process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit"]);
  }
  const db = client.db(dbName);
  for (const { collection, key, ...spec } of IMPORT_INDEXES) await db.collection(collection).createIndex(key, { ...spec, unique: true });
  await db.collection("catalogWriteState").insertOne({ _id: "catalog", version: 0 });
  await db.collection("outfits").insertOne({ id: 40, celebrity: "Existing Synthetic", event: "Existing fixture", occasion: "Party", date: "2026-01-01", slug: "existing-synthetic-look", status: "published", worn: 100, swap: 0, items: [{ name: "Dress", worn: 100 }] });
  server = start(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3097"]);
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch("http://127.0.0.1:3097/admin/login")).ok) break; } catch { /* startup */ }
    await pause(300);
  }
  await run(process.execPath, ["node_modules/@playwright/test/cli.js", "test"]);
  console.log("Local verification complete; only synthetic disposable databases were used.");
} finally {
  if (server) { server.kill(); await once(server, "exit").catch(() => {}); }
  if (client) { await client.db(dbName).dropDatabase().catch(() => {}); await client.close(); }
  mongo.kill();
  console.log(`Stopped disposable services. Temporary MongoDB files: ${scratch}`);
}
