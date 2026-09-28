"use server";

import { redirect } from "next/navigation";
import { endSession, readSession, signOutEverywhere } from "@/lib/auth/session";

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
