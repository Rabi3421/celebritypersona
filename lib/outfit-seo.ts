import { garmentOf } from "@/lib/archive";
import { clampDescription } from "@/lib/seo";
import { nameSlug } from "@/lib/slugs";
import { hasWornBrand, leadPiece, pricing, type Outfit } from "@/lib/types";

/**
 * What an outfit says to a search engine: its title (which is also its H1) and
 * its description, with their fallbacks.
 *
 * Shared by the public page, the admin form's Google preview and the SEO
 * checklist, so the preview shows what the page will actually print and the
 * checklist grades the same strings. Pure — safe in the browser.
 */

/** The fields the title and description are built from. */
export type OutfitSeoInput = Pick<
  Outfit,
  "celebrity" | "event" | "occasion" | "items" | "notes" | "seoTitle" | "seoDescription" | "leadPieceId"
>;

const inr = (value: number) => `₹${value.toLocaleString("en-IN")}`;

/**
 * What the search result actually says. The editor's own first paragraph beats
 * anything generated, so it wins when there is one. Otherwise the line is built
 * from what the look really holds: it used to promise "swaps for ₹0" on every
 * look nobody had found a swap for yet.
 */
export function describe(outfit: OutfitSeoInput) {
  const notes = outfit.notes?.[0]?.trim();
  if (notes) return notes.length > 158 ? `${notes.slice(0, 155).trimEnd()}…` : notes;

  const money = pricing(outfit);

  /**
   * A look with no pieces has nothing to describe. `isPublished` keeps those
   * off the site, so this should be unreachable — but it was not: the line
   * came out as "identified piece by piece — 0 pieces", and it went into the
   * description, the og:description and the twitter:description of a record
   * that had had its fabricated pieces removed. A generator that counts
   * should say nothing rather than count to zero.
   */
  if (money.pieces === 0) {
    return `${outfit.celebrity} at ${outfit.event}, from the CelebrityPersona archive.`;
  }

  const pieces = `${money.pieces} ${money.pieces === 1 ? "piece" : "pieces"}`;
  // Only the labels we have actually identified. "by " with nothing after it
  // is worse than not naming a label at all.
  const named = [...new Set(outfit.items.filter(hasWornBrand).map((item) => item.wornBrand))];
  const by = named.length ? ` by ${named.join(", ")}` : "";

  if (money.anySwapped) {
    return `Every piece ${outfit.celebrity} wore at ${outfit.event} — ${pieces}${by}, with price-checked swaps from ${inr(money.swapTotal)}.`;
  }
  if (money.anyPriced) {
    return `Every piece ${outfit.celebrity} wore at ${outfit.event}, identified and priced — ${pieces}${by}, ${inr(money.wornTotal)} as worn.`;
  }
  return `Every piece ${outfit.celebrity} wore at ${outfit.event}, identified piece by piece — ${pieces}${by}.`;
}

/** Google shows about 60 characters, and 65 is where a fitted title starts
 *  being cut. */
export const TITLE_LIMIT = 62;

/**
 * Occasion words worth carrying into the title, because "<name> airport look"
 * and "<name> wedding look" are searched far more than the event's own name.
 * Anything not listed here is left out rather than bent into a phrase.
 */
const OCCASION_PHRASE: Record<string, string> = {
  Airport: "Airport Look",
  "Red carpet": "Red Carpet Look",
  Sangeet: "Sangeet Look",
  Mehendi: "Mehendi Look",
  Reception: "Reception Look",
  Haldi: "Haldi Look",
  Engagement: "Engagement Look",
  Diwali: "Diwali Look",
  Navratri: "Navratri Look",
  Holi: "Holi Look",
  Eid: "Eid Look",
  "Karwa Chauth": "Karwa Chauth Look",
  "Promo tour": "Promo Look",
};

/**
 * What the search result's blue link says. The editor's own title wins;
 * otherwise the widest form that fits, preferring the shapes people actually
 * type: her name, the occasion, the garment, the label.
 */
