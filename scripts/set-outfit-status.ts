/**
 * Marks one look as a draft or as published.
 *
 *     npm run outfit:status -- <id> <draft|published>                                  # dry run
 *     npm run outfit:status -- <id> <draft|published> --apply --i-know-this-is-prod
 *
 * A draft is served nowhere: `isPublished` refuses it, so it has no page, no
 * listing and no sitemap entry. Publishing still needs the look to carry a swap
 * or a confirmed price; this sets the editor's half of that decision only.
 */

import { MongoClient } from "mongodb";
import { assertWritable } from "@/lib/prod-guard";
import { isPublished, type Outfit, type OutfitStatus } from "@/lib/types";
import { revalidateSite } from "./revalidate";
import { backupDocuments } from "./backup";

const apply = process.argv.includes("--apply");
const [idArg, statusArg] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const id = Number(idArg);
const status = statusArg as OutfitStatus;

async function main() {
  if (!Number.isInteger(id) || (status !== "draft" && status !== "published")) {
    console.error("Usage: npm run outfit:status -- <id> <draft|published> [--apply]");
    process.exit(1);
  }
  if (apply) assertWritable(`set outfit ${id} to ${status}`);

  const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const collection = client.db(process.env.MONGODB_DB).collection<Outfit>("outfits");
  const outfit = await collection.findOne({ id }, { projection: { _id: 0 } });
  if (!outfit) {
    console.error(`No outfit with id ${id}.`);
    await client.close();
    process.exit(1);
  }

  const after = { ...outfit, status };
  console.log(`#${id} ${outfit.celebrity} — ${outfit.event}`);
  console.log(`   status: ${outfit.status ?? "(none, read as published)"} -> ${status}`);
  console.log(`   served to readers: ${isPublished(outfit)} -> ${isPublished(after)}`);

  if (!apply) {
    console.log("\nDry run. Nothing was written. Re-run with --apply to write it.");
    await client.close();
    return;
  }
  await backupDocuments(`outfit-status-${id}`, [outfit]);
  await collection.updateOne({ id }, { $set: { status } });
  console.log("Written.");
  await client.close();
  await revalidateSite();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
