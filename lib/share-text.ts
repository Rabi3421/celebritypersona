import { outfitPhotos, pricing, type Outfit } from "@/lib/types";

/**
 * The words on a look's share card and Pinterest pin. Same rules as the site's
 * own cards: a price is shown only when it is established, a saving only when
 * pieces are priced on both sides, and nothing ever reads "₹0".
 */

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export type ShareText = {
  celebrity: string;
  event: string;
  worn: string | null;
  swap: string | null;
  saving: string | null;
  /** Strike the worn price only when the swap replaces every piece. */
  strike: boolean;
  pieces: string;
};

const clip = (text: string, size: number) => (text.length > size ? `${text.slice(0, size - 1).trimEnd()}…` : text);

export function shareText(outfit: Pick<Outfit, "celebrity" | "event" | "items">): ShareText {
  const money = pricing(outfit);
  return {
    celebrity: clip(outfit.celebrity, 40),
    event: clip(outfit.event, 80),
    worn: money.anyPriced ? inr.format(money.wornTotal) : null,
    swap: money.anySwapped ? inr.format(money.swapTotal) : null,
    saving: money.savingPct !== null && money.savingPct > 0 ? `${money.savingPct}% less` : null,
    strike: money.allSwapped && money.anyPriced,
    pieces: `${money.pieces} piece${money.pieces === 1 ? "" : "s"} decoded`,
  };
}

/**
 * Changes whenever anything drawn on the images changes, so a share link that
 * carries it is never served an old picture from a cache.
 */
export function shareVersion(outfit: Pick<Outfit, "celebrity" | "event" | "items"> & Partial<Outfit>): string {
  const text = shareText(outfit);
  const photo = outfitPhotos(outfit as Outfit)[0]?.url ?? "";
  const input = [text.celebrity, text.event, text.worn, text.swap, text.saving, text.strike, text.pieces, photo].join("|");
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export const SHARE_KINDS = {
  card: { width: 1200, height: 630 },
  pin: { width: 1000, height: 1500 },
} as const;

export type ShareKind = keyof typeof SHARE_KINDS;