export function headline(outfit: OutfitSeoInput) {
  const own = outfit.seoTitle?.trim();
  if (own) return own;

  const piece = leadPiece(outfit);
  const fallback = `${outfit.celebrity} at ${outfit.event}`;
  if (!piece) return fallback;

  // The editor's category when there is one; the last word of the name was
  // how "… Midi Dress with Mesh Sleeves" became a title about Sleeves.
  const garment = garmentName(piece);
  const occasion = OCCASION_PHRASE[outfit.occasion];
  const label = piece.wornBrand;
  /**
   * The house formula is "<Celebrity> at <Event>: <Piece> by <Label>", and it
   * leads the list below. The rest are the same sentence shortened, in the
   * order that keeps the most useful words, because Google truncates at around
   * sixty characters and a cut title is worse than a narrower one.
   *
   * An editor's own seoTitle still wins over all of it, so nothing here
   * rewrites a title somebody has already chosen.
   */
  const candidates = [
    label && `${outfit.celebrity} at ${outfit.event}: ${piece.name} by ${label}`,
    label && `${outfit.celebrity} at ${outfit.event}: ${garment} by ${label}`,
    label && occasion && `${outfit.celebrity} ${occasion}: ${piece.name} by ${label}`,
    label && occasion && `${outfit.celebrity} ${occasion}: ${garment} by ${label}`,
    label && `${outfit.celebrity}'s ${piece.name} — ${label}`,
    label && `${outfit.celebrity}'s ${garment} — ${label}`,
    occasion && `${outfit.celebrity} ${occasion}: ${garment}`,
    `${outfit.celebrity}'s ${piece.name}`,
    `${outfit.celebrity}'s ${garment}`,
  ].filter((value): value is string => Boolean(value));
  return candidates.find((candidate) => candidate.length <= TITLE_LIMIT) ?? fallback;
}

/** The description a page actually prints: the editor's own, or the
 *  generated line, trimmed to what a result shows. */
export const finalDescription = (outfit: OutfitSeoInput) =>
  clampDescription(outfit.seoDescription?.trim() || describe(outfit));

/** What a piece is called in a title: its category, or failing that the last
 *  word of its name. */
const garmentName = (piece: { name: string; category?: string }) =>
  piece.category && piece.category !== "other"
    ? piece.category.replace(/(^|[\s-])([a-z])/g, (_, lead: string, letter: string) => lead + letter.toUpperCase())
    : garmentOf(piece.name);

/* ------------------------------------------------------------ keywords */

/**
 * Words that carry no search intent, dropped from keywords before they are
 * matched and from slugs before they are built.
 */
const STOP_WORDS = new Set([
  "a", "an", "the", "of", "in", "at", "on", "for", "and", "with", "to", "by", "from", "her", "his", "as",
]);

/** Lowercase words, with possessives folded ("Vasanth's" → "vasanth"). */
export const words = (text: string | undefined) =>
  (text ?? "")
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** The words of a keyword that have to show up somewhere: no stop words, no
 *  repeats. "rukmini vasanth black dress" → rukmini, vasanth, black, dress. */
export const keywordWords = (keyword: string | undefined) => [
  ...new Set(words(keyword).filter((word) => !STOP_WORDS.has(word))),
];

/** Singular and plural count as the same word: "heel" matches "heels". */
const sameWord = (a: string, b: string) => a === b || a === `${b}s` || `${a}s` === b;

/** The keyword words missing from a piece of text. Empty means it is all there. */
export function missingWords(text: string | undefined, keyword: string | undefined) {
  const present = words(text);
  return keywordWords(keyword).filter((word) => !present.some((token) => sameWord(token, word)));
}

/* ----------------------------------------------------------- generators */

const titleCase = (text: string) =>
  text.replace(/(^|[\s-])([a-z])/g, (_, lead: string, letter: string) => lead + letter.toUpperCase());

type GeneratorInput = OutfitSeoInput & { primaryKeyword?: string };

function leadFacts(outfit: GeneratorInput) {
  const lead = leadPiece(outfit);
  return {
    lead,
    colour: lead?.colours?.[0] ? titleCase(lead.colours[0]) : undefined,
    garment: lead ? garmentName(lead) : undefined,
    brand: lead ? (lead.wornBrand ?? lead.swapBrand) : undefined,
  };
}

