import { jwtVerify, SignJWT, type JWTPayload } from "jose";

/**
 * Pure token logic, safe to import from proxy.ts. No next/headers, no database,
 * no globals, so it runs anywhere the proxy is deployed.
 */

export const SESSION_COOKIE = "cp_admin_session";
export const MAX_AGE_SECONDS = 60 * 60 * 8;

export type SessionPayload = JWTPayload & { email: string };

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  return new TextEncoder().encode(secret);
}

export async function signSession(email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setSubject(email)
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
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
    });
    // Re-checked on every request, so revoking access is one env var change.
    const allowed = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (!allowed || payload.email?.trim().toLowerCase() !== allowed) return null;
    return payload;
  } catch {
    return null;
  }
}
