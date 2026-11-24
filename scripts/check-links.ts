/**
 * Requests every product URL in the archive and records what came back.
 *
 *     npm run check:links                                # dry run
 *     npm run check:links -- --apply --i-know-this-is-prod
 *
 * An --apply run that changed anything asks the live site to refresh, so a
 * link marked dead stops being offered straight away rather than at the end of
 * the page's cache window.
 *
 * The hard part is not fetching. It is that Myntra, Ajio, Nykaa and most large
 * Indian retailers block automated requests, so a checker written the obvious
 * way marks half the archive dead the first time it runs and takes down every
 * working Buy button on the site.
 *
 * So the rule is: only evidence demotes a link.
 *
 *   404 or 410              dead. The page is gone and the retailer says so.
 *   200 + schema.org        sold_out, but only where the page's own
 *     OutOfStock            structured data says so — see the note below on
 *                           why reading the words off the page does not work.
 *   200                     ok.
 *   anything else           unverified — 403, 429, 401, every 5xx, timeouts,
 *                           DNS failures, TLS errors. We did not learn
 *                           anything, so nothing is claimed either way, the
 *                           Buy button stays up, and a person is asked to
 *                           look.
 *
 * `unverified` is not a failure state. It is the honest description of a link
 * behind a bot wall, and the page treats it as buyable for exactly that
 * reason.
 *
 * Nothing is ever unpublished here. A look whose every link died is still a
 * decoded look with real prices on it; what to do about that is an editorial
 * decision and it belongs to a person.
 */

import { MongoClient } from "mongodb";
import { assertWritable } from "@/lib/prod-guard";
import { backupDocuments } from "./backup";
import { revalidateSite } from "./revalidate";
import { checkLink, HOST_DELAY_MS } from "@/lib/link-check";
import type { LinkStatus, OutfitItem } from "@/lib/types";

const apply = process.argv.includes("--apply");

type StoredOutfit = { id: number; celebrity: string; event: string; items: OutfitItem[] };

function requireUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Run with --env-file=.env");
    process.exit(1);
  }
  return uri;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const today = () => new Date().toISOString().slice(0, 10);

async function main() {
  if (apply) assertWritable("rewrite every link's status and checked date");

  const client = new MongoClient(requireUri(), { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB);
  const outfits = db.collection<StoredOutfit>("outfits");
  const all = await outfits.find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray();

  const lastHit = new Map<string, number>();
  const tally: Record<LinkStatus, number> = {
    ok: 0,
    pending: 0,
    sold_out: 0,
    dead: 0,
    unverified: 0,
  };
  const changes: string[] = [];
  const planned: { id: number; items: OutfitItem[]; before: StoredOutfit; moved: boolean }[] = [];

  for (const outfit of all) {
    const items: OutfitItem[] = [];
    let touched = false;
    let moved = false;

    for (const item of outfit.items) {
      const next: OutfitItem = { ...item };

      for (const side of ["original", "swap"] as const) {
        const field: "wornLink" | "swapLink" = side === "original" ? "wornLink" : "swapLink";
        const link = next[field];
        if (!link?.url) continue;

        // Politeness, per host rather than globally: two different shops can
        // be hit back to back, the same shop cannot.
        const host = (() => {
          try {
            return new URL(link.url).hostname;
          } catch {
            return link.url;
          }
        })();
        const since = Date.now() - (lastHit.get(host) ?? 0);
        if (since < HOST_DELAY_MS) await sleep(HOST_DELAY_MS - since);
        lastHit.set(host, Date.now());

        const result = await checkLink(link.url);
        tally[result.status] += 1;

        const changed = link.status !== result.status;
        if (changed) {
          moved = true;
          changes.push(
            `  id ${outfit.id} · ${item.name} (${side}): ${link.status} → ${result.status}  ${result.reason}`,
          );
        }
        console.log(
          `${result.status.padEnd(10)} ${changed ? "→" : " "} ${item.name} (${side}) · ${result.reason}`,
        );

        next[field] = { ...link, status: result.status, checkedAt: today() };
        touched = true;
      }
      items.push(next);
    }

    /**
     * `touched` means every link was re-read; `moved` means one of them says
     * something different than it did. Only the second is a change to the
     * page, and only the second is allowed to move the sitemap's lastmod.
     */
    if (touched) planned.push({ id: outfit.id, items, before: outfit, moved });
  }

  /**
   * Written after every link has been checked, not as each look finishes.
   *
   * A run that is interrupted half way through now leaves the archive
   * untouched rather than half re-statused, and the backup covers the whole
   * affected set rather than whatever happened to be written before it.
   */
  if (apply && planned.length > 0) {
    await backupDocuments("check-links", planned.map((entry) => entry.before));
    for (const entry of planned) {
      await outfits.updateOne(
        { id: entry.id },
        {
          $set: {
            items: entry.items,
            // Only a look whose status actually moved is a look that changed.
            ...(entry.moved ? { contentChangedAt: today() } : {}),
          },
        },
      );
    }
  }

  const counted = Object.entries(tally).filter(([, n]) => n > 0);
  console.log(`\nChecked ${counted.reduce((sum, [, n]) => sum + n, 0)} links:`);
  for (const [status, n] of counted) console.log(`  ${status.padEnd(10)} ${n}`);

  if (changes.length) {
    console.log(`\n${changes.length} status change${changes.length === 1 ? "" : "s"}:`);
    for (const line of changes) console.log(line);
  } else {
    console.log("\nNo status changed.");
  }

  console.log(
    apply
      ? "\nWritten. Nothing was unpublished — a look whose links died is still a decoded look."
      : "\nDry run. Nothing was written. Re-run with --apply to save these statuses.",
  );

  // A status change that nobody sees is not a status change: a link marked
  // dead keeps its Buy button until the page it is on is rendered again.
  if (apply && changes.length > 0) await revalidateSite();

  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
