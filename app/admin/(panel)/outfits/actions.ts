"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createOutfit, deleteOutfit, updateOutfit } from "@/lib/db/mutations";
import { flag, rows, text } from "@/lib/form-data";
import { fieldErrors, outfitSchema, type FieldErrors } from "@/lib/validation";

/** Exactly what the form posted, echoed back so a rejected save keeps the
 *  typing. React resets an uncontrolled form after every action. */
export type OutfitDraft = {
  celebrity: string;
  event: string;
  occasion: string;
  date: string;
  isNew: boolean;
  items: Record<string, string>[];
};

export type OutfitFormState = { attempt?: number; errors?: FieldErrors; values?: OutfitDraft };

const ITEM_FIELDS = [
  "name",
  "wornBrand",
  "worn",
  "wornUrl",
  "swapBrand",
  "swap",
  "swapUrl",
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
    items: rows(form, "items", ITEM_FIELDS),
  };

  const parsed = outfitSchema.safeParse(draft);
  if (!parsed.success) return {
      attempt: (previous.attempt ?? 0) + 1,
      errors: fieldErrors(parsed.error),
      values: draft,
    };

  const id = Number(form.get("id"));
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
