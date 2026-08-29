"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { saveHomeContent } from "@/lib/db/mutations";
import { lines, rows, text } from "@/lib/form-data";
import { fieldErrors, homeContentSchema, type FieldErrors } from "@/lib/validation";

export type HomeFormState = { errors?: FieldErrors; saved?: boolean };

/** "Kurta:1799, Tote:1499" becomes the peek list on a card. */
function parsePeek(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [label, price = "0"] = part.split(":");
      return { label: label.trim(), price: price.trim() };
    });
}

export async function saveHome(
  _previous: HomeFormState,
  form: FormData,
): Promise<HomeFormState> {
  await requireAdmin();

  const parsed = homeContentSchema.safeParse({
    heroLook: {
      date: text(form, "hero.date"),
      occasion: text(form, "hero.occasion"),
      celebrity: text(form, "hero.celebrity"),
      headline: text(form, "hero.headline"),
      summary: text(form, "hero.summary"),
      photoCredit: text(form, "hero.photoCredit"),
      items: rows(form, "heroItems", [
        "name",
        "short",
        "wornBrand",
        "swapBrand",
        "worn",
        "swap",
      ]),
    },
    tickerEntries: rows(form, "ticker", ["celebrity", "occasion", "worn", "swap"]),
    stats: rows(form, "stats", ["value", "suffix", "label"], ["suffix"]),
    thisWeek: rows(form, "thisWeek", [
      "celebrity",
      "occasion",
      "posted",
      "tone",
      "worn",
      "swap",
      "peek",
    ]).map((row) => ({ ...row, peek: parsePeek(String(row.peek ?? "")) })),
    swapSteps: rows(form, "swapSteps", ["n", "title", "body"]),
    budgetTiers: rows(form, "budgetTiers", ["cap", "looks"]),
    dupeOfTheWeek: {
      worn: { name: text(form, "dupe.wornName"), price: text(form, "dupe.wornPrice") },
      swap: { name: text(form, "dupe.swapName"), price: text(form, "dupe.swapPrice") },
    },
    occasions: rows(form, "homeOccasions", ["name", "looks"]),
    celebrities: rows(form, "homeCelebrities", ["name", "looks"]),
    brands: lines(form, "brands"),
    trustPoints: rows(form, "trustPoints", ["n", "title", "body"]),
    reels: rows(form, "reels", ["views", "caption"]),
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  await saveHomeContent(parsed.data);
  redirect("/admin/home?saved=1");
}
