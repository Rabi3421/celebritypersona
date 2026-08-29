"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import {
  createCelebrity,
  deleteCelebrity,
  updateCelebrity,
} from "@/lib/db/mutations";
import { csv, flag, lines, text } from "@/lib/form-data";
import { celebritySchema, fieldErrors, type FieldErrors } from "@/lib/validation";

export type CelebrityDraft = {
  name: string;
  looks: string;
  averageSaving: string;
  low: string;
  high: string;
  brands: string;
  trending: boolean;
  newArchive: boolean;
  bio: string;
};

export type CelebrityFormState = { errors?: FieldErrors; values?: CelebrityDraft };

export async function saveCelebrity(
  _previous: CelebrityFormState,
  form: FormData,
): Promise<CelebrityFormState> {
  await requireAdmin();

  const draft: CelebrityDraft = {
    name: text(form, "name"),
    looks: text(form, "looks"),
    averageSaving: text(form, "averageSaving"),
    low: text(form, "low"),
    high: text(form, "high"),
    brands: text(form, "brands"),
    trending: flag(form, "trending"),
    newArchive: flag(form, "newArchive"),
    bio: String(form.get("bio") ?? ""),
  };

  const parsed = celebritySchema.safeParse({
    ...draft,
    brands: csv(form, "brands"),
    bio: lines(form, "bio"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: draft };

  const id = Number(form.get("id"));
  if (Number.isFinite(id) && id > 0) await updateCelebrity(id, parsed.data);
  else await createCelebrity(parsed.data);
  redirect("/admin/celebrities");
}

export async function removeCelebrity(form: FormData) {
  await requireAdmin();
  await deleteCelebrity(Number(form.get("id")));
  redirect("/admin/celebrities");
}
