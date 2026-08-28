"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyCredentials } from "@/lib/auth/admin";
import {
  checkRateLimit,
  clearAttempts,
  recordFailure,
} from "@/lib/auth/rate-limit";
import { startSession } from "@/lib/auth/session";

export type LoginState = { error?: string };

async function clientKey() {
  const headerList = await headers();
  return (
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerList.get("x-real-ip") ??
    "local"
  );
}

export async function signIn(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const from = String(formData.get("from") ?? "/admin");

  const key = await clientKey();
  const limit = checkRateLimit(key);
  if (!limit.ok) {
    return {
      error: `Too many attempts. Try again in ${limit.retryAfterMinutes} minute${
        limit.retryAfterMinutes === 1 ? "" : "s"
      }.`,
    };
  }

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const verified = await verifyCredentials(email, password);
  if (!verified) {
    recordFailure(key);
    // Deliberately vague: never reveal which half was wrong.
    return { error: "Those details do not match." };
  }

  clearAttempts(key);
  await startSession(verified);
  redirect(from.startsWith("/admin/") || from === "/admin" ? from : "/admin");
}
