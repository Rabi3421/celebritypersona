/**
 * Checking product links: is the page gone, sold out, or fine?
 *
 * Shared by `npm run check:links` (run by hand) and the weekly cron
 * (/api/cron/links). No server-only imports, so the script can use it.
 *
 * The rule is: only evidence demotes a link.
 *
 *   404 or 410              dead. The retailer says the page is gone.
 *   200 + schema.org        sold_out, only where the page's own structured
 *     OutOfStock            data says so (button labels in a Shopify theme
 *                           say "Sold out" on every page, in stock or not).
 *   200                     ok.
 *   anything else           unverified: 403, 429, 5xx, timeouts. Nothing was
 *                           learned, the Buy button stays up.
 *
 * And for the automatic run: an `unverified` answer never overwrites a status
 * that was actually established (ok, sold_out, dead). The cron runs from
 * Vercel's servers, which bot walls block far more often than a laptop, and
 * "we could not look this week" is not news about the product.
 */

import type { LinkStatus, OutfitItem } from "@/lib/types";

/** Long enough for a slow retailer, short enough to finish a run. */
export const TIMEOUT_MS = 15_000;
/** Between requests to the same host, so a check is never a small flood. */
export const HOST_DELAY_MS = 1_500;

/**
 * A browser's own header set. Not an attempt to defeat a bot wall (the ones
 * that matter are not fooled by a header), but many retailers reject a request
 * with no Accept or UA outright, which tells us nothing about the link.
 */
const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-IN,en;q=0.9",
};

const UNAVAILABLE = /outofstock|soldout|discontinued|instoreonly|backorder|preorder/;
const AVAILABLE = /(^|\/)instock$/;

