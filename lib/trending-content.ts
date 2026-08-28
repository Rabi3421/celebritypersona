import { outfits, outfitSlug, type Outfit, type OutfitItem } from "@/lib/outfits-content";

/**
 * Data for /trending.
 *
 * The search terms and their metrics are the editorial layer: they describe
 * what people actually type, and each one is answered and pointed at the page
 * that resolves it. Everything below `trendingSearches` is derived from the
 * outfit dataset, so the leaderboard and the site can never disagree.
 *
 * The `volume` and `changePct` figures are placeholders standing in for real
 * analytics. Wire them to search logs before publishing.
 */

export type SearchIntent = "Celebrity" | "Occasion" | "Budget" | "Brand" | "How to";

export type TrendingSearch = {
  term: string;
  volume: number;
  changePct: number;
  intent: SearchIntent;
  href: string;
  /** The one-line answer. Competitors publish the price and stop here. */
  answer: string;
};

export const nameSlug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const trendingSearches: TrendingSearch[] = [
  {
    term: "alia bhatt airport look",
    volume: 1240,
    changePct: 34,
    intent: "Celebrity",
    href: "/celebrities/alia-bhatt",
    answer: "The ₹4,43,500 Mumbai airport look rebuilds for ₹5,489.",
  },
  {
    term: "sangeet lehenga under 5000",
    volume: 940,
    changePct: 61,
    intent: "Budget",
    href: "/occasions/sangeet",
    answer: "Nine decoded sangeet looks land a complete outfit under ₹5,000.",
  },
  {
    term: "deepika saree",
    volume: 870,
    changePct: 12,
    intent: "Celebrity",
    href: "/celebrities/deepika-padukone",
    answer: "Her Sabyasachi drapes swap to Nykaa and Libas for under ₹3,000.",
  },
  {
    term: "ananya panday co-ord",
    volume: 610,
    changePct: 48,
    intent: "Celebrity",
    href: "/celebrities/ananya-panday",
    answer: "The ₹1,40,000 Fendi co-ord has a ₹2,190 Westside match.",
  },
  {
    term: "diwali kurta set",
    volume: 580,
    changePct: 96,
    intent: "Occasion",
    href: "/occasions/diwali",
    answer: "Festive sets decoded with swaps you can order before the date.",
  },
  {
    term: "bollywood dupe myntra",
    volume: 520,
    changePct: 27,
    intent: "Brand",
    href: "/outfits",
    answer: "Every swap names the exact retailer, Myntra listings included.",
  },
  {
    term: "kiara advani red carpet",
    volume: 440,
    changePct: 19,
    intent: "Celebrity",
    href: "/celebrities/kiara-advani",
    answer: "A ₹3,40,000 Filmfare gown, rebuilt for ₹5,210.",
  },
  {
    term: "mehendi outfit ideas",
    volume: 390,
    changePct: 41,
    intent: "Occasion",
    href: "/occasions/mehendi",
    answer: "Sharara and lehenga looks priced twice, as worn and as swapped.",
  },
  {
    term: "sara ali khan jutti",
    volume: 310,
    changePct: 8,
    intent: "Celebrity",
    href: "/celebrities/sara-ali-khan",
    answer: "Her ₹22,000 Fizzy Goblet juttis swap to Mochi at ₹400.",
  },
  {
    term: "janhvi kapoor casual look",
    volume: 270,
    changePct: 23,
    intent: "Celebrity",
    href: "/celebrities/janhvi-kapoor",
    answer: "Tee, denim and sneakers for ₹2,140 against ₹1,12,000 worn.",
  },
];

/** Floored, so a 99.5% saving never rounds up to a "100% less" badge. */
export const savingPercent = (outfit: Outfit) =>
  Math.floor(((outfit.worn - outfit.swap) / outfit.worn) * 100);

/** Looks with the widest gap between what she paid and what you would. */
export const biggestSavers = [...outfits]
  .sort((a, b) => b.worn - b.swap - (a.worn - a.swap))
  .slice(0, 6);

/** Most recently decoded, newest first. */
export const freshestLooks = [...outfits]
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, 8);

export type TrendingDupe = OutfitItem & { celebrity: string; slug: string };

/** Single pieces with the largest rupee gap, the classic dupe query. */
export const trendingDupes: TrendingDupe[] = outfits
  .flatMap((outfit) =>
    outfit.items.map((item) => ({
      ...item,
      celebrity: outfit.celebrity,
      slug: outfitSlug(outfit),
    })),
  )
  .sort((a, b) => b.worn - b.swap - (a.worn - a.swap))
  .slice(0, 8);

export type TrendingBrand = { name: string; swaps: number; cheapest: number };

/** Retailers our swaps point at most often, ranked. */
export const trendingBrands: TrendingBrand[] = Object.values(
  outfits
    .flatMap((outfit) => outfit.items)
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

export type TrendingOccasion = { name: string; looks: number; cheapest: number };

export const trendingOccasions: TrendingOccasion[] = Object.values(
  outfits.reduce<Record<string, TrendingOccasion>>((acc, outfit) => {
    const entry = acc[outfit.occasion] ?? {
      name: outfit.occasion,
      looks: 0,
      cheapest: Infinity,
    };
    entry.looks += 1;
    entry.cheapest = Math.min(entry.cheapest, outfit.swap);
    acc[outfit.occasion] = entry;
    return acc;
  }, {}),
).sort((a, b) => b.looks - a.looks);

export const trendingFaqs = [
  {
    q: "How do you decide what is trending?",
    a: "Two inputs, both ours. The leaderboard ranks what visitors typed into the search box on this site over the last seven days. Everything below it is computed from the outfit archive itself, so a look only appears once a person has decoded it and checked its prices.",
  },
  {
    q: "What is a dupe, exactly?",
    a: "A separate product that matches the original on cut, fabric and silhouette, sold by a retailer you can order from. It is never the same item and we never present it as one. Every swap on this site is labelled as a swap.",
  },
  {
    q: "Are the prices on this page current?",
    a: "Prices are re-checked weekly and every outfit page shows the date it was last verified. Retailers change prices without warning, so treat the figure as accurate to the last check rather than to this second.",
  },
  {
    q: "Can I find a full celebrity look under ₹5,000?",
    a: "Often, yes. Sort the archive by budget and you will see complete looks that rebuild for less than ₹5,000, mostly in the airport, casual and sangeet categories where the original relies on one expensive piece rather than four.",
  },
];
