/**
 * Fills the development database from the newest production dump.
 *
 *     npm run db:seed-dev
 *
 * Reads MONGODB_PRODUCTION_HOST from .env and the dev MONGODB_URI from
 * .env.development.local (the later file wins), and refuses outright if the
 * target looks like production — this drops and replaces every collection it
 * restores.
 *
 * Left out on purpose: subscribers, mailJobs and mailDeliveries. A dev copy
 * has no business holding readers' addresses, and without them nothing run in
 * development can mail anybody.
 */

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { MongoClient } from "mongodb";
import { databaseHost, isProductionDatabase } from "@/lib/db-guard";

const EXCLUDED = ["subscribers", "mailJobs", "mailDeliveries"];

async function main() {
  const uri = process.env.MONGODB_URI;
  const db = process.env.MONGODB_DB ?? "celebritypersona";

  if (!uri) {
    console.error("MONGODB_URI is not set. Put the dev cluster's URI in .env.development.local.");
    process.exit(1);
  }
  if (isProductionDatabase(uri)) {
    console.error(
      `Refusing: ${databaseHost(uri) ?? "this URI"} is, or cannot be told apart from, production.\n` +
        "Set MONGODB_PRODUCTION_HOST in .env and the dev URI in .env.development.local.",
    );
    process.exit(1);
  }

  const dumps = readdirSync(".scratch")
    .filter((name) => name.startsWith("mongodump-"))
    .sort();
  const latest = dumps.at(-1);
  if (!latest) {
    console.error("No dump in .scratch/. Take one with mongodump first.");
    process.exit(1);
  }

  console.log(`Restoring .scratch/${latest} into ${databaseHost(uri)} / ${db}`);
  console.log(`Leaving out: ${EXCLUDED.join(", ")}\n`);

  const result = spawnSync(
    "mongorestore",
    [
      "--uri", uri,
      "--drop",
      "--nsFrom", "celebritypersona.*",
      "--nsTo", `${db}.*`,
      "--nsInclude", "celebritypersona.*",
      ...EXCLUDED.flatMap((name) => ["--nsExclude", `celebritypersona.${name}`]),
      `.scratch/${latest}`,
    ],
    { encoding: "utf8" },
  );
  const summary = (result.stderr ?? "")
    .split("\n")
    .filter((line) => /restored successfully|error|failed/i.test(line));
  console.log(summary.join("\n").replace(/mongodb(\+srv)?:\/\/\S+/g, "<uri>"));
  if (result.status !== 0) process.exit(result.status ?? 1);

  const client = new MongoClient(uri);
  await client.connect();
  for (const { name } of await client.db(db).listCollections().toArray()) {
    console.log(`  ${name}: ${await client.db(db).collection(name).countDocuments()}`);
  }
  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
