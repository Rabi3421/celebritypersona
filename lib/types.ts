/** Content types shared by the seed data, the database layer and the views. */

export type OutfitItem = {
  name: string;
  wornBrand: string;
  swapBrand: string;
  worn: number;
  swap: number;
};

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

export type LookItem = OutfitItem & {
  /** Short label used on compact hero surfaces. */
  short: string;
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
