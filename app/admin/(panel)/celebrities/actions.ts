"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { canonicalName, sameName } from "@/lib/archive";
import { getCelebrityViews } from "@/lib/db/content";
import { createCelebrity, deleteCelebrity, renameCelebrityEverywhere, updateCelebrity } from "@/lib/db/mutations";
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

  // Deleting from a row should land back on the page and filters that were
  // open. Anything but a path on this list is ignored, so a posted field can
  // never send the admin somewhere else.
  const back = text(form, "returnTo");
  redirect(back.startsWith("/admin/celebrities") ? back : "/admin/celebrities");
}

/**
 * Corrects a name across every look that carries it. Works for a name no
 * record covers, which is the case a form cannot reach.
 */
export async function renameCelebrity(form: FormData) {
  await requireAdmin();

  const from = text(form, "from");
  // Settled against the names already in use, so renaming onto an existing one
  // merges rather than creating a near-duplicate that differs only in case.
  const known = await getCelebrityViews();
  const to = canonicalName(text(form, "to"), known.map((entry) => entry.name));

  if (to && !sameName(from, to)) await renameCelebrityEverywhere(from, to);

  const back = text(form, "returnTo");
  redirect(back.startsWith("/admin/celebrities") ? back : "/admin/celebrities");
}
