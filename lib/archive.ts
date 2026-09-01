import type { Celebrity, Occasion } from "@/lib/types";
import {
  hasSwap,
  hasWornPrice,
  isFullySwapped,
  outfitPhotos,
  pricing,
  type Outfit,
  type OutfitItem,
  type SwappedItem,
} from "@/lib/types";
import { outfitSlug } from "@/lib/slugs";

/**
 * Every number the site quotes about itself, computed from the outfits an
 * editor has actually published.
 *
 * These used to be typed into the homepage document and the celebrity and
 * occasion records by hand, which meant the site could claim 231 looks under
 * ₹10,000 while the archive held six. Nothing here is stored: publish a look
 * in the panel and every count, average, range and tier moves with it.
 *
 * Pure functions over whatever the caller loaded, so a page issues one query
 * and derives the rest.
 */

/* --------------------------------------------------------------- helpers */

const DAY = 86_400_000;

/** A look you could buy end to end. Anything still missing a swap cannot be
 *  counted towards a budget, a cheapest price or a saving. */
export const completeLooks = (outfits: Outfit[]) => outfits.filter(isFullySwapped);

const swapTotal = (outfit: Outfit) => pricing(outfit).swapTotal;
const wornTotal = (outfit: Outfit) => pricing(outfit).wornTotal;

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const mean = (values: number[]) =>
  values.length ? Math.round(sum(values) / values.length) : null;
const min = (values: number[]) => (values.length ? Math.min(...values) : null);
const max = (values: number[]) => (values.length ? Math.max(...values) : null);

/** Whole days between a YYYY-MM-DD day and now, counted in UTC so a timezone
 *  can never turn today's look into tomorrow's. */
export function daysSince(date: string, now = new Date()) {
  const then = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((today - then) / DAY);
}

/** Days from now until a YYYY-MM-DD day. Negative once it has passed. */
export const daysUntil = (date: string, now = new Date()) => -daysSince(date, now);

const newestFirst = (outfits: Outfit[]) =>
  [...outfits].sort((a, b) => b.date.localeCompare(a.date));

/** The most recent date across a set of looks, in the shape they store. */
const latestDate = (outfits: Outfit[], field: "date" | "pricesCheckedAt" = "date") =>
  outfits.reduce<string | null>((latest, outfit) => {
    const value = field === "date" ? outfit.date : outfit.pricesCheckedAt;
    if (!value) return latest;
    return !latest || value > latest ? value : latest;
  }, null);

