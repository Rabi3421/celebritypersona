"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { cancelLookJob, createLookJob, removeLookJob } from "@/lib/db/look-jobs";
import { text } from "@/lib/form-data";
import { newLookJobId, newLookJobSchema } from "@/lib/look-jobs";
import { fieldErrors, type FieldErrors } from "@/lib/validation";

const PAGE = "/admin/outfits/from-links";

export type LookJobDraft = { instagramUrl: string; buyUrls: string; note: string };
export type LookJobFormState = { errors?: FieldErrors; values?: LookJobDraft };

export async function queueLookJob(_previous: LookJobFormState, form: FormData): Promise<LookJobFormState> {
  const session = await requireAdmin();
  const values: LookJobDraft = {
    instagramUrl: text(form, "instagramUrl"),
    buyUrls: text(form, "buyUrls"),
    note: text(form, "note"),
  };
  const parsed = newLookJobSchema.safeParse({
    ...values,
    photoPath: text(form, "photoPath"),
    photoUrl: text(form, "photoUrl"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const id = newLookJobId((size) => randomBytes(size));
  await createLookJob({ ...parsed.data, id }, session.email);
  revalidatePath(PAGE);
  // The id in the address gives the next form a fresh start (see the page).
  redirect(`${PAGE}?queued=${id}`);
}

export async function cancelLookJobAction(form: FormData) {
  await requireAdmin();
  await cancelLookJob(text(form, "id"));
  revalidatePath(PAGE);
  redirect(PAGE);
}

export async function removeLookJobAction(form: FormData) {
  await requireAdmin();
  await removeLookJob(text(form, "id"));
  revalidatePath(PAGE);
  redirect(PAGE);
}
