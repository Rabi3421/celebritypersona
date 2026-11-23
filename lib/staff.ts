/**
 * "This browser belongs to the team": its visits and clicks are not traffic.
 *
 * Set on every browser that opens the admin while signed in (see proxy.ts),
 * and kept for 400 days from the last admin visit, through sign-outs, so the editor's own laptop and
 * MacBook stay out of PostHog, Google Analytics and the shop-click log even
 * when they browse the public site signed out. Settings can switch it off for
 * one browser, to see the site exactly as a reader does.
 *
 * A plain readable cookie on purpose: the analytics scripts in the browser
 * must be able to see it before they load. It holds no identity, only "1".
 * Safe to import anywhere; no server or browser APIs at module level.
 */

export const STAFF_COOKIE = "cp_staff";
/** 400 days, the longest Chrome keeps any cookie; renewed on each admin visit. */
export const STAFF_MAX_AGE = 400 * 24 * 60 * 60;

/** "off" means the editor asked for this browser to be counted again; the proxy leaves it alone. */
export type StaffMark = "1" | "off";

export function staffMarkFrom(cookieHeader: string | null | undefined): StaffMark | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === STAFF_COOKIE) {
      const value = rest.join("=");
      return value === "1" || value === "off" ? value : null;
    }
  }
  return null;
}

/** For the server: whether a request comes from a team browser. */
export const isStaffRequest = (cookieHeader: string | null | undefined) => staffMarkFrom(cookieHeader) === "1";

/** For the browser: whether this browser is a team browser. Never throws. */
export function isStaffBrowser(): boolean {
  try {
    return typeof document !== "undefined" && isStaffRequest(document.cookie);
  } catch {
    return false;
  }
}

export const staffCookie = (value: StaffMark, secure: boolean) => ({
  name: STAFF_COOKIE,
  value,
  path: "/",
  maxAge: STAFF_MAX_AGE,
  sameSite: "lax" as const,
  secure,
  httpOnly: false,
});
