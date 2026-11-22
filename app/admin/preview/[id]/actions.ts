"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { setCheckCleared } from "@/lib/db/look-jobs";
import { setOutfitStatus } from "@/lib/db/mutations";
import { text } from "@/lib/form-data";
import { publishReadiness } from "@/lib/publish-readiness";

/**
 * Confirms one research check on a draft (or opens it again). Called from the
 * review panel without leaving the page: the panel shows the change at once,
 * and the refreshed page confirms it.
 */
export async function toggleResearchCheck(form: FormData) {
  const session = await requireAdmin();
  const outfitId = Number(form.get("outfitId"));
  await setCheckCleared(text(form, "jobId"), text(form, "check"), text(form, "cleared") === "1", session.email);
  revalidatePath(`/admin/preview/${outfitId}`);
}

/**
 * Publishes the draft from its preview, under exactly the rules the editor
 * and the list apply: every research check confirmed, every critical SEO
 * check passing. Anything still missing is named back on the preview.
 */
export async function publishFromPreview(form: FormData) {
  await requireAdmin();
  const id = Number(form.get("id"));
  const page = `/admin/preview/${Number.isFinite(id) ? id : ""}`;
  const readiness = Number.isFinite(id) ? await publishReadiness(id) : null;
  if (!readiness) redirect("/admin/outfits");
  if (!readiness.ready) redirect(`${page}?notPublished=1`);
  if (!readiness.live) await setOutfitStatus(id, "published");
  revalidatePath(page);
  redirect(`${page}?published=1`);
}
