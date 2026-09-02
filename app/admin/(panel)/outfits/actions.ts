"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { getOutfits } from "@/lib/db/content";
import { createOutfit, deleteOutfit, updateOutfit } from "@/lib/db/mutations";
import { flag, lines, rows, text } from "@/lib/form-data";
import { outfitSlug } from "@/lib/slugs";
import { fieldErrors, outfitSchema, type FieldErrors } from "@/lib/validation";

/** Exactly what the form posted, echoed back so a rejected save keeps the
 *  typing. React resets an uncontrolled form after every action. */
export type OutfitDraft = {
  celebrity: string;
  event: string;
  occasion: string;
  date: string;
  isNew: boolean;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  images: { url: string; path: string; alt?: string; credit?: string }[];
  notes: string;
  items: Record<string, string>[];
};

export type OutfitFormState = { attempt?: number; errors?: FieldErrors; values?: OutfitDraft };

const IMAGE_FIELDS = ["url", "path", "alt", "credit"];

const ITEM_FIELDS = [
  "name",
  "wornBrand",
  "worn",
  "wornUrl",
  "swapBrand",
  "swap",
  "swapUrl",
  "note",
  "hotspotX",
  "hotspotY",
];

export async function saveOutfit(
  previous: OutfitFormState,
  form: FormData,
): Promise<OutfitFormState> {
  await requireAdmin();

  const draft: OutfitDraft = {
    celebrity: text(form, "celebrity"),
    event: text(form, "event"),
    occasion: text(form, "occasion"),
    date: text(form, "date"),
    isNew: flag(form, "isNew"),
    slug: text(form, "slug"),
    seoTitle: text(form, "seoTitle"),
    seoDescription: text(form, "seoDescription"),
    images: rows(form, "images", IMAGE_FIELDS) as OutfitDraft["images"],
    notes: text(form, "notes"),
    items: rows(form, "items", ITEM_FIELDS),
  };

  // The textarea is one paragraph per line; everything else posts as typed.
  const parsed = outfitSchema.safeParse({ ...draft, notes: lines(form, "notes") });
  if (!parsed.success) return {
      attempt: (previous.attempt ?? 0) + 1,
      errors: fieldErrors(parsed.error),
      values: draft,
    };

  const id = Number(form.get("id"));

  // Two looks sharing a slug would share a URL and a photo folder, and one of
  // them would become unreachable.
  const taken = (await getOutfits()).some(
    (outfit) => outfit.id !== id && outfitSlug(outfit) === parsed.data.slug,
  );
  if (taken) {
    return {
      attempt: (previous.attempt ?? 0) + 1,
      errors: { slug: "Another look already uses this slug" },
      values: draft,
    };
  }

  if (Number.isFinite(id) && id > 0) {
    await updateOutfit(id, parsed.data);
  } else {
    await createOutfit(parsed.data);
  }
  redirect("/admin/outfits");
}

export async function removeOutfit(form: FormData) {
  await requireAdmin();
  await deleteOutfit(Number(form.get("id")));
  redirect("/admin/outfits");
}
