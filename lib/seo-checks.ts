import { wordCount } from "@/lib/indexing";
import { creditProblems } from "@/lib/photo-credit";
import { describe, headline, keywordWords, missingWords, words, type OutfitSeoInput } from "@/lib/outfit-seo";
import { outfitOccasions, hasSwap, hasWornPrice } from "@/lib/types";
import type { PieceCategory } from "@/lib/taxonomy";

/**
 * The SEO checklist for one outfit.
 *
 * Pure, so the admin form runs it live on every keystroke and the save action
 * runs the same function before letting a look go live — the panel cannot
 * show green on something the server then refuses, or the reverse.
 *
 * Critical checks block publishing a look that is not live yet; a draft saves
 * whatever they say, and a look that is already live keeps saving too, with
 * the failures shown, so fixing a price never waits on an unrelated gap.
 * Warnings never block.
 */

export type SeoDraft = OutfitSeoInput & {
  slug: string;
  primaryKeyword?: string;
  occasions?: string[];
  images: { url: string; alt?: string; credit?: string }[];
  photoCredit?: string;
  /** Whether the editor picked the lead, rather than it being inferred. */
  leadChosen: boolean;
};

/** Another look's claim on a keyword, for the cannibalisation check. */
export type KeywordOwner = {
  id: number;
  keyword: string;
  title: string;
  slug: string;
  published: boolean;
};

export type SeoCheck = {
  id: string;
  level: "critical" | "warning";
  ok: boolean;
  label: string;
  /** What is wrong, when it is. */
  detail?: string;
};

/** "About this look" needs roughly this much to say something a product page does not. */
export const MIN_ABOUT_WORDS = 150;
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

/** Two keywords are the same target when their meaningful words are. */
export const keywordKey = (keyword: string | undefined) => keywordWords(keyword).sort().join(" ");

/** The other looks already targeting this keyword. */
export const keywordClashes = (keyword: string | undefined, owners: KeywordOwner[], selfId?: number) => {
  const key = keywordKey(keyword);
  return key ? owners.filter((owner) => owner.id !== selfId && keywordKey(owner.keyword) === key) : [];
};

/**
 * Words that name a piece in the write-up, and the category that piece would
 * be filed under. A heuristic: if the text talks about earrings and no piece is
 * earrings, the earrings were probably worn and not decoded.
 */
const MENTIONS: [RegExp, PieceCategory][] = [
  [/^(earring|jhumka|jhumki|stud|hoop)s?$/, "earrings"],
  [/^rings?$/, "ring"],
  [/^(bag|clutch|potli|tote|handbag|purse)s?$/, "bag"],
  [/^(heel|stiletto|pump)s?$/, "heels"],
  [/^sandals?$/, "sandals"],
  [/^(flat|jutti|mojari|loafer)s?$/, "flats"],
  [/^sneakers?$/, "sneakers"],
  [/^(necklace|choker|chain|pendant)s?$/, "necklace"],
  [/^(bangle|bracelet|kada|cuff)s?$/, "bangles"],
  [/^(sunglasses|shades)$/, "sunglasses"],
];

const hasDollars = (text: string) => /\$\s?\d/.test(text);
const hasRupees = (text: string) => /₹|\bRs\.?\s?\d|\bINR\b/i.test(text);

