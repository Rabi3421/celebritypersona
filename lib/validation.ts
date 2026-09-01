import { z } from "zod";
import {
  PRICE_REPORT_ISSUES,
  PRICE_REPORT_STATUSES,
  REQUEST_STATUSES,
  SUBSCRIBER_STATUSES,
} from "@/lib/types";

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
  status: z.enum(PRICE_REPORT_STATUSES),
  note: z.string().trim().max(500, "Keep the note under 500 characters").optional(),
});

/** A link a reader pasted. Anything that is not an http(s) URL is a mistake or
 *  an injection attempt, and neither belongs in the inbox. */
const optionalUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(500, `${label} is too long`)
    .optional()
    .transform((value) => value || undefined)
    .refine(
      (value) => !value || /^https?:\/\/\S+$/i.test(value),
      `${label} must start with http:// or https://`,
    );

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long`)
    .optional()
    .transform((value) => value || undefined);

/**
 * What the public report form is allowed to post. Everything is capped, so a
 * single submission cannot fill a document, and the only free-form field a
 * reader must give is the one that makes the report worth reading.
 */
export const priceReportSchema = z.object({
  outfitSlug: optionalText("Page", 200),
  issue: z.enum(PRICE_REPORT_ISSUES),
  piece: optionalText("Piece", 120),
  detail: required("A short description")
    .max(1200, "Keep the description under 1200 characters"),
  sourceUrl: optionalUrl("Link"),
  reporterEmail: z
    .string()
    .trim()
    .max(200, "Email is too long")
    .optional()
    .transform((value) => value || undefined)
    .refine(
      (value) => !value || /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(value),
      "That does not look like an email address",
    ),
  /** Hidden field a person never fills in. Bots do. */
  website: z.string().max(0, "Rejected").optional(),
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

/**
 * A name a reader typed. Capped and stripped of anything that is not part of a
 * person's name, so the requests table stays readable and cannot be used to
 * smuggle markup into the panel.
 */
export const celebrityRequestSchema = z.object({
  name: required("A name")
    .max(80, "Keep the name under 80 characters")
    .transform((value) => value.replace(/\s+/g, " "))
    .refine(
      (value) => /^[\p{L}\p{N}][\p{L}\p{N}\s.'-]*$/u.test(value),
      "Use letters, numbers, spaces, apostrophes and hyphens",
    ),
  website: z.string().max(0, "Rejected").optional(),
});

/**
 * An Indian mobile number, however it was typed: with +91, with spaces, with a
 * leading zero. Stored as the bare ten digits so one person cannot subscribe
 * five times by punctuating it differently.
 */
export const subscriberSchema = z.object({
  number: required("Your WhatsApp number")
    .transform((value) => value.replace(/\D/g, ""))
    .transform((digits) => digits.replace(/^(?:91|0)(?=\d{10}$)/, ""))
    .refine(
      (digits) => /^[6-9]\d{9}$/.test(digits),
      "Enter a 10-digit Indian mobile number",
    ),
  website: z.string().max(0, "Rejected").optional(),
});

export const requestStatusSchema = z.object({
  id: required("Request"),
  status: z.enum(REQUEST_STATUSES),
});

export const subscriberStatusSchema = z.object({
  id: required("Subscriber"),
  status: z.enum(SUBSCRIBER_STATUSES),
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
