"use server";

import { requireAdmin } from "@/lib/auth/admin";
import {
  deleteCelebrityRequest,
  deleteSubscriber,
  setCelebrityRequestStatus,
  setSubscriberStatus,
} from "@/lib/db/mutations";
import { text } from "@/lib/form-data";
import { requestStatusSchema, subscriberStatusSchema } from "@/lib/validation";

export async function updateRequestStatus(form: FormData) {
  await requireAdmin();
  const parsed = requestStatusSchema.safeParse({
    id: text(form, "id"),
    status: text(form, "status"),
  });
  if (!parsed.success) return;
  await setCelebrityRequestStatus(parsed.data.id, parsed.data.status);
}

export async function removeRequest(form: FormData) {
  await requireAdmin();
  await deleteCelebrityRequest(text(form, "id"));
}

export async function updateSubscriberStatus(form: FormData) {
  await requireAdmin();
  const parsed = subscriberStatusSchema.safeParse({
    id: text(form, "id"),
    status: text(form, "status"),
  });
  if (!parsed.success) return;
  await setSubscriberStatus(parsed.data.id, parsed.data.status);
}

export async function removeSubscriber(form: FormData) {
  await requireAdmin();
  await deleteSubscriber(text(form, "id"));
}
