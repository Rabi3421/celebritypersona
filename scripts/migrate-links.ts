/**
 * Gives every piece a stable id, and turns the loose `wornUrl`/`swapUrl`
 * fields into link records.
 *
 * Before this, a piece's link was a bare string. There was nowhere to record
 * which retailer it points at, whether an affiliate form of it exists, which
 * network pays for it, or whether anybody has ever checked that it works — so
 * the page drew a Buy button beside the words "link pending", and an outbound
 * click could not be attributed to anything.
 *
 *     npm run migrate:links                              # dry run
 *     npm run migrate:links -- --apply --i-know-this-is-prod
 *
 * Safe to re-run. A piece that already has an id keeps it, and a side that
 * already has a link record is left alone, so this only ever fills gaps.
 *
 * Every migrated link is written `unverified`, never `ok`. A URL nobody has
 * checked has not earned a claim that it works; `npm run check:links` is what
 * promotes one. The single exception is a piece already flagged sold out,
 * which carries that state across.
 *
 * The whole collection is written to .scratch/ before anything changes.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { assertWritable } from "@/lib/prod-guard";
import { retailerFromUrl, type OutfitItem, type PieceLink } from "@/lib/types";

const apply = process.argv.includes("--apply");

function requireUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Run with --env-file=.env");
    process.exit(1);
  }
  return uri;
}

type StoredOutfit = { id: number; celebrity: string; event: string; items: OutfitItem[] };

/** The link record a legacy URL becomes, or null when there is no URL. */
function linkFor(
  item: OutfitItem,
  side: "original" | "swap",
): PieceLink | null {
  const url = (side === "original" ? item.wornUrl : item.swapUrl)?.trim();
  if (!url) return null;

  const brand = side === "original" ? item.wornBrand : item.swapBrand;
  return {
    retailer: retailerFromUrl(url) ?? brand ?? "Retailer",
    url,
    network: "none",
    // Nothing has been checked, so nothing is claimed. A sold-out flag is the
    // one piece of link state an editor actually recorded, so it survives.
    status: side === "original" && item.soldOut ? "sold_out" : "unverified",
  };
}

async function main() {
  if (apply) assertWritable("rewrite every piece on every look with link records");

  const client = new MongoClient(requireUri(), { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB);
  const outfits = db.collection<StoredOutfit>("outfits");

  const all = await outfits.find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray();

  let idsAdded = 0;
  let linksBuilt = 0;
  const planned: { id: number; items: OutfitItem[]; lines: string[] }[] = [];

  for (const outfit of all) {
    const lines: string[] = [];
    const items = outfit.items.map((item) => {
      const next: OutfitItem = { ...item };

      if (!next.id) {
        next.id = randomUUID();
        idsAdded += 1;
      }

      for (const side of ["original", "swap"] as const) {
        const field = side === "original" ? "wornLink" : "swapLink";
        if (next[field]) continue;
        const link = linkFor(item, side);
        if (!link) continue;
        next[field] = link;
        linksBuilt += 1;
        lines.push(`      ${side.padEnd(8)} ${link.retailer} · ${link.status} · ${link.url}`);
      }
      return next;
    });

    planned.push({ id: outfit.id, items, lines });
    if (lines.length || outfit.items.some((item) => !item.id)) {
      console.log(`id ${outfit.id} · ${outfit.celebrity} — ${outfit.event}`);
      console.log(`      ${outfit.items.length} pieces`);
      for (const line of lines) console.log(line);
    }
  }

  console.log(
    `\n${all.length} looks · ${idsAdded} piece ids to assign · ${linksBuilt} link records to build`,
  );

  if (!apply) {
    console.log("\nDry run. Nothing was written. Re-run with --apply to migrate.");
    await client.close();
    return;
  }

  await mkdir(".scratch", { recursive: true });
  const backup = ".scratch/outfits-before-link-migration.json";
  await writeFile(backup, JSON.stringify(all, null, 2));
  console.log(`\nSaved the collection as it was to ${backup}`);

  for (const outfit of planned) {
    await outfits.updateOne({ id: outfit.id }, { $set: { items: outfit.items } });
  }

  console.log(
    `Migrated ${planned.length} looks. Every link is 'unverified' until ` +
      `npm run check:links has actually been able to reach it.`,
  );
  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
