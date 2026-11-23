"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { endSession, readSession, signOutEverywhere } from "@/lib/auth/session";
import { requireAdmin } from "@/lib/auth/admin";
import { staffCookie } from "@/lib/staff";

/**
 * Counts this browser in analytics again, or stops counting it (lib/staff.ts).
 * Per browser: the laptop and the MacBook are each switched on their own.
 */
export async function setStaffBrowser(form: FormData) {
  await requireAdmin();
  const exclude = form.get("exclude") === "1";
  (await cookies()).set(staffCookie(exclude ? "1" : "off", process.env.NODE_ENV === "production"));
  redirect("/admin/settings#this-browser");
}

export async function signOut() {
  await endSession();
  redirect("/admin/login");
}

/**
 * Signs out every browser and device, this one included. Any session signed
 * in before now is refused from here on; the next visit asks for the password.
 */
export async function signOutAllSessions() {
  const session = await readSession();
  if (session) await signOutEverywhere(session.email);
  redirect("/admin/login");
}
