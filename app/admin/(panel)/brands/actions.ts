"use server";

import { adminForAction, SESSION_EXPIRED_MESSAGE } from "@/lib/auth/admin";
import { updateBrand } from "@/lib/db/mutations";
import { readHubForm, type HubFormState } from "@/lib/hub-form";
import { brandSchema, fieldErrors } from "@/lib/validation";

export async function saveBrand(_previous: HubFormState, form: FormData): Promise<HubFormState> {
  const admin = await adminForAction();
  const { draft, input } = readHubForm(form);
  if (!admin) return { sessionExpired: true, errors: { form: SESSION_EXPIRED_MESSAGE }, values: draft };
  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: draft };

  const id = Number(form.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { errors: { form: "That brand has no record yet." }, values: draft };
  await updateBrand(id, parsed.data);
  return { saved: true, values: draft };
}
