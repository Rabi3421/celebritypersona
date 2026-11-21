"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { cancelLookJob, createLookJob, removeLookJob } from "@/lib/db/look-jobs";
import { text } from "@/lib/form-data";
import { newLookJobSchema } from "@/lib/look-jobs";
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
    id: text(form, "id"),
    photoPath: text(form, "photoPath"),
    photoUrl: text(form, "photoUrl"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  try {
    await createLookJob(parsed.data, session.email);
  } catch (error) {
    // A duplicate id means this exact form was already sent (a double click).
    if ((error as { code?: number }).code === 11000) redirect(`${PAGE}?queued=1`);
    throw error;
  }
  revalidatePath(PAGE);
  redirect(`${PAGE}?queued=1`);
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
