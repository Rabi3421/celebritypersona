import { z } from "zod";

/** Shapes the admin forms are allowed to submit. Numbers arrive as strings. */

const required = (label: string) => z.string().trim().min(1, `${label} is required`);

/**
 * Numbers arrive as strings. An empty box must be an error, not a silent zero:
 * coercing "" to 0 was creating outfits priced at ₹0.
 */
const wholeNumber = (label: string) =>
  required(label)
    .transform((value) => Number(value))
    .pipe(
      z
        .number(`${label} must be a number`)
        .int(`${label} must be a whole number`)
        .min(0, `${label} cannot be negative`),
    );

const rupees = wholeNumber("Price");

/** A swap is optional, but a brand without a price is not a swap. */
export const outfitItemSchema = z
  .object({
    name: required("Piece name"),
    wornBrand: required("Worn brand"),
    worn: z.string().trim().optional(),
    wornUrl: z.string().trim().optional(),
    swapBrand: z.string().trim().optional(),
    swap: z.string().trim().optional(),
    swapUrl: z.string().trim().optional(),
    note: z.string().trim().optional(),
    hotspotX: z.string().trim().optional(),
    hotspotY: z.string().trim().optional(),
  })
  .transform((item) => ({
    ...item,
    worn: item.worn || undefined,
    wornUrl: item.wornUrl || undefined,
    swapBrand: item.swapBrand || undefined,
    swap: item.swap || undefined,
    swapUrl: item.swapUrl || undefined,
    note: item.note || undefined,
    hotspotX: item.hotspotX || undefined,
    hotspotY: item.hotspotY || undefined,
  }))
  .superRefine((item, ctx) => {
    if (item.swapBrand && !item.swap) {
      ctx.addIssue({ code: "custom", path: ["swap"], message: "Add the swap price, or clear the swap brand" });
    }
    if (item.swap && !item.swapBrand) {
      ctx.addIssue({ code: "custom", path: ["swapBrand"], message: "Add the swap brand, or clear the swap price" });
    }
    for (const [key, label] of [["worn", "Worn price"], ["swap", "Swap price"]] as const) {
      const value = item[key];
      if (value && !/^\d+$/.test(value)) {
        ctx.addIssue({ code: "custom", path: [key], message: `${label} must be a whole number` });
      }
    }
    for (const [key, label] of [["wornUrl", "Worn link"], ["swapUrl", "Swap link"]] as const) {
      const value = item[key];
      if (value && !/^https?:\/\/\S+$/i.test(value)) {
        ctx.addIssue({ code: "custom", path: [key], message: `${label} must start with http:// or https://` });
      }
    }
    if (item.swapUrl && !item.swapBrand) {
      ctx.addIssue({ code: "custom", path: ["swapUrl"], message: "Add the swap brand before its link" });
    }
  })
  .transform((item) => ({
    name: item.name,
    wornBrand: item.wornBrand,
    ...(item.note ? { note: item.note } : {}),
    ...(item.worn ? { worn: Number(item.worn) } : {}),
    ...(item.wornUrl ? { wornUrl: item.wornUrl } : {}),
    ...(item.hotspotX && item.hotspotY
      ? { hotspot: { x: Number(item.hotspotX), y: Number(item.hotspotY) } }
      : {}),
    ...(item.swapBrand && item.swap
      ? {
          swapBrand: item.swapBrand,
          swap: Number(item.swap),
          ...(item.swapUrl ? { swapUrl: item.swapUrl } : {}),
        }
      : {}),
  }));

/** The hero demo compares two totals, so its pieces must have both halves. */
export const heroItemSchema = z.object({
  name: required("Piece name"),
  short: required("Short label"),
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
  // The slug is the public URL segment and the storage folder, so it has to be
  // safe in both places: lowercase words joined by single hyphens.
  slug: required("Slug").regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and single hyphens, e.g. amyra-dastur-savanna-co-ord",
  ),
  images: z
    .array(z.object({ url: z.string().trim().min(1), path: z.string().trim().min(1) }))
    .default([]),
  notes: z.array(z.string().trim().min(1)).default([]),
  items: z.array(outfitItemSchema).min(1, "Add at least one piece"),
});

export const celebritySchema = z.object({
  name: required("Name"),
  looks: wholeNumber("Looks"),
  averageSaving: wholeNumber("Average saving").pipe(z.number().max(100, "Average saving cannot exceed 100")),
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
  looks: wholeNumber("Looks"),
  swapFrom: rupees,
  averageWorn: rupees,
  averageSwap: rupees,
  peak: required("Peak"),
  description: required("Description"),
  colours: z
    .array(z.object({ name: required("Colour name"), value: required("Hex") }))
    .min(1, "Add at least one colour"),
  garments: z
    .array(z.object({ name: required("Garment"), count: wholeNumber("Count") }))
    .min(1, "Add at least one garment"),
});

export const trendingSearchSchema = z.object({
  term: required("Term"),
  volume: wholeNumber("Volume"),
  changePct: required("Change")
    .transform((value) => Number(value))
    .pipe(z.number("Change must be a number").int("Change must be a whole number")),
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
      .array(heroItemSchema)
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
        value: wholeNumber("Stat value"),
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
    .array(z.object({ cap: rupees, looks: wholeNumber("Looks") }))
    .min(1, "Add at least one tier"),
  dupeOfTheWeek: z.object({
    worn: z.object({ name: required("Worn name"), price: rupees }),
    swap: z.object({ name: required("Swap name"), price: rupees }),
  }),
  occasions: z
    .array(z.object({ name: required("Name"), looks: wholeNumber("Looks") }))
    .min(1, "Add at least one occasion"),
  celebrities: z
    .array(z.object({ name: required("Name"), looks: wholeNumber("Looks") }))
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
