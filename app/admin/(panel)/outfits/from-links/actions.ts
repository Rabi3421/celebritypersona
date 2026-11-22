"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { cancelLookJob, createLookJob, forgetLookJob, getLookJob, removeLookJob } from "@/lib/db/look-jobs";
import { getSuggestion, setSuggestionStatus } from "@/lib/db/look-suggestions";
import { text } from "@/lib/form-data";
import { newLookJobId, newLookJobSchema } from "@/lib/look-jobs";
import { fieldErrors, type FieldErrors } from "@/lib/validation";

const PAGE = "/admin/outfits/from-links";

export type LookJobDraft = { instagramUrl: string; buyUrls: string };
export type LookJobFormState = { errors?: FieldErrors; values?: LookJobDraft };

/** The form is just the two links; the photo is added in the draft's editor. */
export async function queueLookJob(_previous: LookJobFormState, form: FormData): Promise<LookJobFormState> {
  const session = await requireAdmin();
  const values: LookJobDraft = {
    instagramUrl: text(form, "instagramUrl"),
    buyUrls: text(form, "buyUrls"),
  };
  const parsed = newLookJobSchema.safeParse({ ...values, note: "", photoPath: "", photoUrl: "" });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const id = newLookJobId((size) => randomBytes(size));
  await createLookJob({ ...parsed.data, id }, session.email);
  revalidatePath(PAGE);
  // The id in the address gives the next form a fresh start (see the page).
  redirect(`${PAGE}?queued=${id}`);
}

/** Turns one of the scout's suggestions into a research job: the editor's tap. */
export async function queueSuggestionAction(form: FormData) {
  const session = await requireAdmin();
  const suggestion = await getSuggestion(text(form, "id"));
  if (!suggestion || suggestion.status !== "suggested") redirect(PAGE);
  const parsed = newLookJobSchema.safeParse({
    instagramUrl: suggestion.instagramUrl,
    buyUrls: suggestion.buyUrls.join("\n"),
    note: `Scout: ${suggestion.celebrity}, ${suggestion.event} (${suggestion.date}).`.slice(0, 500),
    photoPath: "",
    photoUrl: "",
  });
  if (!parsed.success) redirect(PAGE);
  const id = newLookJobId((size) => randomBytes(size));
  await createLookJob({ ...parsed.data, id }, session.email);
  await setSuggestionStatus(suggestion.id, "queued", id);
  revalidatePath(PAGE);
  redirect(`${PAGE}?queued=${id}`);
}

export async function dismissSuggestionAction(form: FormData) {
  await requireAdmin();
  await setSuggestionStatus(text(form, "id"), "dismissed");
  revalidatePath(PAGE);
  redirect(PAGE);
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
