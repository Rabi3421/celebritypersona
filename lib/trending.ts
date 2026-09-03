import { outfitSlug } from "@/lib/slugs";
import { hasSwap, hasWornPrice, savingPercent, savingSortKey, swapPrice } from "@/lib/types";
import type { Outfit, SwappedItem } from "@/lib/types";

/**
 * Everything the trending surfaces show below the search leaderboard is
 * computed from the outfit archive, so the page and the site can never
 * disagree. Pure functions over whatever the caller loaded.
 */

/**
 * Floored, so a 99.5% saving never rounds up to a "100% less" badge, and null
 * when no piece on the look is priced on both sides.
 *
 * This and everything below used to read the stored `worn`/`swap` totals on
 * the document, which are written once and never recomputed. A look with no
 * alternative therefore carried `swap: 0`, which came out of here as a 100%
 * saving and put "from ₹0" against half the occasions on the board.
 */
export { savingPercent };

/** Looks with the widest gap between what she paid and what you would. */
export const biggestSavers = (outfits: Outfit[]) =>
  [...outfits].sort((a, b) => savingSortKey(b) - savingSortKey(a)).slice(0, 6);

/** Most recently decoded, newest first. */
export const freshestLooks = (outfits: Outfit[]) =>
  [...outfits].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

export type TrendingDupe = SwappedItem & { celebrity: string; slug: string; worn: number };

/** Single pieces with the largest rupee gap, the classic dupe query. */
export const trendingDupes = (outfits: Outfit[]): TrendingDupe[] =>
  outfits
    .flatMap((outfit) =>
      outfit.items
        .filter((item): item is SwappedItem & { worn: number } => hasSwap(item) && hasWornPrice(item))
        .map((item) => ({
        ...item,
        celebrity: outfit.celebrity,
        slug: outfitSlug(outfit),
      })),
    )
    .sort((a, b) => b.worn - b.swap - (a.worn - a.swap))
    .slice(0, 8);

export type TrendingBrand = { name: string; swaps: number; cheapest: number };

/** Retailers our swaps point at most often, ranked. */
export const trendingBrands = (outfits: Outfit[]): TrendingBrand[] =>
  Object.values(
    outfits
      .flatMap((outfit) => outfit.items.filter(hasSwap))
      .reduce<Record<string, TrendingBrand>>((acc, item) => {
        const entry = acc[item.swapBrand] ?? {
          name: item.swapBrand,
          swaps: 0,
          cheapest: Infinity,
        };
        entry.swaps += 1;
        entry.cheapest = Math.min(entry.cheapest, item.swap);
        acc[item.swapBrand] = entry;
        return acc;
      }, {}),
  )
    .sort((a, b) => b.swaps - a.swaps)
    .slice(0, 8);

export type TrendingOccasion = {
  name: string;
  looks: number;
  /** Null when no look in the occasion has an alternative priced yet. */
  cheapest: number | null;
};

export const trendingOccasions = (outfits: Outfit[]): TrendingOccasion[] =>
  Object.values(
    outfits.reduce<Record<string, { name: string; looks: number; cheapest: number }>>(
      (acc, outfit) => {
        const entry = acc[outfit.occasion] ?? {
          name: outfit.occasion,
          looks: 0,
          cheapest: Infinity,
        };
        entry.looks += 1;
        const swap = swapPrice(outfit);
        if (swap !== null) entry.cheapest = Math.min(entry.cheapest, swap);
        acc[outfit.occasion] = entry;
        return acc;
      },
      {},
    ),
  )
    .map((entry) => ({
      ...entry,
      cheapest: Number.isFinite(entry.cheapest) ? entry.cheapest : null,
    }))
    .sort((a, b) => b.looks - a.looks);
