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
   * Words an editor wrote as the page's intro: a celebrity's bio, or the
   * `intro` of an occasion, brand or budget page. The generated fallback bio
   * never counts — it is built from the looks, so it adds nothing they do not.
   */
  introWords: number;
};

/**
 * The rule every hub page applies: it asks to be indexed when it has at least
 * one look and is not thin — two or more looks, or an intro of real length.
 * A page that fails is "noindex, follow" and is left out of the sitemap.
 */
export const isThinHub = ({ looks, introWords }: Hub) =>
  looks < MIN_HUB_LOOKS && introWords < MIN_INTRO_WORDS;

export const hubIndexable = (hub: Hub) => hub.looks > 0 && !isThinHub(hub);

/** What the admin lists show for a hub. */
export function hubSearchStatus(hub: Hub) {
  const indexed = hubIndexable(hub);
  return {
    indexed,
    /** noindex only for want of an intro: a second look or 100 words fixes it. */
    needsIntro: !indexed && hub.looks > 0,
    label: indexed ? "Indexed" : "noindex, follow",
  };
}
