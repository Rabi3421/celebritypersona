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
  /** One line the merchant cannot supply: fabric, fit, why it works. This is
   *  the difference between a listing and a decoded piece. */
  note?: string;
  /** Where this piece sits on the outfit photo, as percentages of width and
   *  height, so the dot stays put at any image size. */
  hotspot?: { x: number; y: number };
};

export type OutfitImage = {
  url: string;
  /** Storage path, kept so the file can be deleted when it is replaced. */
  path: string;
  credit?: string;
};

/**
 * Photos of a look, newest shape first. `image` is the single-photo shape
 * older documents were written with; reading through here means nothing has
 * to be migrated before the gallery works.
 */
export const outfitPhotos = (outfit: {
  image?: OutfitImage;
  images?: OutfitImage[];
}): OutfitImage[] =>
  outfit.images?.length ? outfit.images : outfit.image ? [outfit.image] : [];

/** The photo every card and the detail hero lead with, and the one the
 *  hotspot dots are placed on. */
export const outfitPhoto = (outfit: { image?: OutfitImage; images?: OutfitImage[] }) =>
  outfitPhotos(outfit)[0];

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
  /** Editor-chosen URL segment. Also names the storage folder its photos are
   *  uploaded into. Absent on older looks, which fall back to a derived slug. */
  slug?: string;
  /** Superseded by `images`. Still read, so older documents keep their photo. */
  image?: OutfitImage;
  images?: OutfitImage[];
  /** The editor's own writing about the look, one paragraph per entry. */
  notes?: string[];
  /** When the prices on this look were last put in front of a person, set on
   *  every save. The page used to claim "2 days ago" no matter what. */
  pricesCheckedAt?: string;
  items: OutfitItem[];
};

/**
 * Whether a look offers anything a shopper could not get from the brand's own
 * product page. Without either, the page is a product name and a buy link —
 * what Google's spam policy calls thin affiliation — so it stays out of the
 * index until there is a reason for it to be there.
 */
export const hasSubstance = (outfit: Outfit) =>
  Boolean(outfit.notes?.length) ||
  outfit.items.some(hasSwap) ||
  outfit.items.some((item) => item.note?.trim());

/**
 * What an editor writes about a person. Everything countable — how many looks,
 * what she wears, what her looks cost, whether the archive is fresh or
 * trending — is derived from the outfits themselves in `lib/archive.ts`, so a
 * record can never claim 47 looks while the archive holds three.
 */
export type Celebrity = {
  id: number;
  name: string;
  bio?: string[];
};

export type OccasionGroup = "Wedding" | "Festival" | "Everyday";

/**
 * The editorial half of an occasion. Its counts, price averages, cheapest
 * complete look and garment tally all come from the archive.
 */
export type Occasion = {
  id: number;
  name: string;
  group: OccasionGroup;
  peak: string;
  description: string;
  colours: { name: string; value: string }[];
  /** The next real-world date this occasion falls on, YYYY-MM-DD. Drives the
   *  "Coming up" rail, whose countdown is calculated rather than typed. */
  nextDate?: string;
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

/** What a reader can tell us about a look. "Swap suggestion" is the one that
 *  adds something rather than correcting something. */
export const PRICE_REPORT_ISSUES = [
  "Price is wrong",
  "Link is dead",
  "Sold out",
  "Wrong brand or piece",
  "Swap suggestion",
] as const;

export type PriceReportIssue = (typeof PRICE_REPORT_ISSUES)[number];

export const PRICE_REPORT_STATUSES = [
  "New",
  "Checked",
  "Fixed",
  "No change needed",
] as const;

export type PriceReportStatus = (typeof PRICE_REPORT_STATUSES)[number];

export type PriceReport = {
  id: string;
  /** ISO timestamp. Older rows carry a plain YYYY-MM-DD, which still sorts. */
  receivedAt: string;
  /** The look it is about. Empty when the reader could not name one. */
  outfitSlug: string;
  issue: PriceReportIssue;
  detail: string;
  /** Which piece on the look, when the reader named one. */
  piece?: string;
  /** The retailer page backing the report, or the suggested swap. */
  sourceUrl?: string;
  reporterEmail?: string;
  status: PriceReportStatus;
  /** What the editor did about it. */
  note?: string;
};

export const REQUEST_STATUSES = ["New", "Queued", "Decoded", "Declined"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/**
 * Someone the readers want decoded. The public page promises the most-asked-for
 * names get done first, so repeats add a vote rather than a duplicate row.
 */
export type CelebrityRequest = {
  id: string;
  name: string;
  votes: number;
  firstAskedAt: string;
  lastAskedAt: string;
  status: RequestStatus;
};

export const SUBSCRIBER_STATUSES = ["Active", "Unsubscribed"] as const;
export type SubscriberStatus = (typeof SUBSCRIBER_STATUSES)[number];

/** A WhatsApp number that asked for the weekly messages. */
export type Subscriber = {
  id: string;
  /** Digits only, no country code. Also the natural key, so signing up twice
   *  reactivates rather than duplicating. */
  number: string;
  joinedAt: string;
  status: SubscriberStatus;
};

export type TickerEntry = {
  celebrity: string;
  occasion: string;
  worn: number;
  swap: number;
};

/** Everything on the homepage that is editorial rather than counted. */
export type HomeContent = {
  swapSteps: { n: string; title: string; body: string }[];
  trustPoints: { n: string; title: string; body: string }[];
  reels: { views: string; caption: string }[];
  /** The campaign band. Its look count is filled in from the archive. */
  campaign: { eyebrow: string; title: string; body: string; cta: string; href: string };
};
