/**
 * The content review for one outfit: the existing checklist, unchanged, plus
 * editorial findings that never block publishing.
 *
 * Blockers are exactly `seoChecks`' critical checks — the same function the
 * save action enforces — so this panel cannot disagree with what a save does.
 * Everything else is advice, with a severity, the reason, and a concrete fix;
 * where a fix can be written from the look's own data it comes as copy-ready
 * text the editor may paste. Nothing here changes a field on its own.
 *
 * Pure: no I/O, no clock (the caller passes `today`).
 */

import { finalDescription, generateDescription, generateTitle, headline, suggestKeywordSlug, words } from "@/lib/outfit-seo";
import { seoChecks, type KeywordOwner, type SeoDraft } from "@/lib/seo-checks";
import { hubIndexable, MIN_HUB_LOOKS, MIN_INTRO_WORDS, wordCount } from "@/lib/indexing";
import { outfitOccasions } from "@/lib/types";
import { classifyIntent, GARMENT_WORDS, relevance, type OtherLook } from "@/lib/seo-review/keyword";

export type Severity = "high" | "medium" | "low";
export type FindingKind = "blocker" | "editorial";
export type Area =
  | "keyword"
  | "title"
  | "description"
  | "url"
  | "content"
  | "products"
  | "pricing"
  | "faqs"
  | "images"
  | "links"
  | "structured-data";

export const AREA_LABEL: Record<Area, string> = {
  keyword: "Keyword",
  title: "Title and H1",
  description: "Meta description",
  url: "Slug and canonical",
  content: "Content",
  products: "Products",
  pricing: "Pricing and disclosure",
  faqs: "FAQs",
  images: "Image alt text",
  links: "Internal links",
  "structured-data": "Structured data",
};

/** Copy-ready text. `field` names the form field it belongs in, when there is one. */
export type Suggestion = { label: string; text: string; field?: "seoTitle" | "seoDescription" | "slug" | "primaryKeyword" };

export type Finding = {
  id: string;
  area: Area;
  kind: FindingKind;
  severity: Severity;
  ok: boolean;
  title: string;
  /** Why it matters. */
  explanation: string;
  /** What to do, specifically. Shown only when the check fails. */
  fix?: string;
  suggestions?: Suggestion[];
};

export type PieceLinkInput = {
  piece: string;
  side: "original" | "swap";
  url?: string;
  status?: string;
  affiliateUrl?: string;
  network?: string;
};

/** The form as it stands (the live snapshot) plus the parts only this review reads. */
export type ReviewInput = SeoDraft & {
  status: string;
  secondaryKeywords: string[];
  date?: string;
  faqs: { question: string; answer: string }[];
  links: PieceLinkInput[];
};

export type HubInfo = { name: string; slug: string; looks: number; introWords: number; record: boolean };

export type ReviewContext = {
  id?: number;
  owners: KeywordOwner[];
  others: OtherLook[];
  celebrities: HubInfo[];
  occasions: HubInfo[];
  /** The stored look, when there is one: what the form started from. */
  saved?: { slug: string; slugLockedAt?: string; live: boolean; publishedAt?: string };
  today: string;
};

