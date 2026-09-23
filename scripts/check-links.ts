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
import { revalidateSite } from "./revalidate";
import type { LinkStatus, OutfitItem } from "@/lib/types";

const apply = process.argv.includes("--apply");

/** Long enough for a slow retailer, short enough to finish a run. */
const TIMEOUT_MS = 15_000;

/** Between requests to the same host, so a check is never a small flood. */
const HOST_DELAY_MS = 1_500;

/**
 * A browser's own header set. Not an attempt to defeat a bot wall — the ones
 * that matter here are not fooled by a header — but many retailers reject a
 * request with no Accept or no UA outright, and being rejected for looking
 * like a script tells us nothing about the link.
 */
const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-IN,en;q=0.9",
};

/**
 * Whether a product page says, in so many words, that the item is unavailable.
 *
 * The first version of this searched the page text for "sold out" and "out of
 * stock". Run against the real archive it marked eleven of twelve links sold
 * out — and every one was wrong. Most of these shops are Shopify, and a
 * Shopify theme ships its button labels in a JS config on every page:
 *
 *   productFormSoldOut: "Sold Out", ButtonTextOutOfStock: "OUT OF STOCK"
 *
 * The words are on the page whether or not the product is available, so the
 * test had no relationship to the thing it claimed to measure. It would have
 * taken the Buy button off nine looks that are in stock today.
 *
 * So only an explicit machine-readable signal counts: schema.org availability
 * in the page's JSON-LD, which is what the retailer states to Google and is
 * the same claim they make in their own rich results. No structured data means
 * no signal, which means no demotion — a 200 with nothing to contradict it is
 * `ok`.
 */
const UNAVAILABLE = /outofstock|soldout|discontinued|instoreonly|backorder|preorder/;
const AVAILABLE = /(^|\/)instock$/;

/** Every `availability` value anywhere in the page's JSON-LD. */
function availabilityFrom(html: string): string[] {
  const found: string[] = [];
  for (const block of html.matchAll(
    /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const walk = (node: unknown): void => {
        if (Array.isArray(node)) return node.forEach(walk);
        if (node && typeof node === "object") {
          const record = node as Record<string, unknown>;
          if (typeof record.availability === "string") found.push(record.availability);
          Object.values(record).forEach(walk);
        }
      };
      walk(JSON.parse(block[1].trim()));
    } catch {
      // A malformed or templated block is not a signal either way.
    }
  }
  return found;
}

type StoredOutfit = { id: number; celebrity: string; event: string; items: OutfitItem[] };

type Result = {
  status: LinkStatus;
  /** What the run actually saw, printed so a demotion can be argued with. */
  reason: string;
};

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

async function request(url: string, method: "HEAD" | "GET") {
  return fetch(url, {
    method,
    headers: HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

async function check(url: string): Promise<Result> {
  let response: Response;
  try {
    // HEAD first: most retailers answer it and it avoids pulling a megabyte of
    // product page to learn a status code.
    response = await request(url, "HEAD");
    // Plenty of shops do not implement HEAD and answer 405, or answer 404 to
    // HEAD while serving the page perfectly well on GET. Neither is evidence.
    if (response.status === 405 || response.status === 501 || response.status === 404) {
      response = await request(url, "GET");
    }
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    return { status: "unverified", reason: `request failed (${name})` };
  }

  if (response.status === 404 || response.status === 410) {
    return { status: "dead", reason: `HTTP ${response.status}` };
  }

  if (!response.ok) {
    // 403 and 429 are the bot wall; 5xx is the retailer having a bad day.
    return { status: "unverified", reason: `HTTP ${response.status}, not checkable` };
  }

  // A HEAD has no body, so reading the availability needs a GET.
  let html = "";
  try {
    const full = response.bodyUsed || !response.body ? await request(url, "GET") : response;
    html = await full.text();
  } catch {
    return { status: "ok", reason: "HTTP 200, body not readable" };
  }

  const states = availabilityFrom(html).map((value) => value.toLowerCase().replace(/\s/g, ""));
  if (states.length === 0) return { status: "ok", reason: "HTTP 200, no availability stated" };

  // One variant in stock is enough to keep the page buyable; a shop only
  // reports every offer as unavailable when the product really is gone.
  if (states.some((state) => AVAILABLE.test(state))) {
    return { status: "ok", reason: "HTTP 200, schema.org InStock" };
  }
  if (states.every((state) => UNAVAILABLE.test(state))) {
    return { status: "sold_out", reason: `HTTP 200, schema.org ${states[0].split("/").pop()}` };
  }
  return { status: "ok", reason: "HTTP 200" };
}

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

  for (const outfit of all) {
    const items: OutfitItem[] = [];
    let touched = false;

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

        const result = await check(link.url);
        tally[result.status] += 1;

        const moved = link.status !== result.status;
        if (moved) {
          changes.push(
            `  id ${outfit.id} · ${item.name} (${side}): ${link.status} → ${result.status}  ${result.reason}`,
          );
        }
        console.log(
          `${result.status.padEnd(10)} ${moved ? "→" : " "} ${item.name} (${side}) · ${result.reason}`,
        );

        next[field] = { ...link, status: result.status, checkedAt: today() };
        touched = true;
      }
      items.push(next);
    }

    if (touched && apply) {
      await outfits.updateOne({ id: outfit.id }, { $set: { items } });
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
