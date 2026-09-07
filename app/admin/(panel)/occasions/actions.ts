"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { canonicalName, sameName } from "@/lib/archive";
import { getOccasionViews } from "@/lib/db/content";
import { createOccasion, deleteOccasion, renameOccasionEverywhere, updateOccasion } from "@/lib/db/mutations";
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

  // Deleting from a row should land back on the page and filters that were
  // open. Anything but a path on this list is ignored, so a posted field can
  // never send the admin somewhere else.
  const back = text(form, "returnTo");
  redirect(back.startsWith("/admin/occasions") ? back : "/admin/occasions");
}

/**
 * Corrects a name across every look that carries it. Works for a name no
 * record covers, which is the case a form cannot reach.
 */
export async function renameOccasion(form: FormData) {
  await requireAdmin();

  const from = text(form, "from");
  // Settled against the names already in use, so renaming onto an existing one
  // merges rather than creating a near-duplicate that differs only in case.
  const known = await getOccasionViews();
  const to = canonicalName(text(form, "to"), known.map((entry) => entry.name));

  if (to && !sameName(from, to)) await renameOccasionEverywhere(from, to);

  const back = text(form, "returnTo");
  redirect(back.startsWith("/admin/occasions") ? back : "/admin/occasions");
}
