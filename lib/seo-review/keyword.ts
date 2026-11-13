/**
 * What a keyword asks for, how closely it describes this exact look, and
 * which other looks already chase something like it.
 *
 * Rule-based and transparent: every verdict names the words that produced it,
 * so an editor can see why and disagree. Nothing here measures demand — see
 * evidence.ts for that.
 */

import { keywordWords, words } from "@/lib/outfit-seo";
import { keywordKey } from "@/lib/seo-checks";
import { PIECE_CATEGORIES, PIECE_COLOUR_NAMES } from "@/lib/taxonomy";
import type { OutfitItem } from "@/lib/types";

export type Intent = "identify-outfit" | "buy" | "style-inspiration" | "celebrity-news" | "unclear";

export const INTENT_LABEL: Record<Intent, string> = {
  "identify-outfit": "Identify the outfit",
  buy: "Buy / find the price",
  "style-inspiration": "Style inspiration",
  "celebrity-news": "Celebrity news or profile",
  unclear: "Unclear",
};

const BUY = new Set(["buy", "price", "prices", "cost", "shop", "shopping", "online", "order", "sale", "discount", "cheap", "affordable", "under", "rs", "inr", "where", "dupe", "dupes", "lookalike", "replica", "myntra", "amazon", "ajio", "nykaa"]);
const INSPIRATION = new Set(["style", "styling", "ideas", "idea", "inspired", "inspiration", "lookbook", "trend", "trends", "trending", "aesthetic", "recreate", "copy", "how"]);
const NEWS = new Set(["news", "latest", "age", "husband", "wife", "boyfriend", "girlfriend", "movie", "movies", "film", "films", "net", "worth", "biography", "bio", "family", "height", "salary", "songs", "song", "video", "videos", "pics", "photos", "images", "instagram", "wiki", "religion", "caste", "house", "car"]);
/** Words that say "clothes": the taxonomy's categories plus everyday names for them. */
export const GARMENT_WORDS = new Set([
  ...PIECE_CATEGORIES.flatMap((category) => category.split(/[\s-]+/)),
  "outfit", "outfits", "look", "looks", "wore", "wearing", "worn", "dress", "dresses", "sari", "sarees", "lehengas", "kurti", "kurta",
  "gown", "gowns", "suit", "sharara", "gharara", "blouse", "choli", "dupatta", "salwar", "palazzo", "coord", "corset", "bodycon",
  "maxi", "midi", "mini", "jacket", "coat", "pants", "trouser", "tee", "tshirt", "shoes", "heel", "sandal", "sneaker", "clutch",
  "earring", "jhumka", "jhumkas", "jewellery", "jewelry", "bracelet", "watch", "set", "fashion", "attire", "costume",
].filter((word) => word && word !== "other"));
const LOOK_ONLY = new Set(["outfit", "outfits", "look", "looks", "wore", "wearing", "worn", "fashion", "attire", "style", "set"]);
const COLOUR_WORDS = new Set(PIECE_COLOUR_NAMES.flatMap((name) => name.toLowerCase().split(/\s+/)));

const has = (list: Set<string>, tokens: string[]) => tokens.filter((token) => list.has(token));

/** What the searcher most likely wants, and whether an outfit page can give it. */
export function classifyIntent(keyword: string, celebrity: string) {
  const tokens = words(keyword);
  const name = words(celebrity);
  const named = name.length > 0 && name.some((part) => tokens.includes(part));
  const buy = has(BUY, tokens);
  const inspiration = has(INSPIRATION, tokens);
  const garment = has(GARMENT_WORDS, tokens);
  const news = has(NEWS, tokens);

  let intent: Intent;
  let signals: string[];
  if (!tokens.length) [intent, signals] = ["unclear", []];
  else if (buy.length) [intent, signals] = ["buy", buy];
  else if (news.length && !garment.length) [intent, signals] = ["celebrity-news", news];
  else if (inspiration.length && garment.length) [intent, signals] = ["style-inspiration", inspiration];
  else if (garment.length) [intent, signals] = ["identify-outfit", garment];
  else if (named) [intent, signals] = ["celebrity-news", name.filter((part) => tokens.includes(part))];
  else [intent, signals] = ["unclear", []];

  const fitsPage = intent === "identify-outfit" || intent === "buy" || intent === "style-inspiration";
  const explanation: Record<Intent, string> = {
    "identify-outfit": "People searching this want to know what was worn — exactly what an outfit page answers.",
    buy: "People searching this want a price or a place to buy. The page fits if the pieces are identified and linked.",
    "style-inspiration": "People searching this want ideas. The page fits if it explains how to wear the look, not just what it is.",
    "celebrity-news": "People searching this want news or a profile, not an outfit. An outfit page is unlikely to satisfy it.",
    unclear: "The words do not say what the searcher wants. Name the garment, colour or brand.",
  };
  return { intent, label: INTENT_LABEL[intent], fitsPage, signals, explanation: explanation[intent] };
}

