"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { setCheckCleared } from "@/lib/db/look-jobs";
import { text } from "@/lib/form-data";

/** Confirms one research check on a draft (or opens it again). */
export async function toggleResearchCheck(form: FormData) {
  const session = await requireAdmin();
  const outfitId = Number(form.get("outfitId"));
  await setCheckCleared(text(form, "jobId"), text(form, "check"), text(form, "cleared") === "1", session.email);
  revalidatePath(`/admin/preview/${outfitId}`);
  redirect(`/admin/preview/${Number.isFinite(outfitId) ? outfitId : ""}#research-checks`);
}