/** Counts occurrences and returns them ranked, commonest first. */
function tally(values: string[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------- vocabulary */

/**
 * Two small presentation vocabularies. They classify text an editor already
 * typed — they are not a source of numbers, and nothing here invents a figure
 * the archive cannot support.
 */

/** Words that name a category rather than the garment, so "Co-ord set" does
 *  not collapse to "Set". */
const GENERIC_TAIL = new Set(["set", "suit", "pair", "co-ord", "coord", "ord"]);

const titleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

/** The garment a piece name ends on: "Ivory cotton kurta" -> "Kurta". */
export function garmentOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const last = words[words.length - 1].replace(/[^\p{L}\p{N}-]/gu, "");
  if (GENERIC_TAIL.has(last.toLowerCase()) && words.length > 1) {
    return titleCase(`${words[words.length - 2]} ${last}`);
  }
  return titleCase(last);
}

/** Colour words editors actually write into piece names. */
const COLOUR_WORDS: Record<string, string> = {
  ivory: "#F2EDE3", cream: "#F3EAD9", white: "#FBFAF7", beige: "#E4D8C3",
  oatmeal: "#DCD2C0", nude: "#E3C9B4", blush: "#EEC9C6", pink: "#E8A0B4",
  rose: "#C9A5A0", red: "#C0392B", maroon: "#6E1B23", burgundy: "#5C1A2B",
  rust: "#B5502A", orange: "#D97A34", peach: "#F0B79A", coral: "#E8735C",
  yellow: "#E8C24A", mustard: "#C8992E", gold: "#C7A24B", champagne: "#E4D3AC",
  green: "#3F6B4A", emerald: "#0E5E45", olive: "#6B7256", mint: "#BBD8C6",
  teal: "#256B6B", blue: "#2E4E7E", navy: "#1B2A4A", indigo: "#33366B",
  powder: "#BCCEE0", purple: "#5B3A78", lilac: "#C3B2D8", lavender: "#CBC0DE",
  brown: "#6B4B32", tan: "#B08655", chocolate: "#4A3125", black: "#1C1C1C",
  charcoal: "#333333", grey: "#8A8A8A", gray: "#8A8A8A", silver: "#C9CBCC",
};

/** The emoji the budget kit lists a piece with. Presentation only. */
const GARMENT_EMOJI: [RegExp, string][] = [
  [/lehenga|saree|sari|gown|dress|kurta|kurti|sharara|anarkali|salwar|co-ord|jumpsuit|skirt|blouse|shirt|tee|top|blazer|jacket|trouser|denim|jean|pant|suit|sherwani|dupatta|shawl|stole/i, "👗"],
  [/heel|sandal|jutti|mojari|flat|loafer|sneaker|shoe|boot/i, "👡"],
  [/earring|jhumka|necklace|chain|bangle|bracelet|ring|kundan|polki|choker|maang|jewel/i, "💍"],
  [/bag|clutch|potli|tote|purse|wallet|sling/i, "👜"],
  [/sunglass|glass|watch|belt|scarf|hairband|clip/i, "🕶️"],
];

export const garmentEmoji = (name: string) =>
  GARMENT_EMOJI.find(([pattern]) => pattern.test(name))?.[1] ?? "✦";

/* -------------------------------------------------------- archive totals */

export type ArchiveTotals = {
  looks: number;
  /** Individual pieces an editor has identified across every look. */
  pieces: number;
  /** Looks where every piece has an alternative, so the total is buyable. */
  buyable: number;
  celebrities: number;
  occasions: number;
  /** Retailers our swaps point at. */
  brands: number;
  /** Null until at least one look has both sides priced. */
  averageSavingPct: number | null;
  cheapestCompleteLook: number | null;
  dearestLook: number | null;
  /** Total rupees between what was worn and what the swaps cost. */
  savingTotal: number;
  /** Days since prices were last put in front of a person. */
  checkedDaysAgo: number | null;
  lastDecoded: string | null;
};

export function archiveTotals(outfits: Outfit[], now = new Date()): ArchiveTotals {
  const buyable = completeLooks(outfits);
  const savings = outfits
    .map((outfit) => pricing(outfit).savingPct)
    .filter((value): value is number => value !== null);
  const checked = latestDate(outfits, "pricesCheckedAt");

  return {
    looks: outfits.length,
    pieces: sum(outfits.map((outfit) => outfit.items.length)),
    buyable: buyable.length,
    celebrities: new Set(outfits.map((outfit) => outfit.celebrity)).size,
    occasions: new Set(outfits.map((outfit) => outfit.occasion)).size,
    brands: new Set(
      outfits.flatMap((outfit) => outfit.items.filter(hasSwap).map((item) => item.swapBrand)),
    ).size,
    averageSavingPct: mean(savings),
    cheapestCompleteLook: min(buyable.map(swapTotal)),
    dearestLook: max(outfits.map(wornTotal)),
    savingTotal: sum(outfits.map((outfit) => pricing(outfit).savingTotal)),
    checkedDaysAgo: checked ? daysSince(checked, now) : null,
    lastDecoded: latestDate(outfits),
  };
}

/* ------------------------------------------------------------ the brands */

/** Labels worn in the archive, commonest first. The designer half. */
export const wornBrands = (outfits: Outfit[]) =>
  tally(outfits.flatMap((outfit) => outfit.items.map((item) => item.wornBrand)));

/** Retailers the swaps point at, commonest first. The high-street half. */
export const swapBrands = (outfits: Outfit[]) =>
  tally(outfits.flatMap((outfit) => outfit.items.filter(hasSwap).map((item) => item.swapBrand)));

/**
 * The marquee: the labels worn and the shops we swap them for, interleaved so
 * the strip reads as both halves of the site rather than one long list of
 * designers.
 */
export function brandRoll(outfits: Outfit[], limit = 16) {
  const worn = wornBrands(outfits).map((brand) => brand.name);
  const swap = swapBrands(outfits).map((brand) => brand.name);
  const rolled: string[] = [];
  for (let i = 0; rolled.length < limit && (i < worn.length || i < swap.length); i += 1) {
    for (const name of [worn[i], swap[i]]) {
      if (name && !rolled.includes(name) && rolled.length < limit) rolled.push(name);
    }
  }
  return rolled;
}

/* ------------------------------------------------------------- garments */

/** The garments a set of looks is actually made of, commonest first. */
export const garmentsIn = (outfits: Outfit[], limit = 6) =>
  tally(outfits.flatMap((outfit) => outfit.items.map((item) => garmentOf(item.name))))
    .filter((garment) => garment.name)
    .slice(0, limit);

/** Colours named in the pieces themselves, commonest first. Empty when the
 *  archive's piece names carry no colour, which is a fine thing to show. */
export function paletteIn(outfits: Outfit[], limit = 5) {
  const found = outfits.flatMap((outfit) =>
    outfit.items.flatMap((item) =>
      item.name
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((word) => word in COLOUR_WORDS),
    ),
  );
  return tally(found)
    .slice(0, limit)
    .map((colour) => ({ name: titleCase(colour.name), value: COLOUR_WORDS[colour.name] }));
}

/* -------------------------------------------------------------- filters */

/** Every occasion and celebrity the archive holds, ranked by how many looks
 *  each has. The filter rails used to offer a fixed list that could not tell
 *  you whether anything was behind a chip. */
export const occasionNames = (outfits: Outfit[]) =>
  tally(outfits.map((outfit) => outfit.occasion)).map((entry) => entry.name);

export const celebrityNames = (outfits: Outfit[]) =>
  tally(outfits.map((outfit) => outfit.celebrity)).map((entry) => entry.name);

/**
 * Saving thresholds worth offering as filters. Derived from the archive's own
 * spread, so a chip never filters everything or nothing away.
 */
export function savingThresholds(outfits: Outfit[]) {
  const savings = outfits
    .map((outfit) => pricing(outfit).savingPct)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
  if (savings.length < 2) return [];
  const at = (fraction: number) => savings[Math.floor((savings.length - 1) * fraction)];
  return [...new Set([at(0.25), at(0.5), at(0.75)].map((value) => Math.floor(value / 5) * 5))]
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
}

/* --------------------------------------------------------------- budgets */

/** Rounds a rupee figure up to a number a shopper would actually say. */
function niceCap(value: number) {
  const step = value <= 2000 ? 250 : value <= 10000 ? 500 : 1000;
  return Math.ceil(value / step) * step;
}

export type BudgetTier = { cap: number; looks: number; cheapest: number; occasions: string[] };

/**
 * The three price ceilings the site offers, taken from the spread of what its
 * complete looks actually cost rather than from three numbers someone liked.
 * Each tier reports how many complete looks sit at or under it.
 */
export function budgetTiers(outfits: Outfit[], count = 3): BudgetTier[] {
  const buyable = completeLooks(outfits);
  const totals = buyable.map(swapTotal).sort((a, b) => a - b);
  if (totals.length === 0) return [];

  const at = (fraction: number) => totals[Math.min(totals.length - 1, Math.floor(totals.length * fraction))];
  const fractions = Array.from({ length: count - 1 }, (_, i) => (i + 1) / count);
  const caps = [...new Set([...fractions.map((f) => niceCap(at(f))), niceCap(totals[totals.length - 1])])]
    .sort((a, b) => a - b);

  return caps.map((cap) => {
    const within = buyable.filter((outfit) => swapTotal(outfit) <= cap);
    return {
      cap,
      looks: within.length,
      cheapest: min(within.map(swapTotal)) ?? 0,
      occasions: tally(within.map((outfit) => outfit.occasion)).slice(0, 3).map((entry) => entry.name),
    };
  });
}

/** Where the budget slider starts, stops and snaps. All three follow the
 *  cheapest and dearest complete look in the archive. */
export function budgetRange(outfits: Outfit[]) {
  const totals = completeLooks(outfits).map(swapTotal);
  if (totals.length === 0) return { min: 1000, max: 15000, step: 250, presets: [] as number[] };

  const cheapest = Math.min(...totals);
  const dearest = Math.max(...totals);
  const low = Math.max(250, Math.floor(cheapest / 250) * 250);
  const high = Math.max(low + 1000, niceCap(dearest));
  const step = high - low > 20000 ? 1000 : high - low > 8000 ? 500 : 250;

  const presets = [...new Set([
    ...budgetTiers(outfits).map((tier) => tier.cap).filter((cap) => cap > low && cap < high),
    high,
  ])].sort((a, b) => a - b);

  return { min: low, max: high, step, presets };
}

export type KitPiece = { emoji: string; name: string; brand: string; price: number };

/**
 * A real complete look at or under a budget, listed piece by piece. The page
 * used to show an invented shopping list; this is the dearest look the budget
 * still affords, which is the most it buys.
 */
export function exampleKit(outfits: Outfit[], budget: number) {
  const affordable = completeLooks(outfits)
    .filter((outfit) => swapTotal(outfit) <= budget)
    .sort((a, b) => swapTotal(b) - swapTotal(a));
  const chosen = affordable[0];
  if (!chosen) return null;

  return {
    outfit: chosen,
    slug: outfitSlug(chosen),
    total: swapTotal(chosen),
    pieces: chosen.items
      .filter(hasSwap)
      .sort((a, b) => b.swap - a.swap)
      .map((item): KitPiece => ({
        emoji: garmentEmoji(item.name),
        name: item.name,
        brand: item.swapBrand,
        price: item.swap,
      })),
  };
}

/** How many complete looks each occasion holds at or under a budget. */
export function occasionCoverage(outfits: Outfit[], budget: number) {
  const within = completeLooks(outfits).filter((outfit) => swapTotal(outfit) <= budget);
  return occasionNames(outfits).map((name) => ({
    name,
    looks: within.filter((outfit) => outfit.occasion === name).length,
  }));
}

/* ---------------------------------------------------------- celebrities */

export type CelebrityStats = {
  looks: number;
  pieces: number;
  /** Null until one of her looks has both sides priced. */
  averageSaving: number | null;
  /** Cheapest and dearest look as worn. Null while nothing is priced. */
  low: number | null;
  high: number | null;
  /** Labels she wears, commonest first. */
  brands: { name: string; count: number; highStreet: boolean }[];
  occasions: { name: string; count: number }[];
  garments: { name: string; count: number }[];
  palette: { name: string; value: string }[];
  cheapestSwap: number | null;
  /** Photos from her own looks, newest first, for cards and rails. */
  photos: string[];
  lastDecoded: string | null;
  lastChecked: string | null;
  /** True when something of hers landed inside the new-archive window. */
  isNew: boolean;
};

/** How recently a look has to have landed for an archive to count as new. */
const NEW_ARCHIVE_DAYS = 30;

export function celebrityStats(
  outfits: Outfit[],
  name: string,
  now = new Date(),
): CelebrityStats {
  const hers = outfits.filter((outfit) => outfit.celebrity === name);
  const savings = hers
    .map((outfit) => pricing(outfit).savingPct)
    .filter((value): value is number => value !== null);
  const wornTotals = hers.map(wornTotal).filter((value) => value > 0);
  const highStreet = new Set(swapBrands(outfits).map((brand) => brand.name));
  const lastDecoded = latestDate(hers);
  const photos = newestFirst(hers).flatMap((outfit) => outfitPhotos(outfit).map((photo) => photo.url));

  return {
    looks: hers.length,
    pieces: sum(hers.map((outfit) => outfit.items.length)),
    averageSaving: mean(savings),
    low: min(wornTotals),
    high: max(wornTotals),
    brands: wornBrands(hers).map((brand) => ({
      ...brand,
      highStreet: highStreet.has(brand.name),
    })),
    occasions: tally(hers.map((outfit) => outfit.occasion)),
    garments: garmentsIn(hers),
    palette: paletteIn(hers),
    cheapestSwap: min(completeLooks(hers).map(swapTotal)),
    photos,
    lastDecoded,
    lastChecked: latestDate(hers, "pricesCheckedAt"),
    isNew: lastDecoded ? daysSince(lastDecoded, now) <= NEW_ARCHIVE_DAYS : false,
  };
}

/* ------------------------------------------------------------ occasions */

export type OccasionStats = {
  looks: number;
  pieces: number;
  /** Cheapest complete look for this occasion. Null until one exists. */
  swapFrom: number | null;
  averageWorn: number | null;
  averageSwap: number | null;
  averageSaving: number | null;
  garments: { name: string; count: number }[];
  wornBrands: string[];
  swapBrands: string[];
  celebrities: { name: string; count: number }[];
  /** Photos from looks in this group, newest first. */
  photos: string[];
  lastDecoded: string | null;
  lastChecked: string | null;
};

const matchesOccasion = (outfit: Outfit, name: string) =>
  outfit.occasion.toLowerCase() === name.toLowerCase();

export function occasionStats(outfits: Outfit[], name: string): OccasionStats {
  const theirs = outfits.filter((outfit) => matchesOccasion(outfit, name));
  const buyable = completeLooks(theirs);
  const savings = theirs
    .map((outfit) => pricing(outfit).savingPct)
    .filter((value): value is number => value !== null);

  return {
    looks: theirs.length,
    pieces: sum(theirs.map((outfit) => outfit.items.length)),
    swapFrom: min(buyable.map(swapTotal)),
    averageWorn: mean(theirs.map(wornTotal).filter((value) => value > 0)),
    averageSwap: mean(buyable.map(swapTotal)),
    averageSaving: mean(savings),
    garments: garmentsIn(theirs),
    wornBrands: wornBrands(theirs).slice(0, 4).map((brand) => brand.name),
    swapBrands: swapBrands(theirs).slice(0, 5).map((brand) => brand.name),
    celebrities: tally(theirs.map((outfit) => outfit.celebrity)),
    photos: newestFirst(theirs).flatMap((outfit) => outfitPhotos(outfit).map((photo) => photo.url)),
    lastDecoded: latestDate(theirs),
    lastChecked: latestDate(theirs, "pricesCheckedAt"),
  };
}

/** Looks for an occasion, so a page can list the archive it just counted. */
export const outfitsForOccasion = (outfits: Outfit[], name: string) =>
  outfits.filter((outfit) => matchesOccasion(outfit, name));

/* ---------------------------------------------------- homepage surfaces */

/** The rail of recent decodes. Was five rows retyped by hand. */
export const tickerEntries = (outfits: Outfit[], limit = 6) =>
  newestFirst(completeLooks(outfits))
    .slice(0, limit)
    .map((outfit) => ({
      celebrity: outfit.celebrity,
      occasion: outfit.occasion,
      worn: wornTotal(outfit),
      swap: swapTotal(outfit),
    }));

export type OccasionTile = { name: string; looks: number; image?: string };

/** Occasion and archive tiles, counted off the outfits and illustrated with a
 *  real photo from the group rather than a placeholder seed. */
export function occasionTiles(outfits: Outfit[], limit = 8): OccasionTile[] {
  return tally(outfits.map((outfit) => outfit.occasion))
    .slice(0, limit)
    .map((entry) => ({
      name: entry.name,
      looks: entry.count,
      image: newestFirst(outfitsForOccasion(outfits, entry.name))
        .map((outfit) => outfitPhotos(outfit)[0]?.url)
        .find(Boolean),
    }));
}

export function celebrityTiles(outfits: Outfit[], limit = 6): OccasionTile[] {
  return tally(outfits.map((outfit) => outfit.celebrity))
    .slice(0, limit)
    .map((entry) => ({
      name: entry.name,
      looks: entry.count,
      image: newestFirst(outfits.filter((outfit) => outfit.celebrity === entry.name))
        .map((outfit) => outfitPhotos(outfit)[0]?.url)
        .find(Boolean),
    }));
}

export type HeroLook = {
  slug: string;
  date: string;
  occasion: string;
  celebrity: string;
  event: string;
  items: { name: string; short: string; wornBrand: string; swapBrand: string; worn: number; swap: number }[];
};

/** Both halves of a piece priced, which the swap demo needs to compare two
 *  honest totals. */
const comparable = (item: OutfitItem): item is SwappedItem & { worn: number } =>
  hasSwap(item) && hasWornPrice(item);

/**
 * The look the swap demo animates: the most recent one with at least two
 * pieces priced on both sides. Hand-typed before, so the demo could show a
 * look that was never published.
 */
export function heroLook(outfits: Outfit[]): HeroLook | null {
  const chosen = newestFirst(outfits).find(
    (outfit) => outfit.items.filter(comparable).length >= 2,
  );
  if (!chosen) return null;

  return {
    slug: outfitSlug(chosen),
    date: chosen.date,
    occasion: chosen.occasion,
    celebrity: chosen.celebrity,
    event: chosen.event,
    items: chosen.items.filter(comparable).map((item) => ({
      name: item.name,
      short: garmentOf(item.name),
      wornBrand: item.wornBrand,
      swapBrand: item.swapBrand,
      worn: item.worn,
      swap: item.swap,
    })),
  };
}

export type DupePick = {
  slug: string;
  celebrity: string;
  worn: { name: string; brand: string; price: number; image?: string };
  swap: { name: string; brand: string; price: number; image?: string };
};

/**
 * The single piece with the widest rupee gap in the archive — the editor's
 * pick, picked by the archive. Was two product names typed into a form.
 */
export function dupeOfTheWeek(outfits: Outfit[]): DupePick | null {
  const candidates = outfits.flatMap((outfit) =>
    outfit.items.filter(comparable).map((item) => ({ outfit, item })),
  );
  if (candidates.length === 0) return null;

  const best = candidates.reduce((widest, entry) =>
    entry.item.worn - entry.item.swap > widest.item.worn - widest.item.swap ? entry : widest,
  );
  const photos = outfitPhotos(best.outfit);

  return {
    slug: outfitSlug(best.outfit),
    celebrity: best.outfit.celebrity,
    worn: {
      name: `${best.item.wornBrand} ${best.item.name.toLowerCase()}`,
      brand: best.item.wornBrand,
      price: best.item.worn,
      image: photos[0]?.url,
    },
    swap: {
      name: `${best.item.swapBrand} ${garmentOf(best.item.name).toLowerCase()}`,
      brand: best.item.swapBrand,
      price: best.item.swap,
      image: photos[1]?.url ?? photos[0]?.url,
    },
  };
}

export type HomeStat = { value: number; suffix: string; label: string };

/** The four figures under the hero. Every one of them a count, not a claim. */
export function homeStats(outfits: Outfit[], now = new Date()): HomeStat[] {
  const totals = archiveTotals(outfits, now);
  const stats: HomeStat[] = [
    { value: totals.looks, suffix: "", label: "Looks decoded" },
    { value: totals.pieces, suffix: "", label: "Pieces identified" },
  ];
  if (totals.averageSavingPct !== null) {
    stats.push({ value: totals.averageSavingPct, suffix: "%", label: "Average saving" });
  }
  if (totals.buyable > 0) {
    stats.push({ value: totals.buyable, suffix: "", label: "Complete looks you can copy" });
  }
  return stats;
}

/* ------------------------------------------------------------ the views */

/**
 * A record joined to the numbers the archive computes for it. Pages read
 * these, never the raw documents, so a count on a card and the looks behind it
 * can never disagree.
 */
export type CelebrityView = Celebrity & {
  stats: CelebrityStats;
  /** Among the busiest archives of the last month. */
  trending: boolean;
  /** False for a name the outfits mention that has no record of its own yet. */
  record: boolean;
};

export type OccasionView = Occasion & {
  stats: OccasionStats;
  /** Days until `nextDate`, once one is set and still ahead. */
  daysAway: number | null;
  record: boolean;
};

/** How far back "busiest right now" looks, and how many names it holds. */
const TRENDING_DAYS = 30;
const TRENDING_COUNT = 3;

/**
 * Names the outfits mention that no editorial record covers yet. Publishing a
 * look for someone new used to leave her out of the directory and her profile
 * URL pointing at a 404; she now appears with her counted archive, and the
 * panel flags the missing record so a bio can follow.
 *
 * Their ids are negative so they can never collide with a real record's.
 */
function unrecorded<T extends { name: string }>(
  records: T[],
  namesInArchive: string[],
): { id: number; name: string }[] {
  const known = new Set(records.map((record) => record.name.toLowerCase()));
  return namesInArchive
    .filter((name) => !known.has(name.toLowerCase()))
    .map((name, index) => ({ id: -(index + 1), name }));
}

export function celebrityViews(
  celebrities: Celebrity[],
  outfits: Outfit[],
  now = new Date(),
): CelebrityView[] {
  const recent = outfits.filter((outfit) => daysSince(outfit.date, now) <= TRENDING_DAYS);
  const hottest = new Set(
    tally(recent.map((outfit) => outfit.celebrity))
      .slice(0, TRENDING_COUNT)
      .map((entry) => entry.name),
  );

  const rows: { celebrity: Celebrity; record: boolean }[] = [
    ...celebrities.map((celebrity) => ({ celebrity, record: true })),
    ...unrecorded(celebrities, celebrityNames(outfits)).map((celebrity) => ({
      celebrity,
      record: false,
    })),
  ];

  return rows
    .map(({ celebrity, record }) => ({
      ...celebrity,
      stats: celebrityStats(outfits, celebrity.name, now),
      trending: hottest.has(celebrity.name),
      record,
    }))
    .sort((a, b) => b.stats.looks - a.stats.looks || a.name.localeCompare(b.name));
}

export function occasionViews(
  occasions: Occasion[],
  outfits: Outfit[],
  now = new Date(),
): OccasionView[] {
  const rows: { occasion: Occasion; record: boolean }[] = [
    ...occasions.map((occasion) => ({ occasion, record: true })),
    // An occasion with no record still gets a page, filed under Everyday until
    // an editor gives it a group and a description.
    ...unrecorded(occasions, occasionNames(outfits)).map(({ id, name }) => ({
      occasion: {
        id,
        name,
        group: "Everyday" as const,
        peak: "",
        description: "",
        colours: [],
      },
      record: false,
    })),
  ];

  return rows
    .map(({ occasion, record }) => {
      const away = occasion.nextDate ? daysUntil(occasion.nextDate, now) : null;
      return {
        ...occasion,
        stats: occasionStats(outfits, occasion.name),
        daysAway: away !== null && Number.isFinite(away) ? away : null,
        record,
      };
    })
    .sort((a, b) => b.stats.looks - a.stats.looks || a.name.localeCompare(b.name));
}

/** The dated occasions still ahead, soonest first — the "Coming up" rail. */
export const upcomingOccasions = (views: OccasionView[], limit = 6) =>
  views
    .filter((view) => view.daysAway !== null && view.daysAway >= 0)
    .sort((a, b) => (a.daysAway ?? 0) - (b.daysAway ?? 0))
    .slice(0, limit);

/** Looks belonging to any occasion in a group, for the campaign band and the
 *  wedding-season copy. */
export function looksInGroup(occasions: Occasion[], outfits: Outfit[], group: Occasion["group"]) {
  const names = new Set(
    occasions.filter((occasion) => occasion.group === group).map((occasion) => occasion.name.toLowerCase()),
  );
  return outfits.filter((outfit) => names.has(outfit.occasion.toLowerCase()));
}

/**
 * What a complete look at a price ceiling is typically made of: the commonest
 * garments inside that band and what each averages. The occasion pages used to
 * split every band into the same four invented percentages.
 */
export function bandComposition(outfits: Outfit[], cap: number, limit = 4) {
  const within = completeLooks(outfits).filter((outfit) => swapTotal(outfit) <= cap);
  const byGarment = new Map<string, number[]>();
  for (const outfit of within) {
    for (const item of outfit.items.filter(hasSwap)) {
      const key = garmentOf(item.name);
      if (!key) continue;
      byGarment.set(key, [...(byGarment.get(key) ?? []), item.swap]);
    }
  }
  return [...byGarment.entries()]
    .map(([name, prices]) => ({ name, looks: prices.length, price: Math.round(sum(prices) / prices.length) }))
    .sort((a, b) => b.looks - a.looks || b.price - a.price)
    .slice(0, limit);
}