export function seoChecks(
  draft: SeoDraft,
  context: { id?: number; owners: KeywordOwner[] },
): SeoCheck[] {
  const keyword = draft.primaryKeyword?.trim();
  const title = headline(draft);
  const ownDescription = draft.seoDescription?.trim();
  const description = ownDescription || describe(draft);
  const notes = draft.notes ?? [];
  const about = notes.join(" ");
  const aboutWords = wordCount(notes);
  const missing = (text: string) => missingWords(text, keyword);
  const list = (items: string[]) => items.join(", ");

  const titleGap = missing(title);
  const slugGap = missing(draft.slug.replace(/-/g, " "));
  const introGap = missing(notes[0] ?? "");
  const descriptionGap = missing(description);
  const noAlt = draft.images.filter((image) => !image.alt?.trim()).length;
  const credits = draft.images.length ? creditProblems(draft) : [];
  const uncategorised = draft.items.filter((item) => !item.category).length;
  const clashes = keywordClashes(keyword, context.owners, context.id);
  const liveClash = clashes.find((owner) => owner.published);
  const occasions = outfitOccasions(draft);

  const mentioned = [...new Set(
    words(about).flatMap((word) => MENTIONS.filter(([pattern]) => pattern.test(word)).map(([, category]) => category)),
  )];
  const undecoded = mentioned.filter((category) => !draft.items.some((item) => item.category === category));

  const dollarsIn = [
    ...(hasDollars(description) && !hasRupees(description) ? ["the search description"] : []),
    ...(hasDollars(about) && !hasRupees(about) ? ["About this look"] : []),
  ];

  const critical = (id: string, ok: boolean, label: string, detail?: string): SeoCheck => ({
    id, level: "critical", ok, label, ...(ok ? {} : { detail }),
  });
  const warning = (id: string, ok: boolean, label: string, detail?: string): SeoCheck => ({
    id, level: "warning", ok, label, ...(ok ? {} : { detail }),
  });

  return [
    critical("keyword", Boolean(keyword), "Primary keyword set", "Add the one phrase this page should rank for."),
    critical(
      "keyword-title",
      Boolean(keyword) && titleGap.length === 0,
      "Keyword in the title and H1",
      keyword ? `Missing: ${list(titleGap)}` : "Set a primary keyword first.",
    ),
    critical(
      "keyword-slug",
      Boolean(keyword) && slugGap.length === 0,
      "Keyword in the slug",
      keyword ? `Missing: ${list(slugGap)}` : "Set a primary keyword first.",
    ),
    critical("photos", draft.images.length > 0, "At least one photo (the first is the cover)", "Upload a photo."),
    critical(
      "alt",
      draft.images.length > 0 && noAlt === 0,
      "Alt text on every photo",
      draft.images.length ? `${noAlt} of ${draft.images.length} without alt text.` : "No photos yet.",
    ),
    critical("credit", credits.length === 0, "Every photo credited", credits[0]),
    critical("lead", draft.leadChosen, "Lead piece chosen", "Pick the piece the look is about."),
    critical(
      "categories",
      draft.items.length > 0 && uncategorised === 0,
      "Every piece has a category",
      `${uncategorised} of ${draft.items.length} without one.`,
    ),
    critical(
      "about",
      aboutWords >= MIN_ABOUT_WORDS,
      `About this look has ${MIN_ABOUT_WORDS}+ words`,
      `${aboutWords} of ${MIN_ABOUT_WORDS}.`,
    ),
    critical(
      "unique",
      !liveClash,
      "No other published look targets this keyword",
      liveClash ? `Already targeted by “${liveClash.title}” (/outfits/${liveClash.slug}).` : undefined,
    ),
    critical(
      "decoded",
      draft.items.some(hasSwap) || draft.items.some(hasWornPrice),
      "At least one swap or confirmed original price",
      "Without one the look stays off the site even when published.",
    ),

    warning(
      "keyword-intro",
      Boolean(keyword) && introGap.length === 0,
      "Keyword in the first paragraph",
      keyword ? `Missing: ${list(introGap)}` : undefined,
    ),
    warning(
      "keyword-description",
      Boolean(keyword) && descriptionGap.length === 0,
      "Keyword in the search description",
      keyword ? `Missing: ${list(descriptionGap)}` : undefined,
    ),
    warning("title-length", title.length <= TITLE_MAX, `Title ${TITLE_MAX} characters or fewer`, `${title.length} characters.`),
    warning(
      "description-length",
      description.length <= DESCRIPTION_MAX,
      `Description ${DESCRIPTION_MAX} characters or fewer`,
      `${description.length} characters; Google will cut it.`,
    ),
    warning(
      "rupees",
      dollarsIn.length === 0,
      "Prices in ₹, not $",
      `A $ amount with no ₹ amount in ${list(dollarsIn)}.`,
    ),
    warning("swap", draft.items.some(hasSwap), "At least one swap", "No piece has a priced swap yet."),
    warning(
      "accessories",
      undecoded.length === 0,
      "Pieces mentioned in the text are decoded",
      `The text mentions ${list(undecoded)} but no piece has that category.`,
    ),
    warning("occasions", occasions.length >= 2, "At least 2 occasions", `${occasions.length} selected.`),
  ];
}

/** The critical checks that fail — what stands between a look and going live. */
export const blockingChecks = (checks: SeoCheck[]) =>
  checks.filter((check) => check.level === "critical" && !check.ok);