export type FacetStatus = "match" | "partial" | "absent" | "mismatch";
export type Facet = { status: FacetStatus; detail: string };

export type LookFacts = {
  celebrity: string;
  event: string;
  occasions: string[];
  items: Pick<OutfitItem, "name" | "category" | "colours" | "wornBrand" | "swapBrand">[];
};

/**
 * How the keyword lines up with this exact look: celebrity, garment, colour,
 * brand and occasion. A word the keyword promises that the look does not have
 * — a "red saree" for a black dress — is a mismatch, the most serious finding,
 * because the page would not answer the search it targets.
 */
export function relevance(keyword: string, look: LookFacts) {
  const tokens = words(keyword);
  const name = words(look.celebrity);
  const nameHits = name.filter((part) => tokens.includes(part));
  const celebrity: Facet = !name.length
    ? { status: "absent", detail: "The look has no celebrity yet." }
    : nameHits.length === name.length
      ? { status: "match", detail: `Names ${look.celebrity}.` }
      : nameHits.length
        ? { status: "partial", detail: `Only part of the name (${nameHits.join(" ")}). Searchers usually type the full name.` }
        : { status: "absent", detail: `Does not name ${look.celebrity}. Without the name the keyword is about any outfit.` };

  const pieceWords = new Set(look.items.flatMap((item) => [...words(item.name), ...words(item.category)]));
  const garmentTokens = tokens.filter((token) => GARMENT_WORDS.has(token) && !LOOK_ONLY.has(token));
  const missingGarments = garmentTokens.filter((token) => !pieceWords.has(token) && !pieceWords.has(token.replace(/s$/, "")));
  const garment: Facet = !garmentTokens.length
    ? { status: "absent", detail: "No garment named. A garment word (dress, saree, lehenga…) says what the page is about." }
    : missingGarments.length
      ? { status: "mismatch", detail: `Says “${missingGarments.join(", ")}” but no piece on this look is one.` }
      : { status: "match", detail: `Names ${garmentTokens.join(", ")}, which this look has.` };

  const lookColours = new Set(look.items.flatMap((item) => [...(item.colours ?? []).flatMap((c) => words(c)), ...words(item.name).filter((w) => COLOUR_WORDS.has(w))]));
  const colourTokens = tokens.filter((token) => COLOUR_WORDS.has(token));
  const wrongColours = colourTokens.filter((token) => !lookColours.has(token));
  const colour: Facet = !colourTokens.length
    ? { status: "absent", detail: "No colour named. Colour is often how people describe a look they saw." }
    : wrongColours.length
      ? { status: "mismatch", detail: `Says “${wrongColours.join(", ")}” but no piece is tagged that colour.` }
      : { status: "match", detail: `Names ${colourTokens.join(", ")}, which this look has.` };

  const brands = [...new Set(look.items.flatMap((item) => [item.wornBrand, item.swapBrand]).filter((b): b is string => Boolean(b?.trim())))];
  const brandHit = brands.find((brand) => {
    const parts = words(brand);
    return parts.length > 0 && parts.every((part) => tokens.includes(part));
  });
  const brand: Facet = brandHit
    ? { status: "match", detail: `Names ${brandHit}.` }
    : { status: "absent", detail: brands.length ? `Does not name a brand (${brands.slice(0, 3).join(", ")}).` : "No brand identified on this look yet." };

  const occasionWords = new Set([...look.occasions, look.event].flatMap((value) => words(value)));
  // An event named "Back to Black" must not turn the colour "black" into an occasion match.
  const occasionHits = tokens.filter((token) => occasionWords.has(token) && !name.includes(token) && !COLOUR_WORDS.has(token) && !GARMENT_WORDS.has(token));
  const occasion: Facet = occasionHits.length
    ? { status: "match", detail: `Mentions ${occasionHits.join(", ")}.` }
    : { status: "absent", detail: "No event or occasion named. Fine for most looks; useful when the event is what people remember." };

  const mismatches = [garment, colour].filter((facet) => facet.status === "mismatch").map((facet) => facet.detail);
  return { celebrity, garment, colour, brand, occasion, mismatches };
}

