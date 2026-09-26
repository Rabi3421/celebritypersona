/**
 * Whether a hub page — a celebrity or an occasion — asks to be indexed.
 *
 * One place, because the page's robots tag, the sitemap and the admin lists
 * all have to give the same answer. A hub that fails is "noindex, follow",
 * never "nofollow": it keeps passing its links to the looks it lists.
 */

/** A hub needs this many looks to stand on its own… */
export const MIN_HUB_LOOKS = 2;

/** …or an intro at least this long. The brief asks for 100–300 words. */
export const MIN_INTRO_WORDS = 100;

export const wordCount = (text: string | readonly string[] | undefined) =>
  (Array.isArray(text) ? text.join(" ") : ((text as string | undefined) ?? ""))
    .split(/\s+/)
    .filter(Boolean).length;

type Hub = {
  looks: number;
  /**
   * Words an editor wrote for this page. For a celebrity, her bio; for an
   * occasion, its description. The generated fallback bio never counts — it is
   * built from the looks, so it adds nothing the looks do not already say.
   */
  introWords: number;
};

/** The rule the public pages apply today: any look at all. */
export const hubIndexedNow = ({ looks }: Pick<Hub, "looks">) => looks > 0;

/**
 * The rule the pages move to in Phase 4: fewer than two looks and no intro of
 * real length is a thin page, and stays out of the index until it has one.
 */
export const isThinHub = ({ looks, introWords }: Hub) =>
  looks < MIN_HUB_LOOKS && introWords < MIN_INTRO_WORDS;

/** What the admin lists show for a hub. */
export function hubSearchStatus(hub: Hub) {
  const indexed = hubIndexedNow(hub);
  return {
    indexed,
    /** Indexed today, noindex once the Phase 4 rule is on. */
    needsIntro: indexed && isThinHub(hub),
    label: indexed ? "Indexed" : "noindex, follow",
  };
}
