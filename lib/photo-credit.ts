/**
 * Whether a photo credit actually credits anybody.
 *
 * Every photograph on this site was taken by somebody else. The credit field
 * existed and was optional, so most images shipped with nothing at all and the
 * few that were filled in could have been filled in with anything. "Editorial
 * archive" satisfies a required field and names no one, which is worse than an
 * empty box: it looks like sourcing.
 *
 * So a credit has to point at a source a reader could go and check — an
 * account, a photographer, an agency, a label's own lookbook. The test is
 * deliberately crude and deliberately permissive about form: strip the words
 * that carry no attribution on their own, and see whether anything is left.
 * "Instagram" alone fails. "Instagram / @tridhac" passes, because the handle
 * survives. "Photo: Rohan Shrestha" passes. "Courtesy of the brand" does not.
 *
 * It cannot tell a real handle from an invented one. Nothing in code can. It
 * can stop the field being satisfied by a word that credits nobody, which is
 * the failure that actually happened here.
 */

/** The shortest credit worth having, once punctuation is off. */
const MIN_LENGTH = 3;

/**
 * Words that describe a *kind* of source rather than a source.
 *
 * Any of these may appear in a good credit — "Instagram / @handle" and "Photo:
 * Rohan Shrestha" both lead with one — but a credit made only of these names
 * nobody. Includes the ordinary stopwords, so "courtesy of the brand" reduces
 * to nothing rather than to "brand".
 */
const GENERIC = new Set([
  // Connectives, so a credit cannot pass on them alone.
  "a", "an", "and", "as", "at", "by", "for", "from", "in", "of", "on", "or",
  "the", "to", "via", "with",
  // The act, not the source.
  "photo", "photos", "photograph", "photography", "photographer", "image",
  "images", "picture", "pictures", "pic", "pics", "shot", "still", "credit",
  "credits", "courtesy", "source", "sourced", "supplied", "provided",
  // Platforms and channels with no account named.
  "instagram", "insta", "ig", "twitter", "x", "facebook", "fb", "youtube",
  "pinterest", "social", "media", "web", "website", "internet", "online",
  "google", "reel", "reels", "post", "story", "stories", "feed",
  // Categories of rights holder with nobody named.
  "brand", "brands", "label", "labels", "designer", "designers", "house",
  "agency", "agencies", "press", "pr", "publicist", "team", "studio",
  "official", "lookbook", "campaign", "editorial", "archive", "archives",
  "stock", "file", "library", "collection", "gallery",
  // Placeholders and refusals to answer.
  "na", "n", "none", "nil", "unknown", "unnamed", "various", "misc",
  "miscellaneous", "tbd", "tba", "todo", "pending", "own", "self", "ours",
  "mine", "us", "we", "public", "domain", "free", "royalty", "royaltyfree",
  "copyright", "all", "rights", "reserved",
]);

/** Lowercased words, with punctuation treated as a separator — except the @
 *  that makes a handle a handle, which is kept attached to its name. */
function words(credit: string): string[] {
  return credit
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9@]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * True when the credit names something specific enough to check.
 *
 * A bare "@" is not a handle and a lone digit is not a name, so a surviving
 * token still has to look like a word.
 */
export function isSpecificCredit(credit: string | undefined): boolean {
  const value = credit?.trim() ?? "";
  if (value.length < MIN_LENGTH) return false;

  return words(value).some((word) => {
    // A handle is specific by construction: @tridhac credits an account.
    if (word.startsWith("@")) return word.length > 1;
    if (GENERIC.has(word)) return false;
    // Reject pure numbers ("2026") and single letters.
    return word.length > 1 && !/^\d+$/.test(word);
  });
}

/** Said to an editor, and printed by the credit audit. One sentence, because
 *  it appears under a form field. */
export const CREDIT_REQUIRED_MESSAGE =
  "Every photo needs a credit naming its source — an account, a photographer, " +
  "an agency or a label, e.g. “Instagram / @handle”. Generic wording like " +
  "“Editorial archive” or “Courtesy of the brand” credits nobody.";

/** Photos on a look that name nobody. Empty when every photo is credited —
 *  including a look with no photos at all, which has a different problem. */
export const uncreditedPhotos = (outfit: {
  image?: { credit?: string };
  images?: { credit?: string }[];
}) => {
  const photos = outfit.images?.length ? outfit.images : outfit.image ? [outfit.image] : [];
  return photos.filter((photo) => !isSpecificCredit(photo.credit));
};

/**
 * What is wrong with a look's photographs, as lines an editor can act on.
 *
 * Empty means every photo names a source. The photo number leads each line
 * because a look carries up to eleven of them and "a photo is uncredited" is
 * not an instruction anybody can follow.
 */
export function creditProblems(images: { credit?: string }[]): string[] {
  return images
    .map((image, index) => ({ index, credit: image.credit?.trim() }))
    .filter((image) => !isSpecificCredit(image.credit))
    .map((image) =>
      image.credit
        ? `Photo ${image.index + 1}: “${image.credit}” names no source.`
        : `Photo ${image.index + 1} has no credit.`,
    );
}
