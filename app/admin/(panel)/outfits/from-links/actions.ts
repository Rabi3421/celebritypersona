"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { cancelLookJob, createLookJob, forgetLookJob, getLookJob, removeLookJob } from "@/lib/db/look-jobs";
import { text } from "@/lib/form-data";
import { newLookJobId, newLookJobSchema } from "@/lib/look-jobs";
import { fieldErrors, type FieldErrors } from "@/lib/validation";

const PAGE = "/admin/outfits/from-links";

export type LookJobDraft = {
  celebrity: string;
  celebrityInstagram: string;
  labelUrl: string;
  buyUrls: string;
  instagramUrl: string;
  alternateUrls: string;
};
export type LookJobFormState = { errors?: FieldErrors; values?: LookJobDraft };

/** The same fields as the editor's sheet; the photo is added in the draft's editor. */
export async function queueLookJob(_previous: LookJobFormState, form: FormData): Promise<LookJobFormState> {
  const session = await requireAdmin();
  const values: LookJobDraft = {
    celebrity: text(form, "celebrity"),
    celebrityInstagram: text(form, "celebrityInstagram"),
    labelUrl: text(form, "labelUrl"),
    buyUrls: text(form, "buyUrls"),
    instagramUrl: text(form, "instagramUrl"),
    alternateUrls: text(form, "alternateUrls"),
  };
  const parsed = newLookJobSchema.safeParse({ ...values, note: "", photoPath: "", photoUrl: "" });
  // A look added here always names who wore it.
  const nameMissing = !values.celebrity.trim();
  if (!parsed.success || nameMissing) {
    const errors = parsed.success ? {} : fieldErrors(parsed.error);
    if (nameMissing) errors.celebrity = "Who wore it? Type the celebrity's name.";
    return { errors, values };
  }

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

/**
 * Runs a failed or cancelled look again: a fresh job with the same links (a
 * new id, so its result is announced like any other), and the old one removed.
 */
export async function retryLookJobAction(form: FormData) {
  const session = await requireAdmin();
  const job = await getLookJob(text(form, "id"));
  if (!job || (job.status !== "failed" && job.status !== "cancelled")) redirect(PAGE);
  const parsed = newLookJobSchema.safeParse({
    instagramUrl: job.instagramUrl,
    buyUrls: job.buyUrls.join("\n"),
    celebrity: job.celebrity ?? "",
    celebrityInstagram: job.celebrityInstagram ?? "",
    labelUrl: job.labelUrl ?? "",
    alternateUrls: (job.alternateUrls ?? []).join("\n"),
    note: job.note ?? "",
    photoPath: job.photo?.path ?? "",
    photoUrl: job.photo?.url ?? "",
  });
  if (!parsed.success) redirect(PAGE);
  const id = newLookJobId((size) => randomBytes(size));
  await createLookJob({ ...parsed.data, id }, session.email);
  // The photo now belongs to the new job: drop the old record without deleting it.
  await forgetLookJob(job.id);
  revalidatePath(PAGE);
  redirect(`${PAGE}?queued=${id}`);
}

export async function removeLookJobAction(form: FormData) {
  await requireAdmin();
  await removeLookJob(text(form, "id"));
  revalidatePath(PAGE);
  redirect(PAGE);
}