/** Why each existing check matters and how to fix it: the checklist says what, this says why. */
const EXISTING: Record<string, { area: Area; why: string; fix: string }> = {
  keyword: { area: "keyword", why: "Every other check is measured against it, and the overlap check needs it.", fix: "Pick one phrase from your research (Keyword research tab) and enter it as the primary keyword." },
  "keyword-title": { area: "title", why: "The title is the strongest on-page signal of what the page is about, and it is also the H1.", fix: "Work every word of the keyword into the title, naturally." },
  "keyword-slug": { area: "url", why: "The URL is shown in results and is permanent once published.", fix: "Use the suggested slug, or add the missing words." },
  photos: { area: "images", why: "An outfit page without a photo cannot show the look it describes.", fix: "Upload at least one photo; the first is the cover." },
  alt: { area: "images", why: "Alt text is how search engines and screen readers understand a photo.", fix: "Describe each photo: who, what she is wearing, where." },
  credit: { area: "images", why: "Photos must be credited to where they came from.", fix: "Fill the photo credit, or a per-photo credit." },
  lead: { area: "content", why: "The title, description and look sheet are built around the lead piece.", fix: "Pick the piece the look is about." },
  categories: { area: "products", why: "Categories file the look under the right hubs and power related looks.", fix: "Give every piece a category." },
  about: { area: "content", why: "Original writing is what a search engine cannot get from a product page.", fix: "Write about the styling, fabric and where it works — in your own words." },
  unique: { area: "keyword", why: "Two live pages on one search compete with each other.", fix: "Choose a more specific keyword (add the colour, brand or event)." },
  decoded: { area: "products", why: "A look with no swap and no confirmed price stays off the site even when published.", fix: "Add a swap with a price, or confirm the original price." },
  "keyword-intro": { area: "content", why: "The first paragraph confirms to readers and search engines that they are in the right place.", fix: "Mention the keyword's words early in the first paragraph." },
  "keyword-description": { area: "description", why: "Google bolds the searched words in the snippet, which draws the eye.", fix: "Open the description with the keyword." },
  "title-length": { area: "title", why: "Longer titles are cut off in results.", fix: "Shorten to 60 characters; drop filler words before the brand." },
  "description-length": { area: "description", why: "Google cuts descriptions at roughly 160 characters.", fix: "Trim to 160 characters, keeping the price at the end." },
  rupees: { area: "pricing", why: "Readers are in India; a dollar price beside a rupee page is a mismatch.", fix: "Quote the price in ₹." },
  swap: { area: "products", why: "A priced lookalike is the most useful thing the page offers.", fix: "Find a swap for at least one piece." },
  accessories: { area: "products", why: "Pieces mentioned but not decoded leave the reader without a link.", fix: "Add the mentioned pieces, or reword the text." },
  occasions: { area: "links", why: "Each occasion links the look from another hub page.", fix: "Add a second occasion the look genuinely suits." },
};

