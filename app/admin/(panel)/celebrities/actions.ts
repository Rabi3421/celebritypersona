"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import {
  createCelebrity,
  deleteCelebrity,
  updateCelebrity,
} from "@/lib/db/mutations";
import { lines, text } from "@/lib/form-data";
import { celebritySchema, fieldErrors, type FieldErrors } from "@/lib/validation";

export type CelebrityDraft = {
  name: string;
  bio: string;
  sameAs: string;
};

export type CelebrityFormState = { errors?: FieldErrors; values?: CelebrityDraft };

export async function saveCelebrity(
  _previous: CelebrityFormState,
  form: FormData,
): Promise<CelebrityFormState> {
  await requireAdmin();

  const draft: CelebrityDraft = {
    name: text(form, "name"),
    bio: String(form.get("bio") ?? ""),
    sameAs: String(form.get("sameAs") ?? ""),
  };

  const parsed = celebritySchema.safeParse({
    ...draft,
    bio: lines(form, "bio"),
    sameAs: lines(form, "sameAs"),
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
