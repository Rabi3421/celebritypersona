import { z } from "zod";

/** Shapes the admin forms are allowed to submit. Numbers arrive as strings. */

const rupees = z.coerce.number().int().min(0, "Must be zero or more");
const required = (label: string) => z.string().trim().min(1, `${label} is required`);

export const outfitItemSchema = z.object({
  name: required("Piece name"),
  wornBrand: required("Worn brand"),
  swapBrand: required("Swap brand"),
  worn: rupees,
  swap: rupees,
});

export const outfitSchema = z.object({
  celebrity: required("Celebrity"),
  event: required("Event"),
  occasion: required("Occasion"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  isNew: z.boolean().default(false),
  items: z.array(outfitItemSchema).min(1, "Add at least one piece"),
});

export const celebritySchema = z.object({
  name: required("Name"),
  looks: z.coerce.number().int().min(0),
  averageSaving: z.coerce.number().int().min(0).max(100),
  low: rupees,
  high: rupees,
  brands: z.array(z.string().trim().min(1)).min(1, "Add at least one brand"),
  trending: z.boolean().default(false),
  newArchive: z.boolean().default(false),
  bio: z.array(z.string().trim().min(1)).default([]),
});

export const occasionSchema = z.object({
  name: required("Name"),
  group: z.enum(["Wedding", "Festival", "Everyday"]),
  looks: z.coerce.number().int().min(0),
  swapFrom: rupees,
  averageWorn: rupees,
  averageSwap: rupees,
  peak: required("Peak"),
  description: required("Description"),
  colours: z
    .array(z.object({ name: required("Colour name"), value: required("Hex") }))
    .min(1, "Add at least one colour"),
  garments: z
    .array(z.object({ name: required("Garment"), count: z.coerce.number().int().min(0) }))
    .min(1, "Add at least one garment"),
});

export const trendingSearchSchema = z.object({
  term: required("Term"),
  volume: z.coerce.number().int().min(0),
  changePct: z.coerce.number().int(),
  intent: z.enum(["Celebrity", "Occasion", "Budget", "Brand", "How to"]),
  href: required("Destination"),
  answer: required("Answer"),
});

export const priceReportStatusSchema = z.object({
  id: required("Report"),
  status: z.enum(["New", "Checked", "Fixed", "No change needed"]),
});

const peekEntry = z.object({ label: required("Label"), price: rupees });

export const homeContentSchema = z.object({
  heroLook: z.object({
    date: required("Hero date"),
    occasion: required("Hero occasion"),
    celebrity: required("Hero celebrity"),
    headline: required("Hero headline"),
    summary: required("Hero summary"),
    photoCredit: required("Photo credit"),
    items: z
      .array(outfitItemSchema.extend({ short: required("Short label") }))
      .min(1, "Add at least one hero piece"),
  }),
  tickerEntries: z
    .array(
      z.object({
        celebrity: required("Celebrity"),
        occasion: required("Occasion"),
        worn: rupees,
        swap: rupees,
      }),
    )
    .min(1, "Add at least one ticker entry"),
  stats: z
    .array(
      z.object({
        value: z.coerce.number().int().min(0),
        suffix: z.string().default(""),
        label: required("Stat label"),
      }),
    )
    .min(1, "Add at least one stat"),
  thisWeek: z
    .array(
      z.object({
        celebrity: required("Celebrity"),
        occasion: required("Occasion"),
        posted: required("Posted"),
        tone: z.enum(["", "v2", "v3", "v4", "v5"]),
        worn: rupees,
        swap: rupees,
        peek: z.array(peekEntry).default([]),
      }),
    )
    .min(1, "Add at least one card"),
  swapSteps: z
    .array(z.object({ n: required("Number"), title: required("Title"), body: required("Body") }))
    .min(1, "Add at least one step"),
  budgetTiers: z
    .array(z.object({ cap: rupees, looks: z.coerce.number().int().min(0) }))
    .min(1, "Add at least one tier"),
  dupeOfTheWeek: z.object({
    worn: z.object({ name: required("Worn name"), price: rupees }),
    swap: z.object({ name: required("Swap name"), price: rupees }),
  }),
  occasions: z
    .array(z.object({ name: required("Name"), looks: z.coerce.number().int().min(0) }))
    .min(1, "Add at least one occasion"),
  celebrities: z
    .array(z.object({ name: required("Name"), looks: z.coerce.number().int().min(0) }))
    .min(1, "Add at least one celebrity"),
  brands: z.array(z.string().trim().min(1)).min(1, "Add at least one brand"),
  trustPoints: z
    .array(z.object({ n: required("Number"), title: required("Title"), body: required("Body") }))
    .min(1, "Add at least one point"),
  reels: z
    .array(z.object({ views: required("Views"), caption: required("Caption") }))
    .min(1, "Add at least one reel"),
});

export type FieldErrors = Record<string, string>;

/** Flattens a Zod failure into one message per field, for the form to show. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}
