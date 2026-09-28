import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { adminUsers } from "@/lib/mongodb";
import {
  renewedCookie,
  SESSION_COOKIE,
  sessionCookie,
  shouldRenew,
  signSession,
  expiryFor,
  verifySession,
  type SessionPayload,
} from "./token";

export { SESSION_COOKIE, type SessionPayload };

export async function startSession(email: string) {
  const store = await cookies();
  const authAt = Date.now();
  store.set(sessionCookie(await signSession(email, authAt), expiryFor(authAt)));
}

export async function endSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * When sessions were last revoked — by "Sign out everywhere" or a password
 * change — or null. A session whose sign-in is older than this is refused.
 * One small read per request, cached within it.
 */
const sessionsValidAfter = cache(async (email: string): Promise<number | null> => {
  const user = await (await adminUsers()).findOne(
    { email: email.trim().toLowerCase() },
    { projection: { _id: 0, sessionsValidAfter: 1 } },
  );
  return user?.sessionsValidAfter ? new Date(user.sessionsValidAfter).getTime() : null;
});

/**
 * The live session, or null.
 *
 * This is the authoritative check — every protected page, action and route
 * calls it. The proxy's check is only the fast first pass: it cannot see the
 * database, so a signed-out-everywhere token gets past it and stops here.
 */
export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const payload = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const after = await sessionsValidAfter(payload.email);
  if (after !== null && payload.authAt < after) return null;
  return payload;
}

/**
 * Re-issues the cookie if it is due, for the route handlers and actions that
 * may set cookies. Page loads are renewed by the proxy instead.
 */
export async function renewSession(payload: SessionPayload) {
  if (!shouldRenew(payload)) return;
  const store = await cookies();
  store.set(await renewedCookie(payload));
}

/**
 * Signs out every session, this one included: any token whose sign-in is
 * older than now is refused from here on. Also what a password change does.
 */
export async function signOutEverywhere(email: string) {
  await (await adminUsers()).updateOne(
    { email: email.trim().toLowerCase() },
    { $set: { sessionsValidAfter: new Date() } },
  );
  await endSession();
}
