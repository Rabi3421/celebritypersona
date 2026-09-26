"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { updateBrand } from "@/lib/db/mutations";
import { readHubForm, type HubFormState } from "@/lib/hub-form";
import { brandSchema, fieldErrors } from "@/lib/validation";

export async function saveBrand(_previous: HubFormState, form: FormData): Promise<HubFormState> {
  await requireAdmin();
  const { draft, input } = readHubForm(form);
  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: draft };

  const id = Number(form.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { errors: { form: "That brand has no record yet." }, values: draft };
  await updateBrand(id, parsed.data);
  return { saved: true, values: draft };
}
