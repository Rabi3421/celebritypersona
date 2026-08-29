"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { deletePriceReport, setPriceReportStatus } from "@/lib/db/mutations";
import { text } from "@/lib/form-data";
import { priceReportStatusSchema } from "@/lib/validation";

export async function updateReportStatus(form: FormData) {
  await requireAdmin();
  const parsed = priceReportStatusSchema.safeParse({
    id: text(form, "id"),
    status: text(form, "status"),
  });
  if (!parsed.success) return;
  await setPriceReportStatus(parsed.data.id, parsed.data.status);
}

export async function removeReport(form: FormData) {
  await requireAdmin();
  await deletePriceReport(text(form, "id"));
}