/**
 * A search title from the template "{Celebrity}'s {Colour} {Garment} by
 * {Brand}", preferring the widest form that fits in 60 characters and still
 * holds every word of the primary keyword. When the template cannot hold the
 * keyword, the keyword itself leads.
 */
export function generateTitle(outfit: GeneratorInput, limit = 60): string {
  const { colour, garment, brand } = leadFacts(outfit);
  const who = `${outfit.celebrity}'s`;
  const piece = [colour, garment].filter(Boolean).join(" ");
  const keyword = outfit.primaryKeyword?.trim() ? titleCase(outfit.primaryKeyword.trim()) : undefined;

  const candidates = [
    piece && brand && `${who} ${piece} by ${brand}`,
    piece && brand && `${who} ${piece} — ${brand}`,
    keyword && brand && `${keyword} by ${brand}`,
    keyword && brand && `${keyword} — ${brand}`,
    piece && `${who} ${piece}`,
    keyword,
  ].filter((value): value is string => Boolean(value));
  if (!candidates.length) return `${outfit.celebrity} at ${outfit.event}`;

  const holds = (title: string) => missingWords(title, outfit.primaryKeyword).length === 0;
  return (
    candidates.find((title) => title.length <= limit && holds(title)) ??
    candidates.find(holds) ??
    candidates.find((title) => title.length <= limit) ??
    candidates[0]
  );
}

/** The keyword as the opening of a sentence, with the celebrity's and the
 *  brand's words given their capitals back. */
function keywordSentence(keyword: string, outfit: GeneratorInput, brand?: string) {
  const proper = new Map(
    [...outfit.celebrity.split(/\s+/), ...(brand?.split(/\s+/) ?? [])].map((word) => [word.toLowerCase(), word]),
  );
  const text = keyword
    .trim()
    .split(/\s+/)
    .map((word) => proper.get(word.toLowerCase()) ?? word)
    .join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * A search description that opens with the primary keyword and closes on the
 * swap price in rupees: "Rukmini Vasanth black dress: she wore the … by Club L
 * London. Get the lookalike for ₹9,600 and see where to buy it." Shortened
 * clause by clause until it fits.
 */
export function generateDescription(outfit: GeneratorInput, limit = 160): string {
  const { lead, brand } = leadFacts(outfit);
  const money = pricing(outfit);
  const opener = outfit.primaryKeyword?.trim()
    ? keywordSentence(outfit.primaryKeyword, outfit, brand)
    : `${outfit.celebrity} at ${outfit.event}`;
  const by = brand ? ` by ${brand}` : "";
  const worn = lead?.worn ? ` (${inr(lead.worn)})` : "";
  const close = money.anySwapped
    ? `Get the lookalike for ${inr(money.swapTotal)} and see where to buy it.`
    : "Every piece identified, priced and linked.";

  const candidates = [
    lead && `${opener}: ${outfit.celebrity} wore the ${lead.name}${by}${worn}. ${close}`,
    lead && `${opener}: ${outfit.celebrity} wore the ${lead.name}${by}. ${close}`,
    lead && `${opener}: the ${lead.name}${by}. ${close}`,
    brand && `${opener}${by}. ${close}`,
    `${opener}. ${close}`,
  ].filter((value): value is string => Boolean(value));
  return candidates.find((line) => line.length <= limit) ?? clampDescription(candidates[candidates.length - 1], limit);
}

/**
 * A slug built from the primary keyword, with the lead piece's label added when
 * the keyword does not already name it: lowercase, hyphens, no dates and no
 * stop words. Falls back to a numbered suffix when the result is taken.
 */
export function suggestKeywordSlug(
  outfit: GeneratorInput,
  taken: readonly string[] = [],
): string | undefined {
  const keyword = keywordWords(outfit.primaryKeyword);
  if (!keyword.length) return undefined;
  const { brand } = leadFacts(outfit);
  const brandWords = words(brand).filter((word) => !STOP_WORDS.has(word) && !keyword.includes(word));
  const base = nameSlug([...keyword, ...brandWords].join(" "));

  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let suffix = 2; suffix < 50; suffix += 1) {
    if (!used.has(`${base}-${suffix}`)) return `${base}-${suffix}`;
  }
  return base;
}
