"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createOccasion, deleteOccasion, updateOccasion } from "@/lib/db/mutations";
import { rows, text } from "@/lib/form-data";
import { fieldErrors, occasionSchema, type FieldErrors } from "@/lib/validation";

export type OccasionFormState = { errors?: FieldErrors };

export async function saveOccasion(
  _previous: OccasionFormState,
  form: FormData,
): Promise<OccasionFormState> {
  await requireAdmin();

  const parsed = occasionSchema.safeParse({
    name: text(form, "name"),
    group: text(form, "group"),
    looks: text(form, "looks"),
    swapFrom: text(form, "swapFrom"),
    averageWorn: text(form, "averageWorn"),
    averageSwap: text(form, "averageSwap"),
    peak: text(form, "peak"),
    description: text(form, "description"),
    colours: rows(form, "colours", ["name", "value"]),
    garments: rows(form, "garments", ["name", "count"]),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const id = Number(form.get("id"));
  if (Number.isFinite(id) && id > 0) await updateOccasion(id, parsed.data);
  else await createOccasion(parsed.data);
  redirect("/admin/occasions");
}

export async function removeOccasion(form: FormData) {
  await requireAdmin();
  await deleteOccasion(Number(form.get("id")));
  redirect("/admin/occasions");
}