/** Every `availability` value anywhere in the page's JSON-LD. */
export function availabilityFrom(html: string): string[] {
  const found: string[] = [];
  for (const block of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
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

export type CheckResult = {
  status: Exclude<LinkStatus, "pending">;
  /** What the run actually saw, so a demotion can be argued with. */
  reason: string;
};

/** Reads an HTML body's stated availability. */
export function statusFromHtml(html: string): CheckResult {
  const states = availabilityFrom(html).map((value) => value.toLowerCase().replace(/\s/g, ""));
  if (states.length === 0) return { status: "ok", reason: "HTTP 200, no availability stated" };
  // One variant in stock keeps the page buyable.
  if (states.some((state) => AVAILABLE.test(state))) return { status: "ok", reason: "HTTP 200, schema.org InStock" };
  if (states.every((state) => UNAVAILABLE.test(state))) {
    return { status: "sold_out", reason: `HTTP 200, schema.org ${states[0].split("/").pop()}` };
  }
  return { status: "ok", reason: "HTTP 200" };
}

const request = (url: string, method: "HEAD" | "GET", fetchImpl: typeof fetch) =>
  fetchImpl(url, { method, headers: HEADERS, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });

export async function checkLink(url: string, fetchImpl: typeof fetch = fetch): Promise<CheckResult> {
  let response: Response;
  try {
    // HEAD first: most retailers answer it and it avoids pulling a whole page.
    response = await request(url, "HEAD", fetchImpl);
    // Many shops answer 405, or 404 to HEAD while serving GET fine. Not evidence.
    if (response.status === 405 || response.status === 501 || response.status === 404) {
      response = await request(url, "GET", fetchImpl);
    }
  } catch (error) {
    return { status: "unverified", reason: `request failed (${error instanceof Error ? error.name : "Error"})` };
  }

  if (response.status === 404 || response.status === 410) return { status: "dead", reason: `HTTP ${response.status}` };
  // 403 and 429 are the bot wall; 5xx is the retailer having a bad day.
  if (!response.ok) return { status: "unverified", reason: `HTTP ${response.status}, not checkable` };

  try {
    const full = response.bodyUsed || !response.body || response.headers.get("content-length") === "0" ? await request(url, "GET", fetchImpl) : response;
    return statusFromHtml(await full.text());
  } catch {
    return { status: "ok", reason: "HTTP 200, body not readable" };
  }
}

/** The status to store: an unverified answer keeps a status that was established. */
export function nextStatus(previous: LinkStatus | undefined, result: CheckResult): LinkStatus {
  if (result.status === "unverified" && previous && previous !== "pending" && previous !== "unverified") return previous;
  return result.status;
}

export type CheckableOutfit = { id: number; celebrity: string; event: string; status?: string; items: OutfitItem[] };

export type LinkChange = {
  outfitId: number;
  celebrity: string;
  event: string;
  piece: string;
  side: "original" | "swap";
  from: LinkStatus;
  to: LinkStatus;
  reason: string;
  url: string;
};

export type LinkCheckRun = {
  tally: Record<LinkStatus, number>;
  checked: number;
  /** Links left for next time because the run's time budget ran out. */
  skipped: number;
  changes: LinkChange[];
  /** Outfits whose items were re-read; `moved` means a status changed. */
  updates: { id: number; items: OutfitItem[]; moved: boolean }[];
};

type Options = {
  check?: (url: string) => Promise<CheckResult>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Stop starting new checks after this many ms; the rest wait for next week. */
  budgetMs?: number;
  today?: string;
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

/**
 * Checks every link on the given outfits, least recently checked first, so a
 * run cut short by its time budget picks up where the last one stopped.
 * Writes nothing: the caller stores `updates`.
 */
export async function runLinkCheck(outfits: CheckableOutfit[], options: Options = {}): Promise<LinkCheckRun> {
  const check = options.check ?? ((url: string) => checkLink(url));
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const deadline = options.budgetMs ? now() + options.budgetMs : Infinity;

  /** `budget` set: the piece's nth swap at another budget rather than its main link. */
  type Slot = { outfit: CheckableOutfit; index: number; field: "wornLink" | "swapLink"; side: "original" | "swap"; budget?: number; checkedAt: string };
  const slots: Slot[] = [];
  for (const outfit of outfits) {
    outfit.items.forEach((item, index) => {
      for (const [field, side] of [["wornLink", "original"], ["swapLink", "swap"]] as const) {
        const link = item[field];
        if (link?.url) slots.push({ outfit, index, field, side, checkedAt: link.checkedAt ?? "" });
      }
      (item.budgetSwaps ?? []).forEach((swap, budget) => {
        if (swap.link?.url) slots.push({ outfit, index, field: "swapLink", side: "swap", budget, checkedAt: swap.link.checkedAt ?? "" });
      });
    });
  }
  slots.sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));

  const tally: Record<LinkStatus, number> = { ok: 0, pending: 0, sold_out: 0, dead: 0, unverified: 0 };
  const changes: LinkChange[] = [];
  const edited = new Map<number, { items: OutfitItem[]; moved: boolean }>();
  const lastHit = new Map<string, number>();
  let checked = 0;
  let skipped = 0;

  for (const slot of slots) {
    if (now() >= deadline) {
      skipped++;
      continue;
    }
    const entry = edited.get(slot.outfit.id) ?? { items: slot.outfit.items.map((item) => ({ ...item })), moved: false };
    const item = entry.items[slot.index];
    const link = slot.budget === undefined ? item[slot.field]! : item.budgetSwaps![slot.budget].link;

    const host = hostOf(link.url);
    const since = now() - (lastHit.get(host) ?? 0);
    if (since < HOST_DELAY_MS) await sleep(HOST_DELAY_MS - since);
    lastHit.set(host, now());

    const result = await check(link.url);
    checked++;
    tally[result.status] += 1;
    const status = nextStatus(link.status, result);
    // An unverified answer that kept an established status is not a fresh check either.
    const learned = status === result.status;
    if (status !== link.status) {
      entry.moved = true;
      changes.push({
        outfitId: slot.outfit.id,
        celebrity: slot.outfit.celebrity,
        event: slot.outfit.event,
        piece: slot.budget === undefined ? item.name : `${item.name} (₹${item.budgetSwaps![slot.budget].price} swap)`,
        side: slot.side,
        from: link.status,
        to: status,
        reason: result.reason,
        url: link.url,
      });
    }
    const checkedLink = { ...link, status, ...(learned ? { checkedAt: today } : {}) };
    if (slot.budget === undefined) item[slot.field] = checkedLink;
    else {
      const budgetSwaps = [...item.budgetSwaps!];
      budgetSwaps[slot.budget] = { ...budgetSwaps[slot.budget], link: checkedLink };
      entry.items[slot.index] = { ...item, budgetSwaps };
    }
    edited.set(slot.outfit.id, entry);
  }

  return {
    tally,
    checked,
    skipped,
    changes,
    updates: [...edited].map(([id, entry]) => ({ id, items: entry.items, moved: entry.moved })),
  };
}
