/** Content types shared by the seed data, the database layer and the views. */

export type OutfitItem = {
  name: string;
  wornBrand: string;
  /** Absent when the original price could not be confirmed. */
  worn?: number;
  /** Where to buy the original, when it is still on sale somewhere. */
  wornUrl?: string;
  /** Both absent until a swap has been found. Never one without the other. */
  swapBrand?: string;
  swap?: number;
  /** Where to buy the swap. */
  swapUrl?: string;
};

/** A piece we have actually found an alternative for. */
export type SwappedItem = OutfitItem & { swapBrand: string; swap: number };

export const hasSwap = (item: OutfitItem): item is SwappedItem =>
  typeof item.swap === "number" && Boolean(item.swapBrand);

export const hasWornPrice = (item: OutfitItem) => typeof item.worn === "number";

/**
 * True only when every piece has an alternative. A look still missing a swap
 * cannot honestly be offered as something you could buy for its total.
 */
export const isFullySwapped = (outfit: { items: OutfitItem[] }) =>
  outfit.items.length > 0 && outfit.items.every(hasSwap);

/** Everything the views need to describe a look's prices without overclaiming. */
export type OutfitPricing = {
  pieces: number;
  /** Pieces with an alternative found. */
  swapped: number;
  /** Pieces whose original price we could confirm. */
  priced: number;
  wornTotal: number;
  swapTotal: number;
  /** Only pieces priced on both sides can produce an honest saving. */
  savingTotal: number;
  savingPct: number | null;
  allSwapped: boolean;
  anySwapped: boolean;
  allPriced: boolean;
  anyPriced: boolean;
};

export function pricing(outfit: { items: OutfitItem[] }): OutfitPricing {
  const items = outfit.items;
  const swappedItems = items.filter(hasSwap);
  const pricedItems = items.filter(hasWornPrice);
  const comparable = items.filter((item) => hasSwap(item) && hasWornPrice(item));

  const comparableWorn = comparable.reduce((sum, item) => sum + (item.worn ?? 0), 0);
  const comparableSwap = comparable.reduce((sum, item) => sum + (item.swap ?? 0), 0);

  return {
    pieces: items.length,
    swapped: swappedItems.length,
    priced: pricedItems.length,
    wornTotal: pricedItems.reduce((sum, item) => sum + (item.worn ?? 0), 0),
    swapTotal: swappedItems.reduce((sum, item) => sum + item.swap, 0),
    savingTotal: comparableWorn - comparableSwap,
    savingPct:
      comparable.length > 0 && comparableWorn > 0
        ? Math.floor(((comparableWorn - comparableSwap) / comparableWorn) * 100)
        : null,
    allSwapped: items.length > 0 && swappedItems.length === items.length,
    anySwapped: swappedItems.length > 0,
    allPriced: items.length > 0 && pricedItems.length === items.length,
    anyPriced: pricedItems.length > 0,
  };
}

export type Outfit = {
  id: number;
  celebrity: string;
  event: string;
  occasion: string;
  date: string;
  worn: number;
  swap: number;
  isNew?: boolean;
  items: OutfitItem[];
};

export type Celebrity = {
  id: number;
  name: string;
  looks: number;
  averageSaving: number;
  low: number;
  high: number;
  brands: string[];
  trending?: boolean;
  newArchive?: boolean;
  bio?: string[];
};

export type OccasionGroup = "Wedding" | "Festival" | "Everyday";

export type Occasion = {
  id: number;
  name: string;
  group: OccasionGroup;
  looks: number;
  swapFrom: number;
  averageWorn: number;
  averageSwap: number;
  peak: string;
  description: string;
  colours: { name: string; value: string }[];
  garments: { name: string; count: number }[];
};

export type SearchIntent =
  | "Celebrity"
  | "Occasion"
  | "Budget"
  | "Brand"
  | "How to";

export type TrendingSearch = {
  term: string;
  volume: number;
  changePct: number;
  intent: SearchIntent;
  href: string;
  /** The one-line answer. Competitors publish the price and stop here. */
  answer: string;
};

export type PriceReport = {
  id: string;
  receivedAt: string;
  outfitSlug: string;
  issue: "Price is wrong" | "Link is dead" | "Sold out" | "Wrong brand or piece";
  detail: string;
  reporterEmail?: string;
  status: "New" | "Checked" | "Fixed" | "No change needed";
};

export type TickerEntry = {
  celebrity: string;
  occasion: string;
  worn: number;
  swap: number;
};

export type LookItem = SwappedItem & {
  /** Short label used on compact hero surfaces. */
  short: string;
  /** The hero compares two totals, so both sides must be priced. */
  worn: number;
};

export type OutfitCard = {
  celebrity: string;
  occasion: string;
  posted: string;
  tone: "" | "v2" | "v3" | "v4" | "v5";
  worn: number;
  swap: number;
  peek: { label: string; price: number }[];
};

/** Everything the homepage renders that is editorial rather than navigation. */
export type HomeContent = {
  heroLook: {
    date: string;
    occasion: string;
    celebrity: string;
    headline: string;
    summary: string;
    photoCredit: string;
    items: LookItem[];
  };
  tickerEntries: TickerEntry[];
  stats: { value: number; suffix: string; label: string }[];
  thisWeek: OutfitCard[];
  swapSteps: { n: string; title: string; body: string }[];
  budgetTiers: { cap: number; looks: number }[];
  dupeOfTheWeek: {
    worn: { name: string; price: number };
    swap: { name: string; price: number };
  };
  occasions: { name: string; looks: number }[];
  celebrities: { name: string; looks: number }[];
  brands: string[];
  trustPoints: { n: string; title: string; body: string }[];
  reels: { views: string; caption: string }[];
};
