import { inr, plural } from "@/lib/format";
import { buildSearchIndex, searchEntries, type SearchEntry } from "@/lib/search";
import { sameName } from "@/lib/archive";
import { isFullySwapped, pricing, type Celebrity, type Occasion, type Outfit } from "@/lib/types";

/**
 * The one-line answer under each row of the trending leaderboard, computed
 * from the looks an editor has actually published.
 *
 * The blurbs used to be free text typed into the admin form, and they said
 * things the archive had never contained: a ₹4,43,500 airport look rebuilding
 * for ₹5,489 under a celebrity's name who has nothing decoded here, "nine
 * decoded sangeet looks" against one, a ₹22,000 pair of juttis swapping to
 * ₹400. A leaderboard row is a question, and the site was answering questions
 * it could not answer.
 *
 * Now the row's answer and the row's destination come from the same place. The
 * term is run through the site's own search — the same index and the same
 * ranking the /search page uses — and the blurb describes exactly the looks
 * that search returns. A row nothing matches says so and links to the search
 * results for it, which is an honest page rather than a dead end.
 *
 * The stored `answer` field is no longer read by anything public. It is left
 * on the document, and on the admin form, only so an editor's old wording is
 * not silently destroyed.
 */

export type TrendingAnswer = {
  /** What the row publishes under the term. */
  text: string;
  /** True when at least one published look stands behind `text`. */
  decoded: boolean;
  /** How many looks the term matched. */
  looks: number;
};

/** Said when the archive has nothing for the question. Deliberately flat: it
 *  is not a teaser, and it must not read as one. */
const NOT_DECODED = "Not decoded yet";

/**
 * The looks a leaderboard term actually finds.
 *
 * Resolved through the search index rather than by matching fields directly,
 * so the row's blurb and the row's link can never disagree: whatever the
 * reader lands on is what was counted here. A celebrity or occasion hit
 * resolves to that person's or that event's looks, which is what the reader
 * means by the query.
 */
function matchedLooks(
  term: string,
  index: SearchEntry[],
  outfits: Outfit[],
): Outfit[] {
  const hits = searchEntries(index, term);
  if (hits.length === 0) return [];

  const found = new Map<number, Outfit>();
  for (const hit of hits) {
    if (hit.kind === "Look") {
      // The entry's title is built as "<celebrity> at <event>", which is the
      // only handle it carries back to the document.
      const outfit = outfits.find(
        (candidate) => `${candidate.celebrity} at ${candidate.event}` === hit.title,
      );
      if (outfit) found.set(outfit.id, outfit);
      continue;
    }

    const field = hit.kind === "Celebrity" ? "celebrity" : "occasion";
    for (const outfit of outfits) {
      if (sameName(outfit[field], hit.title)) found.set(outfit.id, outfit);
    }
  }
  return [...found.values()];
}

/**
 * A blurb built only from what the matched looks contain.
 *
 * Four cases, in descending order of what we can honestly offer: a look you
 * could buy end to end, a look with an alternative found but not fully priced,
 * a look whose original we confirmed but have no alternative for, and a look
 * we have decoded but priced on neither side. Each one says which it is.
 */
function describe(looks: Outfit[]): string {
  const count = plural(looks.length, "look");

  const complete = looks.filter(isFullySwapped);
  if (complete.length > 0) {
    const cheapest = Math.min(...complete.map((look) => pricing(look).swapTotal));
    return `${count} decoded · cheapest complete rebuild ${inr(cheapest)}`;
  }

  const swapped = looks.filter((look) => pricing(look).anySwapped);
  if (swapped.length > 0) {
    return `${count} decoded · ${swapped.length} with an alternative found so far`;
  }

  const priced = looks.filter((look) => pricing(look).anyPriced);
  if (priced.length > 0) {
    const cheapest = Math.min(...priced.map((look) => pricing(look).wornTotal));
    return `${count} decoded · originals from ${inr(cheapest)}, no alternative yet`;
  }

  return `${count} decoded · prices not confirmed yet`;
}

/** Builds the index once, for a caller answering a whole leaderboard. */
export function trendingAnswerer({
  outfits,
  celebrities,
  occasions,
}: {
  outfits: Outfit[];
  celebrities: Celebrity[];
  occasions: Occasion[];
}) {
  const index = buildSearchIndex({ outfits, celebrities, occasions });

  return (term: string): TrendingAnswer => {
    const looks = matchedLooks(term, index, outfits);
    return looks.length === 0
      ? { text: NOT_DECODED, decoded: false, looks: 0 }
      : { text: describe(looks), decoded: true, looks: looks.length };
  };
}
