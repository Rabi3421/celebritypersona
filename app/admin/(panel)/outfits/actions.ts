"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createOutfit, deleteOutfit, updateOutfit } from "@/lib/db/mutations";
import { flag, rows, text } from "@/lib/form-data";
import { fieldErrors, outfitSchema, type FieldErrors } from "@/lib/validation";

export type OutfitFormState = { errors?: FieldErrors };

const ITEM_FIELDS = ["name", "wornBrand", "swapBrand", "worn", "swap"];

export async function saveOutfit(
  _previous: OutfitFormState,
  form: FormData,
): Promise<OutfitFormState> {
  await requireAdmin();

  const parsed = outfitSchema.safeParse({
    celebrity: text(form, "celebrity"),
    event: text(form, "event"),
    occasion: text(form, "occasion"),
    date: text(form, "date"),
    isNew: flag(form, "isNew"),
    items: rows(form, "items", ITEM_FIELDS),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

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
