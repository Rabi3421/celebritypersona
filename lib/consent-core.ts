/**
 * The analytics consent record: its states and how it is stored. Pure
 * functions with no imports, unit-tested in tests/consent.test.mjs. The browser
 * store built on top of it is lib/consent.ts.
 *
 * One choice covers both analytics tools (Google Analytics and PostHog):
 *   undecided  nothing is loaded or sent, and the banner asks
 *   accepted   both may load and send, from that moment on
 *   rejected   neither loads; the banner stays away until the reader reopens it
 */

export type ConsentState = "accepted" | "rejected" | "undecided";
export type ConsentChoice = Exclude<ConsentState, "undecided">;

/** The localStorage key. Essential storage: it only remembers the answer. */
export const CONSENT_STORAGE_KEY = "cp_analytics_consent";

/**
 * Bump when the analytics described in the privacy policy change in a way
 * readers should be asked about again: older answers then read as undecided.
 */
export const CONSENT_VERSION = 1;

type StoredConsent = { v: number; analytics: ConsentChoice; at: string };

/** Anything missing, malformed, from another version or unexpected is undecided. */
export function parseConsent(raw: string | null | undefined): ConsentState {
  if (!raw) return "undecided";
  try {
    const value = JSON.parse(raw) as Partial<StoredConsent>;
    if (value?.v !== CONSENT_VERSION) return "undecided";
    return value.analytics === "accepted" || value.analytics === "rejected" ? value.analytics : "undecided";
  } catch {
    return "undecided";
  }
}

export function serializeConsent(choice: ConsentChoice, now: number): string {
  const record: StoredConsent = { v: CONSENT_VERSION, analytics: choice, at: new Date(now).toISOString() };
  return JSON.stringify(record);
}

/** Cookie names Google Analytics sets: `_ga` and `_ga_<container id>`. */
export function isGoogleAnalyticsCookie(name: string): boolean {
  return name === "_ga" || /^_ga_[A-Z0-9]+$/i.test(name);
}

/** PostHog's browser storage keys (`ph_<key>_posthog`, its opt-in/out flag, etc). */
export function isPostHogStorageKey(name: string): boolean {
  return /^(?:__)?ph_/i.test(name);
}

/**
 * The domain values a cookie set by gtag.js may carry for this host, so it can
 * be deleted: the host itself, and each parent domain (gtag's "auto" domain is
 * the highest one that accepts a cookie, e.g. `.celebritypersona.com`).
 */
export function cookieDomainsFor(hostname: string): string[] {
  const parts = hostname.split(".");
  const domains = [""];
  if (parts.length < 2 || /^\d+(\.\d+){3}$/.test(hostname)) return domains;
  for (let i = 0; i < parts.length - 1; i++) domains.push(`.${parts.slice(i).join(".")}`);
  return domains;
}
