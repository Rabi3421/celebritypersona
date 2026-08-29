"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { deleteTrendingSearch, upsertTrendingSearch } from "@/lib/db/mutations";
import { text } from "@/lib/form-data";
import { fieldErrors, trendingSearchSchema, type FieldErrors } from "@/lib/validation";

export type TrendingDraft = {
  term: string;
  volume: string;
  changePct: string;
  intent: string;
  href: string;
  answer: string;
};

export type TrendingFormState = { errors?: FieldErrors; values?: TrendingDraft };

export async function saveTrendingSearch(
  _previous: TrendingFormState,
  form: FormData,
): Promise<TrendingFormState> {
  await requireAdmin();

  const draft: TrendingDraft = {
    term: text(form, "term"),
    volume: text(form, "volume"),
    changePct: text(form, "changePct"),
    intent: text(form, "intent"),
    href: text(form, "href"),
    answer: text(form, "answer"),
  };

  const parsed = trendingSearchSchema.safeParse(draft);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: draft };

  const original = text(form, "original");
  await upsertTrendingSearch(original || null, parsed.data);
  redirect("/admin/trending");
}

export async function removeTrendingSearch(form: FormData) {
  await requireAdmin();
  await deleteTrendingSearch(text(form, "term"));
  redirect("/admin/trending");
}
