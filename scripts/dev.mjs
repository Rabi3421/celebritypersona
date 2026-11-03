/**
 * `npm run dev` — the whole local setup in one command.
 *
 * Starts a private MongoDB on this machine, fills it with the newest backup in
 * .scratch/, and runs `next dev` against it. Nothing you do in development can
 * reach the live site's database. When you stop dev (Ctrl+C), the private
 * database goes with it; the next `npm run dev` starts fresh from the backup.
 *
 * Subscribers and the mail queue are left out of the copy, so development can
 * never email a real reader.
 */

import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { MongoMemoryServer } from "mongodb-memory-server";

const DB = "celebritypersona";
const LEFT_OUT = ["subscribers", "mailJobs", "mailDeliveries"];

const mongo = await MongoMemoryServer.create({ instance: { port: 27018, dbName: DB } });
const uri = mongo.getUri();

const latest = (() => {
  try {
    return readdirSync(".scratch").filter((name) => name.startsWith("mongodump-")).sort().at(-1);
  } catch {
    return undefined;
  }
})();

if (latest) {
  console.log(`Loading your site data from .scratch/${latest} …`);
  // Async, not spawnSync: the in-memory mongod pipes its logs through this
  // process. Blocking the event loop lets that pipe fill, mongod stalls on the
  // write, and mongorestore times out on the handshake.
  const restore = await new Promise((resolve) => {
    const child = spawn(
      "mongorestore",
      [
        "--uri", uri,
        "--nsInclude", `${DB}.*`,
        ...LEFT_OUT.flatMap((name) => ["--nsExclude", `${DB}.${name}`]),
        `.scratch/${latest}`,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => resolve({ status: null, error, stderr }));
    child.on("close", (status) => resolve({ status, stderr }));
  });
  if (restore.status !== 0) {
    console.warn("Could not load the backup, so the site will start empty.");
    if (restore.error) console.warn("(Is mongorestore installed? brew install mongodb/brew/mongodb-database-tools)");
    else console.warn(restore.stderr.trim().split("\n").slice(-3).join("\n"));
  }
} else {
  console.warn("No backup found in .scratch/, so the site will start empty.");
}

console.log("Private database ready. Starting the site …\n");

const next = spawn("npx", ["next", "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, MONGODB_URI: uri },
});

const stop = async (code = 0) => {
  await mongo.stop().catch(() => {});
  process.exit(code);
};
process.on("SIGINT", () => next.kill("SIGINT"));
process.on("SIGTERM", () => next.kill("SIGTERM"));
next.on("exit", (code) => stop(code ?? 0));
