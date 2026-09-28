"use server";

import { redirect } from "next/navigation";
import { adminForAction, SESSION_EXPIRED_MESSAGE } from "@/lib/auth/admin";
import { saveHomeContent } from "@/lib/db/mutations";
import { flag, rows, text } from "@/lib/form-data";
import { fieldErrors, homeContentSchema, type FieldErrors } from "@/lib/validation";

export type HomeFormState = { errors?: FieldErrors; saved?: boolean; sessionExpired?: boolean };

export async function saveHome(
  _previous: HomeFormState,
  form: FormData,
): Promise<HomeFormState> {
  if (!(await adminForAction())) return { sessionExpired: true, errors: { form: SESSION_EXPIRED_MESSAGE } };

  const parsed = homeContentSchema.safeParse({
    showStats: flag(form, "showStats"),
    swapSteps: rows(form, "swapSteps", ["n", "title", "body"]),
    trustPoints: rows(form, "trustPoints", ["n", "title", "body"]),
    campaign: {
      eyebrow: text(form, "campaign.eyebrow"),
      title: text(form, "campaign.title"),
      body: text(form, "campaign.body"),
      cta: text(form, "campaign.cta"),
      href: text(form, "campaign.href"),
    },
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  await saveHomeContent(parsed.data);
  redirect("/admin/home?saved=1");
}
