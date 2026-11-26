import { z } from "zod";
import { PIECE_CATEGORIES, PIECE_COLOUR_NAMES } from "@/lib/taxonomy";

/**
 * What the research runner hands back for a look, and how it becomes a draft.
 *
 * The runner's AI output is untrusted input. It is checked here, then turned
 * into exactly the shape the outfit editor posts, so the draft goes through
 * the same `outfitSchema` and the same `createOutfit` as a look typed by hand.
 * Nothing here can publish: the draft's status is fixed to "draft".
 *
 * Every claim a reader would rely on carries its sources. What could not be
 * confirmed is not invented: it is left empty and listed in `checks`, which
 * the editor sees beside the draft.
 *
 * No imports beyond zod and the taxonomy, so the runner and tests load it too.
 */

const https = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "must be a full https:// link");

/** Whole rupees, or null when the price is not known in INR. */
const rupees = z.number().int().positive().max(10_000_000).nullable();

export const researchPieceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.enum(PIECE_CATEGORIES),
  colours: z.array(z.enum(PIECE_COLOUR_NAMES as [string, ...string[]])).max(4).default([]),
  /** The original, as worn. */
  wornBrand: z.string().trim().max(80).nullable(),
  worn: rupees,
  wornUrl: https.nullable(),
  /** A cheaper piece that gives the same look, on a page the runner opened. */
  swapBrand: z.string().trim().max(80).nullable(),
  swap: rupees,
  swapUrl: https.nullable(),
  /** More swaps at other budgets (under ₹1,000 / ₹2,500 / ₹5,000), each on a page the runner opened. */
  budgetSwaps: z
    .array(z.object({ brand: z.string().trim().min(1).max(80), price: z.number().int().positive().max(5000), url: https }))
    .max(3)
    .default([]),
  /** One or two sentences for the reader: fabric, fit, how to wear it. */
  note: z.string().trim().max(400).nullable(),
});

export const researchSchema = z.object({
  celebrity: z.string().trim().min(2).max(80),
  event: z.string().trim().min(2).max(120),
  occasion: z.string().trim().min(2).max(60),
  occasions: z.array(z.string().trim().min(2).max(60)).max(4).default([]),
  /** The day it was worn, YYYY-MM-DD; when only the post date is known, that. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(90),
  seoTitle: z.string().trim().min(20).max(60),
  seoDescription: z.string().trim().min(70).max(160),
  primaryKeyword: z.string().trim().min(3).max(80),
  secondaryKeywords: z.array(z.string().trim().min(3).max(80)).min(1).max(5),
  /** The editor's write-up: 2-5 paragraphs, each a few sentences. */
  notes: z.array(z.string().trim().min(40).max(1200)).min(2).max(5),
  faqs: z
    .array(z.object({ question: z.string().trim().min(10).max(200), answer: z.string().trim().min(20).max(1200) }))
    .max(6)
    .default([]),
  /** Who took or posted the photo, as it should be credited, e.g. "Instagram / @handle". */
  photoCredit: z.string().trim().min(3).max(120),
  /** Describes the real photo for screen readers and image search. */
  photoAlt: z.string().trim().min(15).max(160),
  items: z.array(researchPieceSchema).min(1).max(8),
  /** Each fact a reader would rely on, with where it was confirmed. */
  evidence: z
    .array(
      z.object({
        claim: z.string().trim().min(5).max(300),
        sources: z.array(https).max(5),
        confidence: z.enum(["confirmed", "likely", "unverified"]),
      }),
    )
    .min(1)
    .max(30),
  /** What the editor must check before publishing, in plain words. */
  checks: z.array(z.string().trim().min(5).max(300)).max(20).default([]),
});

export type LookResearch = z.output<typeof researchSchema>;
export type ResearchPiece = z.output<typeof researchPieceSchema>;

/** A slug that is not already in `taken`: the research's own, or it with -2, -3… */
export function freeSlug(slug: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(slug)) return slug;
  for (let n = 2; ; n++) {
    const next = `${slug.slice(0, 86)}-${n}`;
    if (!used.has(next)) return next;
  }
}

const str = (value: number | string | null | undefined) => (value === null || value === undefined ? "" : String(value));

/**
 * The research as the outfit editor would post it: the input `outfitSchema`
 * expects, always a draft, with the real photo as the only image.
 */
export function researchToOutfitInput(
  research: LookResearch,
  photo: { url: string; path: string } | undefined,
): Record<string, unknown> {
  return {
    celebrity: research.celebrity,
    event: research.event,
    occasion: research.occasion,
    occasions: research.occasions,
    date: research.date,
    slug: research.slug,
    seoTitle: research.seoTitle,
    seoDescription: research.seoDescription,
    photoCredit: research.photoCredit,
    images: photo ? [{ url: photo.url, path: photo.path, alt: research.photoAlt, credit: "" }] : [],
    notes: research.notes,
    status: "draft",
    primaryKeyword: research.primaryKeyword,
    secondaryKeywords: research.secondaryKeywords,
    faqs: research.faqs,
    items: research.items.map((item) => ({
      // No id: the save assigns each piece a unique one. A fixed "p1" here gave
      // every researched look the same piece id, so /go/p1 sent all of their
      // Buy buttons to whichever look had it first.
      id: "",
      name: item.name,
      category: item.category,
      colours: item.colours.join(", "),
      wornBrand: str(item.wornBrand),
      worn: str(item.worn),
      wornUrl: str(item.wornUrl),
      swapBrand: str(item.swapBrand),
      swap: str(item.swap),
      swapUrl: str(item.swapUrl),
      budgetSwaps: item.budgetSwaps.map((swap) => `${swap.brand.replace(/\|/g, "/")} | ${swap.price} | ${swap.url}`).join("\n"),
      note: str(item.note),
    })),
  };
}

/** Pulls the one JSON object out of an AI's final reply (bare, or in a ```json block). */
export function extractJson(reply: string): unknown {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = (fenced ? fenced[1] : reply).trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("The reply contained no JSON object.");
  return JSON.parse(text.slice(start, end + 1));
}

/** One line per problem, for feeding back to the AI or showing the editor. */
export const researchProblems = (error: z.ZodError) =>
  error.issues.slice(0, 15).map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
