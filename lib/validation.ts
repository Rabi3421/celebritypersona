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

/** Only what an editor writes. Look counts, savings, price ranges and the
 *  labels she repeats are counted from the outfits, so there is nothing here
 *  to keep in step by hand. */
export const celebritySchema = z.object({
  name: required("Name"),
  bio: z.array(z.string().trim().min(1)).default([]),
});

/** Counts, averages and the garment tally now come from the archive. What is
 *  left is editorial, plus the one real-world date the countdown needs. */
export const occasionSchema = z.object({
  name: required("Name"),
  group: z.enum(["Wedding", "Festival", "Everyday"]),
  peak: required("Peak"),
  description: required("Description"),
  nextDate: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), "Use YYYY-MM-DD"),
  colours: z
    .array(z.object({ name: required("Colour name"), value: required("Hex") }))
    .min(1, "Add at least one colour"),
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


/** Everything the homepage still asks a person for. Every figure it used to
 *  ask for — the stats bar, the ticker, the budget tiers, the occasion and
 *  archive tiles, the brand marquee, the dupe pick and the hero pieces — is
 *  now counted from the outfits instead. */
export const homeContentSchema = z.object({
  swapSteps: z
    .array(z.object({ n: required("Number"), title: required("Title"), body: required("Body") }))
    .min(1, "Add at least one step"),
  trustPoints: z
    .array(z.object({ n: required("Number"), title: required("Title"), body: required("Body") }))
    .min(1, "Add at least one point"),
  reels: z
    .array(z.object({ views: required("Views"), caption: required("Caption") }))
    .min(1, "Add at least one reel"),
  campaign: z.object({
    eyebrow: required("Campaign eyebrow"),
    title: required("Campaign title"),
    body: required("Campaign body"),
    cta: required("Campaign button"),
    href: required("Campaign link"),
  }),
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