/** Phrases that read as filler or machine-written. Specific detail beats all of them. */
const GENERIC_PHRASES: [RegExp, string][] = [
  [/\bin the world of fashion\b/i, "in the world of fashion"],
  [/\bfashion[- ]forward\b/i, "fashion-forward"],
  [/\beffortless(ly)? (chic|elegan\w*|glam\w*|style)\b/i, "effortlessly chic / effortless elegance"],
  [/\belevat(e|es|ed|ing)\b/i, "elevate"],
  [/\ba testament to\b/i, "a testament to"],
  [/\bexud(e|es|ed|ing)\b/i, "exudes"],
  [/\bstunning (ensemble|look|outfit)\b/i, "stunning ensemble"],
  [/\bturn(ed|s|ing)? heads\b|\bhead[- ]turning\b/i, "turned heads"],
  [/\bnever fails to\b/i, "never fails to"],
  [/\bslay(ed|s|ing)?\b/i, "slayed"],
  [/\bwhether you'?re\b/i, "whether you're"],
  [/\bin conclusion\b/i, "in conclusion"],
  [/\bdelv(e|es|ing)\b/i, "delve"],
  [/\ba perfect blend\b|\bthe perfect blend\b/i, "a perfect blend"],
  [/\btimeless elegance\b/i, "timeless elegance"],
  [/\bbreathtaking\b/i, "breathtaking"],
  [/\bjaw[- ]dropping\b/i, "jaw-dropping"],
  [/\ball eyes (were|are) on\b/i, "all eyes were on"],
  [/\bstyle icon\b|\bfashion icon\b/i, "style icon"],
  [/\bredefin(e|es|ed|ing)\b/i, "redefines"],
];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESULT_TITLE_MIN = 30;
const DESCRIPTION_MIN = 70;
const ARTICLE_HEADLINE_MAX = 110;
const ALT_MAX = 125;
const FAQ_ANSWER_MIN_WORDS = 15;
const MAX_FAQS = 6;

const shingles = (text: string, size = 5) => {
  const w = words(text);
  const set = new Set<string>();
  for (let i = 0; i + size <= w.length; i++) set.add(w.slice(i, i + size).join(" "));
  return set;
};

/** How many times the exact keyword phrase appears in a text, by words. */
export function phraseCount(text: string, keyword: string | undefined) {
  const phrase = words(keyword);
  if (!phrase.length) return 0;
  const w = words(text);
  let count = 0;
  for (let i = 0; i + phrase.length <= w.length; i++) if (phrase.every((p, j) => w[i + j] === p)) count++;
  return count;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function auditFindings(input: ReviewInput, context: ReviewContext): Finding[] {
  const keyword = input.primaryKeyword?.trim() ?? "";
  const title = headline(input);
  const description = finalDescription(input);
  const notesText = (input.notes ?? []).join("\n");
  const findings: Finding[] = [];
  const add = (f: Omit<Finding, "kind"> & { kind?: FindingKind }) => findings.push({ kind: "editorial", ...f });

  // ---- The existing checklist, unchanged. Critical = blocker.
  for (const check of seoChecks(input, { id: context.id, owners: context.owners })) {
    const info = EXISTING[check.id] ?? { area: "content" as Area, why: "", fix: "" };
    findings.push({
      id: `checklist:${check.id}`,
      area: info.area,
      kind: check.level === "critical" ? "blocker" : "editorial",
      severity: check.level === "critical" ? "high" : "medium",
      ok: check.ok,
      title: check.label,
      explanation: [check.detail, info.why].filter(Boolean).map((part) => (/[.!?”)]$/.test(part!.trim()) ? part : `${part}.`)).join(" "),
      fix: info.fix,
    });
  }

  // ---- Keyword fit
  if (keyword) {
    const intent = classifyIntent(keyword, input.celebrity);
    add({
      id: "keyword-intent",
      area: "keyword",
      severity: "medium",
      ok: intent.fitsPage,
      title: `Search intent fits an outfit page (${intent.label})`,
      explanation: intent.explanation,
      fix: "Choose a keyword that names the garment, colour or brand of this look.",
    });
    const fit = relevance(keyword, { celebrity: input.celebrity, event: input.event, occasions: outfitOccasions(input), items: input.items });
    add({
      id: "keyword-matches-look",
      area: "keyword",
      severity: "high",
      ok: fit.mismatches.length === 0,
      title: "Keyword describes this exact look",
      explanation: fit.mismatches.length ? `${fit.mismatches.join(" ")} The page would not answer the search it targets.` : "Every garment and colour in the keyword is on this look.",
      fix: "Change the keyword to the look's real garment and colour, or correct the piece's category and colours.",
    });
    add({
      id: "keyword-celebrity",
      area: "keyword",
      severity: "medium",
      ok: fit.celebrity.status === "match",
      title: "Keyword names the celebrity in full",
      explanation: fit.celebrity.detail,
      fix: `Include “${input.celebrity}” in the keyword.`,
    });
  }

  // ---- Title and H1
  const name = words(input.celebrity);
  const titleWords = words(title);
  const repeated = [...new Set(titleWords)].filter((w) => w.length > 2 && titleWords.filter((x) => x === w).length >= 3);
  const generated = generateTitle(input);
  const titleSuggestion = generated && generated !== title ? [{ label: "Suggested title (built from the lead piece)", text: generated, field: "seoTitle" as const }] : undefined;
  add({
    id: "title-celebrity",
    area: "title",
    severity: "medium",
    ok: name.length > 0 && name.every((part) => titleWords.includes(part)),
    title: "Title names the celebrity in full",
    explanation: "Searchers type the name; a title without it reads as any outfit.",
    fix: `Start the title with “${input.celebrity}”.`,
    suggestions: titleSuggestion,
  });
  add({
    id: "title-specific",
    area: "title",
    severity: "medium",
    ok: titleWords.some((w) => GARMENT_WORDS.has(w) && !["outfit", "outfits", "look", "looks", "fashion", "style"].includes(w)) || input.items.some((i) => i.wornBrand && words(i.wornBrand).every((b) => titleWords.includes(b))),
    title: "Title names the garment or brand, not just “outfit” or “look”",
    explanation: "“Her airport look” describes thousands of pages; “her black Club L London dress” describes this one.",
    fix: "Name the lead piece: colour, garment, and the brand if identified.",
    suggestions: titleSuggestion,
  });
  add({
    id: "title-length-min",
    area: "title",
    severity: "low",
    ok: title.length >= RESULT_TITLE_MIN,
    title: `Title is at least ${RESULT_TITLE_MIN} characters`,
    explanation: `${title.length} characters. A very short title wastes the most prominent line in the result.`,
    fix: "Add the garment, colour or brand.",
    suggestions: titleSuggestion,
  });
  add({
    id: "title-stuffing",
    area: "title",
    severity: "medium",
    ok: repeated.length === 0,
    title: "No word repeated three times in the title",
    explanation: repeated.length ? `Repeats “${repeated.join("”, “")}”. Repetition reads as keyword stuffing and helps nothing.` : "No stuffing.",
    fix: "Say each thing once.",
  });
  const shouting = (title.match(/\b[A-Z]{3,}\b/g) ?? []).filter((w) => !/^(USA|UK|NYC|LA|II|III|IV|MET|IIFA|GQ|AD|TV)$/.test(w));
  add({
    id: "title-caps",
    area: "title",
    severity: "low",
    ok: shouting.length < 2,
    title: "Title is not in capitals",
    explanation: "All-caps words read as clickbait.",
    fix: "Use normal capitalisation.",
  });
  const sameTitle = context.others.find((o) => o.id !== context.id && o.title.trim().toLowerCase() === title.trim().toLowerCase());
  add({
    id: "title-unique",
    area: "title",
    severity: "high",
    ok: !sameTitle,
    title: "No other look has the same title",
    explanation: sameTitle ? `“${sameTitle.title}” is already used by /outfits/${sameTitle.slug}. Duplicate titles make Google pick one page and drop the other.` : "Unique.",
    fix: "Add what makes this look different: the event, colour or brand.",
    suggestions: titleSuggestion,
  });
  add({
    id: "h1-matches",
    area: "title",
    severity: "low",
    ok: true,
    title: "H1 matches the title",
    explanation: "The page prints the same text as its H1, so the two can never disagree.",
  });

  // ---- Meta description
  const ownDescription = input.seoDescription?.trim();
  const generatedDescription = generateDescription(input);
  const descriptionSuggestion = generatedDescription && generatedDescription !== description ? [{ label: "Suggested description", text: generatedDescription, field: "seoDescription" as const }] : undefined;
  add({
    id: "description-own",
    area: "description",
    severity: "low",
    ok: Boolean(ownDescription),
    title: "A description written for search",
    explanation: ownDescription
      ? "Written."
      : keyword
        ? "Empty: the page uses a line generated from the keyword and lead piece (the Google preview shows it). Acceptable, but your own can say why this look is worth the click."
        : "Empty: the page falls back to the first paragraph or a line built from the pieces, neither written for the result page.",
    fix: "Write one: the keyword first, what was worn, and the swap price in ₹. Start from the suggestion and edit it.",
    suggestions: ownDescription ? descriptionSuggestion : [{ label: "Starting point (edit before using)", text: generatedDescription, field: "seoDescription" }],
  });
  add({
    id: "description-length-min",
    area: "description",
    severity: "low",
    ok: description.length >= DESCRIPTION_MIN,
    title: `Description is at least ${DESCRIPTION_MIN} characters`,
    explanation: `${description.length} characters. A short description leaves Google to pick its own text from the page.`,
    fix: "Add what was worn and the price.",
    suggestions: descriptionSuggestion,
  });
  add({
    id: "description-not-title",
    area: "description",
    severity: "medium",
    ok: description.trim().toLowerCase() !== title.trim().toLowerCase(),
    title: "Description says more than the title",
    explanation: "Repeating the title wastes the second line of the result.",
    fix: "Describe the pieces and the price instead.",
    suggestions: descriptionSuggestion,
  });
  add({
    id: "description-value",
    area: "description",
    severity: "low",
    ok: /₹|\bswap|\bprice|\bbuy\b|\bwhere to\b/i.test(description) || input.items.some((i) => i.wornBrand && description.toLowerCase().includes(i.wornBrand.toLowerCase())),
    title: "Description gives a reason to click (brand, price or swap)",
    explanation: "A brand, a ₹ price or a lookalike is what makes this result more useful than the next one.",
    fix: "End with the swap price, or name the brand.",
    suggestions: descriptionSuggestion,
  });

  // ---- Slug and canonical
  const slug = input.slug.trim();
  const slugWords = slug.split("-").filter(Boolean);
  const slugSuggestion = suggestKeywordSlug(input, context.others.map((o) => o.slug));
  const locked = Boolean(context.saved?.live || context.saved?.slugLockedAt);
  add({
    id: "slug-format",
    area: "url",
    severity: "medium",
    ok: SLUG.test(slug),
    title: "Slug is lowercase words and hyphens",
    explanation: slug ? `“${slug}”. Capitals, spaces or symbols create inconsistent URLs.` : "No slug yet.",
    fix: "Lowercase letters, numbers and single hyphens only.",
    suggestions: slugSuggestion && !locked && slugSuggestion !== slug ? [{ label: "Suggested slug", text: slugSuggestion, field: "slug" }] : undefined,
  });
  add({
    id: "slug-length",
    area: "url",
    severity: "low",
    ok: slug.length <= 75 && slugWords.length <= 9,
    title: "Slug is short (≤ 9 words)",
    explanation: `${slugWords.length} words, ${slug.length} characters. Long URLs are cut in results and harder to share.`,
    fix: "Keep the keyword words and the brand; drop the rest.",
    suggestions: slugSuggestion && !locked && slugSuggestion !== slug ? [{ label: "Suggested slug", text: slugSuggestion, field: "slug" }] : undefined,
  });
  add({
    id: "slug-no-date",
    area: "url",
    severity: "low",
    ok: !/\b(19|20)\d{2}\b/.test(slug.replace(/-/g, " ")),
    title: "Slug has no year or date",
    explanation: "A date in the URL makes the page look old next year and cannot be changed without a redirect.",
    fix: "Remove the year.",
  });
  if (context.saved?.live && context.saved.slug && slug && slug !== context.saved.slug) {
    add({
      id: "slug-moved",
      area: "url",
      severity: "medium",
      ok: false,
      title: "Changing a live URL",
      explanation: `The look is live at /outfits/${context.saved.slug}. Saving will move it to /outfits/${slug} with a 301 redirect; old links keep working, but Google has to re-learn the address.`,
      fix: "Only change a live slug if the old one is wrong.",
    });
  }
  add({
    id: "canonical",
    area: "url",
    severity: "low",
    ok: SLUG.test(slug),
    title: "Canonical URL is the page's own address",
    explanation: slug ? `The page declares /outfits/${slug} as canonical, built from the slug — they cannot disagree.` : "Set when the slug is set.",
  });

  // ---- Content: originality and helpfulness
  const aboutWords = wordCount(input.notes ?? []);
  const cliches = GENERIC_PHRASES.filter(([pattern]) => pattern.test(notesText)).map(([, label]) => label);
  add({
    id: "content-generic",
    area: "content",
    severity: cliches.length >= 3 ? "medium" : "low",
    ok: cliches.length < 2,
    title: "Writing is specific, not generic",
    explanation: cliches.length ? `Generic phrases: “${cliches.join("”, “")}”. They read as filler or machine-written and say nothing a reader can use.` : "No stock phrases found.",
    fix: "Replace each with a fact: the fabric, the cut, the price, how it is styled, where it would work.",
  });
  const brands = [...new Set(input.items.map((i) => i.wornBrand?.trim()).filter((b): b is string => Boolean(b)))];
  add({
    id: "content-names-pieces",
    area: "content",
    severity: "medium",
    ok: !brands.length || brands.some((b) => notesText.toLowerCase().includes(b.toLowerCase())),
    title: "The write-up names the identified label",
    explanation: brands.length ? `The pieces are by ${brands.slice(0, 3).join(", ")}, but the text never says so. Naming the label is the answer the reader came for.` : "No label identified yet.",
    fix: `Name the label in the first paragraph${brands[0] ? `, e.g. “… is by ${brands[0]}”` : ""}.`,
  });
  const sentences = notesText.split(/(?<=[.!?])\s+|\n+/).map((s) => words(s).join(" ")).filter((s) => s.split(" ").length >= 6);
  const dupes = [...new Set(sentences.filter((s, i) => sentences.indexOf(s) !== i))];
  add({
    id: "content-repetition",
    area: "content",
    severity: "medium",
    ok: dupes.length === 0,
    title: "No sentence repeated",
    explanation: dupes.length ? `${plural(dupes.length, "sentence")} appears twice.` : "No repeats.",
    fix: "Delete the repeat.",
  });
  const mine = shingles(notesText);
  let closest: { other: OtherLook; share: number } | null = null;
  if (mine.size >= 20) {
    for (const other of context.others) {
      if (other.id === context.id || !other.notes) continue;
      const theirs = shingles(other.notes);
      const shared = [...mine].filter((s) => theirs.has(s)).length / mine.size;
      if (!closest || shared > closest.share) closest = { other, share: shared };
    }
  }
  const overlapShare = closest?.share ?? 0;
  add({
    id: "content-original",
    area: "content",
    severity: overlapShare >= 0.25 ? "high" : "medium",
    ok: overlapShare < 0.1,
    title: "Writing is not reused from another look",
    explanation: closest && overlapShare >= 0.1 ? `About ${Math.round(overlapShare * 100)}% of its five-word phrases also appear in “${closest.other.title}” (/outfits/${closest.other.slug}). Reused text makes both pages look thin.` : mine.size < 20 ? "Too little text yet to compare." : "No reused passages found among the other looks.",
    fix: "Rewrite the shared passages for this look specifically.",
  });
  const stuffedLimit = Math.max(2, Math.ceil(aboutWords / 120));
  const exact = phraseCount(notesText, keyword);
  add({
    id: "content-stuffing",
    area: "content",
    severity: "medium",
    ok: exact <= stuffedLimit,
    title: "Keyword is not repeated unnaturally",
    explanation: keyword ? `The exact phrase “${keyword}” appears ${plural(exact, "time")} in ${aboutWords} words (natural limit here: ${stuffedLimit}). Exact-match repetition reads badly and does not help ranking.` : "No keyword set.",
    fix: "Use it once early on; elsewhere say “the dress”, “her lehenga”, or name the brand.",
  });

  // ---- Products: identity and verification
  const lead = input.items.find((i) => i.id === input.leadPieceId);
  add({
    id: "products-lead-identified",
    area: "products",
    severity: "medium",
    ok: !lead || Boolean(lead.wornBrand?.trim()),
    title: "The lead piece's label is identified",
    explanation: lead ? (lead.wornBrand ? `${lead.name} by ${lead.wornBrand}.` : `“${lead.name}” has no worn brand. “Which brand is it?” is usually the first question.`) : "No lead piece chosen.",
    fix: "Add the worn brand if you have confirmed it — never guess.",
  });
  const unidentified = input.items.filter((i) => !i.wornBrand?.trim()).length;
  add({
    id: "products-identified",
    area: "products",
    severity: "low",
    ok: unidentified === 0,
    title: "Every piece's label is identified",
    explanation: unidentified ? `${plural(unidentified, "piece")} of ${input.items.length} without a worn brand. Shown as “Unidentified” on the page — honest, but less useful.` : "All identified.",
    fix: "Identify what you can verify; leave the rest unidentified rather than guessing.",
  });
  const dead = input.links.filter((l) => l.url && l.status === "dead");
  const unverified = input.links.filter((l) => l.url && l.status === "unverified");
  add({
    id: "products-dead-links",
    area: "products",
    severity: "high",
    ok: dead.length === 0,
    title: "No shop link marked dead",
    explanation: dead.length ? `Dead: ${dead.map((l) => `${l.piece} (${l.side === "swap" ? "swap" : "original"})`).join(", ")}. A dead link breaks the page's main promise.` : "None dead.",
    fix: "Replace the link, or mark the piece sold out.",
  });
  add({
    id: "products-verified",
    area: "products",
    severity: "medium",
    ok: unverified.length === 0,
    title: "Shop links checked by a person",
    explanation: unverified.length ? `${plural(unverified.length, "link")} still “unverified”: ${unverified.slice(0, 4).map((l) => l.piece).join(", ")}${unverified.length > 4 ? "…" : ""}. The product, colour and price should be confirmed before publishing.` : "Every link has been checked.",
    fix: "Open each link, confirm it is the same product in the same colour, then set the status to OK.",
  });

  // ---- Pricing and affiliate disclosure
  const monetised = input.links.filter((l) => l.affiliateUrl?.trim());
  const noNetwork = monetised.filter((l) => !l.network || l.network === "none");
  add({
    id: "pricing-disclosure",
    area: "pricing",
    severity: "medium",
    ok: noNetwork.length === 0,
    title: "Affiliate links are disclosed and labelled",
    explanation: monetised.length
      ? `${plural(monetised.length, "affiliate link")}: the page shows its disclosure automatically above the shop links.${noNetwork.length ? ` ${plural(noNetwork.length, "link")} has an affiliate URL but no network set, so click reports cannot attribute it.` : ""}`
      : "No affiliate links, so the page shows no disclosure — correctly.",
    fix: "Set the network for each affiliate link.",
  });
  const oddPrices = input.items.flatMap((i) => [i.worn, i.swap]).filter((p): p is number => typeof p === "number" && (p < 100 || p > 50_00_000));
  add({
    id: "pricing-plausible",
    area: "pricing",
    severity: "low",
    ok: oddPrices.length === 0,
    title: "Prices look plausible",
    explanation: oddPrices.length ? `Check ${oddPrices.map((p) => `₹${p.toLocaleString("en-IN")}`).join(", ")} — a missing or extra zero is the commonest price error.` : "Nothing out of range.",
    fix: "Re-check against the retailer page.",
  });

  // ---- FAQs (optional; only when genuinely useful)
  const faqs = input.faqs.filter((f) => f.question.trim() || f.answer.trim());
  const thin = faqs.filter((f) => wordCount(f.answer) < FAQ_ANSWER_MIN_WORDS);
  const notQuestions = faqs.filter((f) => !f.question.trim().endsWith("?"));
  const faqProblems = [
    thin.length ? `${plural(thin.length, "answer")} under ${FAQ_ANSWER_MIN_WORDS} words` : "",
    notQuestions.length ? `${plural(notQuestions.length, "question")} without a question mark` : "",
    faqs.length > MAX_FAQS ? `${faqs.length} questions (keep to the ones readers really ask)` : "",
  ].filter(Boolean);
  add({
    id: "faqs-useful",
    area: "faqs",
    severity: "low",
    ok: faqProblems.length === 0,
    title: "FAQs are real questions with real answers",
    explanation: faqs.length ? (faqProblems.length ? `${faqProblems.join("; ")}.` : `${plural(faqs.length, "question")}, each answered.`) : "No FAQs. That is fine — add them only for questions readers actually ask (where to buy, the price, the fabric).",
    fix: "Answer each in a full sentence or two; drop questions nobody asks.",
  });

  // ---- Image alt text
  const alts = input.images.map((i) => i.alt?.trim() ?? "").filter(Boolean);
  const lowerAlts = alts.map((a) => a.toLowerCase());
  const identical = lowerAlts.length - new Set(lowerAlts).size;
  const noName = alts.filter((a) => !name.some((part) => words(a).includes(part))).length;
  const filler = alts.filter((a) => /^(image|photo|picture|pic) of\b/i.test(a)).length;
  const long = alts.filter((a) => a.length > ALT_MAX).length;
  const keywordAlts = keyword ? alts.filter((a) => a.toLowerCase() === keyword.toLowerCase()).length : 0;
  const altSuggestion = (index: number) => {
    const leadItem = lead ?? input.items[0];
    const piece = leadItem ? [leadItem.colours?.[0], leadItem.name].filter(Boolean).join(" ") : "an outfit";
    const by = leadItem?.wornBrand ? ` by ${leadItem.wornBrand}` : "";
    const view = index === 0 ? "" : ` — photo ${index + 1}`;
    return `${input.celebrity} in ${piece}${by} at ${input.event}${view}`.replace(/\s+/g, " ").trim();
  };
  add({
    id: "images-alt-distinct",
    area: "images",
    severity: "medium",
    ok: identical === 0 && keywordAlts <= 1,
    title: "Each photo has its own alt text",
    explanation: identical || keywordAlts > 1 ? `${identical ? `${plural(identical, "photo")} repeats another's alt text.` : ""}${keywordAlts > 1 ? ` ${keywordAlts} alts are just the keyword — that is stuffing.` : ""}` : "All distinct.",
    fix: "Say what each photo shows: full look, detail of the embroidery, the bag.",
    suggestions: input.images.length && (identical || keywordAlts > 1) ? input.images.map((_, i) => ({ label: `Alt for photo ${i + 1}`, text: altSuggestion(i) })) : undefined,
  });
  add({
    id: "images-alt-quality",
    area: "images",
    severity: "low",
    ok: noName === 0 && filler === 0 && long === 0,
    title: "Alt text names her and skips filler",
    explanation: [noName ? `${plural(noName, "alt")} without her name` : "", filler ? `${plural(filler, "alt")} starting “image of”` : "", long ? `${plural(long, "alt")} over ${ALT_MAX} characters` : ""].filter(Boolean).join("; ") || "Fine.",
    fix: "“<Name> in <colour> <garment> by <brand> at <event>” — no “image of”.",
    suggestions: noName || filler || long ? input.images.map((_, i) => ({ label: `Alt for photo ${i + 1}`, text: altSuggestion(i) })) : undefined,
  });

  // ---- Internal links: the hubs this page links to
  // Judged as if this look were published: that is the moment the review is for.
  const goingLive = !context.saved?.live;
  const hub = (list: HubInfo[], value: string) => list.find((h) => h.name.trim().toLowerCase() === value.trim().toLowerCase());
  const celebHub = hub(context.celebrities, input.celebrity);
  if (input.celebrity.trim()) {
    const looks = (celebHub?.looks ?? 0) + (goingLive ? 1 : 0);
    const intro = celebHub?.introWords ?? 0;
    const indexable = hubIndexable({ looks, introWords: intro });
    add({
      id: "links-celebrity-hub",
      area: "links",
      severity: "low",
      ok: indexable,
      title: `${input.celebrity}'s page is indexable`,
      explanation: indexable
        ? `The breadcrumb and “${input.celebrity} archive” link point to a page Google can index (${plural(looks, "look")}).`
        : `With ${plural(looks, "look")} and a ${intro}-word bio, her page is “noindex”: the links from this look lead to a page Google will not index.`,
      fix: `Write a ${MIN_INTRO_WORDS}-word bio for ${input.celebrity}, or publish ${MIN_HUB_LOOKS} looks of hers.`,
    });
  }
  const primaryOccasion = input.occasion?.trim();
  if (primaryOccasion) {
    const occ = hub(context.occasions, primaryOccasion);
    const looks = (occ?.looks ?? 0) + (goingLive ? 1 : 0);
    const indexable = hubIndexable({ looks, introWords: occ?.introWords ?? 0 });
    add({
      id: "links-occasion-hub",
      area: "links",
      severity: "low",
      ok: indexable,
      title: `“${primaryOccasion}” page is indexable`,
      explanation: indexable ? `The “${primaryOccasion} looks” link points to an indexable page (${plural(looks, "look")}).` : `The “${primaryOccasion}” page has ${plural(looks, "look")} and no ${MIN_INTRO_WORDS}-word intro, so it is “noindex”.`,
      fix: `Add an intro to the ${primaryOccasion} occasion, or file the look under an occasion with more looks.`,
    });
  }
  const sameCelebrity = context.others.filter((o) => o.published && o.id !== context.id && o.celebrity.trim().toLowerCase() === input.celebrity.trim().toLowerCase()).length;
  add({
    id: "links-related",
    area: "links",
    severity: "low",
    // Information, not a fault: the first look of a celebrity has nothing to link to yet.
    ok: true,
    title: `Other ${input.celebrity || "celebrity"} looks to link to`,
    explanation: sameCelebrity ? `“More from ${input.celebrity}” will link ${plural(sameCelebrity, "other look")}.` : "This will be her only look, so the page links out only to hubs. Not a problem to fix now — the next look of hers will link back.",
  });

  // ---- Structured data (Article + BreadcrumbList, built by the page)
  add({
    id: "schema-headline",
    area: "structured-data",
    severity: "low",
    ok: title.length <= ARTICLE_HEADLINE_MAX,
    title: `Article headline within ${ARTICLE_HEADLINE_MAX} characters`,
    explanation: "The page's Article markup uses the title as its headline; Google recommends keeping it concise.",
    fix: "Shorten the title.",
  });
  add({
    id: "schema-image",
    area: "structured-data",
    severity: "low",
    ok: input.images.length > 0,
    title: "Article markup has an image",
    explanation: input.images.length ? "The cover photo is the Article image." : "No photo: the Article markup has no image, which rich results need.",
    fix: "Upload a photo.",
  });
  const legacyDate = Boolean(context.saved?.live && !context.saved.publishedAt);
  add({
    id: "schema-dates",
    area: "structured-data",
    severity: "low",
    ok: !legacyDate && Boolean(input.date),
    title: "Article has a real publication date",
    explanation: legacyDate
      ? "Published before publication dates were recorded: the markup falls back to the day she wore the look. Not something to fake — just be aware the date shown is the event date."
      : input.date
        ? "Set from the day it is first published."
        : "No date yet.",
  });

  return findings;
}
