"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { createOccasion, deleteOccasion, updateOccasion } from "@/lib/db/mutations";
import { rows, text } from "@/lib/form-data";
import { fieldErrors, occasionSchema, type FieldErrors } from "@/lib/validation";

export type OccasionDraft = {
  name: string;
  group: string;
  peak: string;
  description: string;
  nextDate: string;
  colours: Record<string, string>[];
};

export type OccasionFormState = { attempt?: number; errors?: FieldErrors; values?: OccasionDraft };

export async function saveOccasion(
  previous: OccasionFormState,
  form: FormData,
): Promise<OccasionFormState> {
  await requireAdmin();

  const draft: OccasionDraft = {
    name: text(form, "name"),
    group: text(form, "group"),
    peak: text(form, "peak"),
    description: text(form, "description"),
    nextDate: text(form, "nextDate"),
    colours: rows(form, "colours", ["name", "value"]),
  };

  const parsed = occasionSchema.safeParse(draft);
  if (!parsed.success) return {
      attempt: (previous.attempt ?? 0) + 1,
      errors: fieldErrors(parsed.error),
      values: draft,
    };

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
