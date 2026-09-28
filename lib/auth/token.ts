import { jwtVerify, SignJWT, type JWTPayload } from "jose";

/**
 * Pure token logic, safe to import from proxy.ts. No next/headers, no database,
 * no globals, so it runs anywhere the proxy is deployed.
 *
 * The session slides. A token lasts `idleSeconds()` from the moment it was
 * issued, and activity in the panel re-issues it, so an editor who keeps
 * working is never signed out mid-form; one who walks away is signed out a day
 * later. `authAt` — when the password was actually typed — travels unchanged
 * through every re-issue, and no token is ever valid past `authAt` plus
 * `maxSeconds()`, so a session cannot be kept alive for ever.
 */

export const SESSION_COOKIE = "cp_admin_session";

const DAY = 60 * 60 * 24;

/**
 * Limits, overridable for testing only. Outside production the three
 * ADMIN_SESSION_* variables shorten them (e.g. a 60-second idle timeout), so
 * expiry can be exercised in a browser without waiting a day. In production
 * they are ignored, so a stray variable cannot weaken or lengthen the session.
 */
function limit(name: string, fallback: number): number {
  if (process.env.NODE_ENV === "production") return fallback;
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Signed out after this long without activity. */
export const idleSeconds = () => limit("ADMIN_SESSION_IDLE_SECONDS", DAY);

/** Signed out this long after signing in, however active. */
export const maxSeconds = () => limit("ADMIN_SESSION_MAX_SECONDS", 30 * DAY);

/** A token older than this is re-issued on the next request, so busy pages do
 *  not mint a new cookie on every click. */
export const renewAfterSeconds = () =>
  limit("ADMIN_SESSION_RENEW_SECONDS", Math.min(10 * 60, Math.floor(idleSeconds() / 4)));

export type SessionPayload = JWTPayload & {
  email: string;
  /** When the password was typed, in milliseconds. Never moved by a renewal. */
  authAt: number;
};

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  return new TextEncoder().encode(secret);
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** When a token issued now for this sign-in would expire: a full idle window,
 *  but never past the absolute maximum. */
export const expiryFor = (authAt: number) =>
  Math.min(nowSeconds() + idleSeconds(), Math.floor(authAt / 1000) + maxSeconds());

/** A token for a sign-in. `authAt` defaults to now: a fresh sign-in. */
export async function signSession(email: string, authAt: number = Date.now()): Promise<string> {
  return new SignJWT({ email, authAt })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setSubject(email)
    .setExpirationTime(expiryFor(authAt))
    .sign(secretKey());
}

/** Returns the payload, or null for anything that is not a valid live token. */
export async function verifySession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, secretKey(), {
      algorithms: ["HS256"],
      // The same clock as every other expiry calculation here.
      currentDate: new Date(Date.now()),
    });
    // Re-checked on every request, so revoking access is one env var change.
    const allowed = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (!allowed || payload.email?.trim().toLowerCase() !== allowed) return null;
    // Tokens from before the sliding session carry no sign-in time; they are
    // honoured until their own expiry, as the moment they were issued.
    const authAt = typeof payload.authAt === "number" ? payload.authAt : (payload.iat ?? 0) * 1000;
    if (nowSeconds() > Math.floor(authAt / 1000) + maxSeconds()) return null;
    return { ...payload, authAt };
  } catch {
    return null;
  }
}

/** Whether this live token is old enough to re-issue, and a re-issue would
 *  actually push its expiry later. */
export function shouldRenew(payload: SessionPayload): boolean {
  const issued = payload.iat ?? 0;
  return nowSeconds() - issued >= renewAfterSeconds() && expiryFor(payload.authAt) > (payload.exp ?? 0);
}

/** Cookie settings for a token expiring at `exp` (seconds). */
export const sessionCookie = (token: string, exp: number) => ({
  name: SESSION_COOKIE,
  value: token,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: Math.max(0, exp - nowSeconds()),
});

/** A re-issued token for a live session, with the same sign-in time. */
export async function renewedCookie(payload: SessionPayload) {
  const token = await signSession(payload.email, payload.authAt);
  return sessionCookie(token, expiryFor(payload.authAt));
}
