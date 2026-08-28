import "server-only";
import { cookies } from "next/headers";
import {
  MAX_AGE_SECONDS,
  SESSION_COOKIE,
  signSession,
  verifySession,
  type SessionPayload,
} from "./token";

export { SESSION_COOKIE, type SessionPayload };

export async function startSession(email: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}
