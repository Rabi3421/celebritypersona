"use server";

import { adminForAction, SESSION_EXPIRED_MESSAGE } from "@/lib/auth/admin";
import { BUDGET_CAPS } from "@/lib/budget";
import { saveBudgetPage } from "@/lib/db/mutations";
import { readHubForm, type HubFormState } from "@/lib/hub-form";
import { budgetPageSchema, fieldErrors } from "@/lib/validation";

export async function saveBudget(_previous: HubFormState, form: FormData): Promise<HubFormState> {
  const admin = await adminForAction();
  const { draft, input } = readHubForm(form);
  if (!admin) return { sessionExpired: true, errors: { form: SESSION_EXPIRED_MESSAGE }, values: draft };
  const parsed = budgetPageSchema.safeParse(input);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: draft };

  const cap = Number(form.get("cap"));
  if (!(BUDGET_CAPS as readonly number[]).includes(cap)) return { errors: { form: "Unknown budget page." }, values: draft };
  await saveBudgetPage(cap, parsed.data);
  return { saved: true, values: draft };
}
