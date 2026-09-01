import { celebritySlug, nameSlug, outfitSlug } from "@/lib/slugs";
import { hasSwap, outfitPhoto, pricing } from "@/lib/types";
import type { Celebrity, Occasion, Outfit } from "@/lib/types";

/**
 * One index for the whole site, built from the archive.
 *
 * The header search box was a placeholder input that did nothing. Everything
 * searchable here is a page we actually serve, and every entry's subtitle is a
 * counted fact rather than a description, so a result tells you whether it is
 * worth the click before you take it.
 *
 * Brands are not entries of their own — they have no page — but they are in
 * each look's hidden terms, so "Bottega" finds the look carrying the bag.
 */

export type SearchKind = "Look" | "Celebrity" | "Occasion";

export type SearchEntry = {
  kind: SearchKind;
  title: string;
  subtitle: string;
  href: string;
  image?: string;
  /** Words that should match but are not shown. */
  terms: string;
  /** Breaks ties between equally good matches. */
  weight: number;
};

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function buildSearchIndex({
  outfits,
  celebrities,
  occasions,
}: {
  outfits: Outfit[];
  celebrities: Celebrity[];
  occasions: Occasion[];
}): SearchEntry[] {
  const lookEntries: SearchEntry[] = outfits.map((outfit) => {
    const money = pricing(outfit);
    const brands = outfit.items.flatMap((item) =>
      [item.wornBrand, item.swapBrand].filter(Boolean),
    );
    return {
      kind: "Look",
      title: `${outfit.celebrity} at ${outfit.event}`,
      subtitle: money.anySwapped
        ? `${outfit.occasion} · rebuild for ${inr.format(money.swapTotal)}`
        : `${outfit.occasion} · no swap yet`,
      href: `/outfits/${outfitSlug(outfit)}`,
      image: outfitPhoto(outfit)?.url,
      terms: [
        outfit.occasion,
        outfit.date,
        ...brands,
        ...outfit.items.map((item) => item.name),
      ].join(" "),
      // A look you can actually buy is the more useful answer.
      weight: money.allSwapped ? 3 : 2,
    };
  });

  const celebrityEntries: SearchEntry[] = celebrities.map((celebrity) => {
    const hers = outfits.filter((outfit) => outfit.celebrity === celebrity.name);
    return {
      kind: "Celebrity",
      title: celebrity.name,
      subtitle: hers.length
        ? `${hers.length} ${hers.length === 1 ? "look" : "looks"} decoded`
        : "Archive, nothing decoded yet",
      href: `/celebrities/${celebritySlug(celebrity)}`,
      image: hers.map((outfit) => outfitPhoto(outfit)?.url).find(Boolean),
      terms: hers.flatMap((outfit) => [outfit.occasion, outfit.event]).join(" "),
      weight: 4,
    };
  });

  const occasionEntries: SearchEntry[] = occasions.map((occasion) => {
    const theirs = outfits.filter(
      (outfit) => outfit.occasion.toLowerCase() === occasion.name.toLowerCase(),
    );
    const cheapest = theirs
      .filter((outfit) => outfit.items.length > 0 && outfit.items.every(hasSwap))
      .map((outfit) => pricing(outfit).swapTotal)
      .sort((a, b) => a - b)[0];
    return {
      kind: "Occasion",
      title: occasion.name,
      subtitle: cheapest
        ? `${theirs.length} looks · swaps from ${inr.format(cheapest)}`
        : `${theirs.length} ${theirs.length === 1 ? "look" : "looks"} decoded`,
      href: `/occasions/${nameSlug(occasion.name)}`,
      image: theirs.map((outfit) => outfitPhoto(outfit)?.url).find(Boolean),
      terms: [occasion.group, occasion.peak].filter(Boolean).join(" "),
      weight: 4,
    };
  });

  return [...celebrityEntries, ...occasionEntries, ...lookEntries];
}

const normalise = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    // Strip accents so "Hermes" finds "Hermès".
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** How well one entry answers one word. 0 means it does not. */
function scoreToken(entry: SearchEntry, token: string) {
  const title = normalise(entry.title);
  if (title === token) return 100;
  if (title.startsWith(token)) return 70;
  // A word boundary beats a match buried inside another word.
  if (new RegExp(`\\b${token}`).test(title)) return 50;
  if (title.includes(token)) return 30;
  const terms = normalise(entry.terms);
  if (new RegExp(`\\b${token}`).test(terms)) return 18;
  if (terms.includes(token)) return 8;
  return 0;
}

/**
 * Ranked results. Every word has to match something, so "alia airport" narrows
 * rather than widening into everything either word touches.
 */
export function searchEntries(index: SearchEntry[], query: string, limit = 40) {
  const tokens = normalise(query).split(" ").filter(Boolean);
  if (tokens.length === 0) return [];

  return index
    .map((entry) => {
      let total = 0;
      for (const token of tokens) {
        const score = scoreToken(entry, token);
        if (score === 0) return null;
        total += score;
      }
      return { entry, score: total + entry.weight };
    })
    .filter((hit): hit is { entry: SearchEntry; score: number } => hit !== null)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
    .slice(0, limit)
    .map((hit) => hit.entry);
}
