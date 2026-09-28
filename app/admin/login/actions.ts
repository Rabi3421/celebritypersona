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

type Attempt = { ok: true; email: string } | { ok: false; error: string };

/** The whole sign-in check — rate limit, both credentials, the session —
 *  shared by the login page and the in-place sign-in prompt. */
async function attemptSignIn(formData: FormData): Promise<Attempt> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const key = await clientKey();
  const limit = checkRateLimit(key);
  if (!limit.ok) {
    return {
      ok: false,
      error: `Too many attempts. Try again in ${limit.retryAfterMinutes} minute${
        limit.retryAfterMinutes === 1 ? "" : "s"
      }.`,
    };
  }

  if (!email || !password) {
    return { ok: false, error: "Enter your email and password." };
  }

  const verified = await verifyCredentials(email, password);
  if (!verified) {
    recordFailure(key);
    // Deliberately vague: never reveal which half was wrong.
    return { ok: false, error: "Those details do not match." };
  }

  clearAttempts(key);
  await startSession(verified);
  return { ok: true, email: verified };
}

export async function signIn(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const from = String(formData.get("from") ?? "/admin");
  const result = await attemptSignIn(formData);
  if (!result.ok) return { error: result.error };
  redirect(from.startsWith("/admin/") || from === "/admin" ? from : "/admin");
}

/**
 * Sign-in without leaving the page, for the prompt that appears when a
 * session runs out mid-edit. Nothing navigates, so the form behind the prompt
 * keeps everything typed into it; the caller retries what failed.
 */
export async function signInInPlace(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const result = await attemptSignIn(formData);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