export type OtherLook = {
  id: number;
  slug: string;
  title: string;
  celebrity: string;
  published: boolean;
  keywords: string[];
  notes: string;
};

export type Overlap = { id: number; slug: string; title: string; published: boolean; kind: "same-keyword" | "similar-keyword" | "similar-title"; shared: string[] };

const jaccard = (a: string[], b: string[]) => {
  const A = new Set(a);
  const B = new Set(b);
  const inter = [...A].filter((x) => B.has(x));
  return { score: inter.length / (new Set([...A, ...B]).size || 1), shared: inter };
};

/**
 * Other looks that compete for the same search. The same keyword is the hard
 * case (the existing checklist blocks publishing on a live one). A keyword
 * sharing most of its words, or a live page whose title already says the same
 * thing, is the soft case: the two pages split Google's attention.
 */
export function keywordOverlaps(keyword: string, others: OtherLook[], selfId?: number): Overlap[] {
  const key = keywordKey(keyword);
  const mine = keywordWords(keyword);
  if (!mine.length) return [];
  const found: Overlap[] = [];
  for (const other of others) {
    if (other.id === selfId) continue;
    const base = { id: other.id, slug: other.slug, title: other.title, published: other.published };
    const same = other.keywords.find((k) => keywordKey(k) === key);
    if (same) {
      found.push({ ...base, kind: "same-keyword", shared: keywordWords(same) });
      continue;
    }
    const similar = other.keywords.map((k) => jaccard(mine, keywordWords(k))).find((j) => j.score >= 0.6 && j.shared.length >= 3);
    if (similar) {
      found.push({ ...base, kind: "similar-keyword", shared: similar.shared });
      continue;
    }
    const title = keywordWords(other.title);
    const covered = mine.filter((word) => title.includes(word));
    if (mine.length >= 3 && covered.length === mine.length) found.push({ ...base, kind: "similar-title", shared: covered });
  }
  const order = { "same-keyword": 0, "similar-keyword": 1, "similar-title": 2 };
  return found.sort((a, b) => order[a.kind] - order[b.kind] || Number(b.published) - Number(a.published));
}

/**
 * Keyword ideas assembled from what this look actually is: name + colour +
 * garment, name + brand + garment, name + event. Starting points to research,
 * not recommendations — none of them has demand evidence until someone records it.
 */
export function keywordIdeas(look: Omit<LookFacts, "items"> & { leadPieceId?: string; items: (LookFacts["items"][number] & { id?: string })[] }): string[] {
  const lead = look.items.find((item) => item.id !== undefined && item.id === look.leadPieceId) ?? look.items[0];
  if (!look.celebrity.trim() || !lead) return [];
  const name = look.celebrity.trim().toLowerCase();
  const garment = lead.category && lead.category !== "other" ? lead.category : (words(lead.name).filter((w) => GARMENT_WORDS.has(w)).pop() ?? "");
  const colour = (lead.colours ?? [])[0]?.toLowerCase() ?? "";
  const brand = (lead.wornBrand ?? "").trim().toLowerCase();
  const event = look.event.trim().toLowerCase();
  const occasion = (look.occasions[0] ?? "").trim().toLowerCase();
  const ideas = [
    [name, colour, garment],
    [name, brand, garment],
    [name, colour, garment, brand],
    [name, event, garment || "outfit"],
    [name, occasion, "look"],
    [brand, colour, garment],
    [name, garment, "price"],
  ]
    .map((parts) => parts.filter(Boolean))
    .filter((parts) => parts.length >= 3 || (parts.length === 2 && parts[0] !== name))
    .map((parts) => parts.join(" ").replace(/\s+/g, " ").trim());
  return [...new Set(ideas)].filter((idea) => idea.split(" ").length <= 9).slice(0, 6);
}
