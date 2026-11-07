/**
 * The analytics consent manager, in the browser. Everything that loads or
 * sends analytics asks it first:
 *
 *   components/site/Analytics.tsx   mounts Google Analytics only when accepted
 *   lib/posthog/client.ts           loads PostHog only when accepted
 *   lib/analytics.ts                drops events raised before acceptance
 *   components/site/ConsentBanner   asks, and lets the reader change their mind
 *
 * The choice lives in localStorage (CONSENT_STORAGE_KEY), so it holds on later
 * visits. If storage is unavailable the choice still applies for the rest of
 * the page, and the banner simply asks again next time.
 *
 * Withdrawal is a choice like any other: setConsent("rejected") tells every
 * subscriber, which stop sending and delete their cookies and storage.
 */

import {
  CONSENT_STORAGE_KEY,
  cookieDomainsFor,
  isGoogleAnalyticsCookie,
  isPostHogStorageKey,
  parseConsent,
  serializeConsent,
  type ConsentChoice,
  type ConsentState,
} from "./consent-core";
import { POSTHOG_ENABLED } from "./posthog/client-env";

export type { ConsentChoice, ConsentState };

/** Google Analytics runs only on the Production deployment with an ID (same rule as app/layout.tsx). */
const GA_ID =
  process.env.CP_DEPLOY_ENV === "production" ? (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "").trim() : "";
const GA_ENABLED = GA_ID !== "";

/** Whether there is anything to ask about. Preview and local builds have no analytics, so no banner. */
export const ANALYTICS_AVAILABLE = GA_ENABLED || POSTHOG_ENABLED;

let cached: ConsentState | null = null;
const listeners = new Set<() => void>();

export function readConsent(): ConsentState {
  if (typeof window === "undefined") return "undecided";
  if (cached === null) {
    try {
      cached = parseConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY));
    } catch {
      cached = "undecided";
    }
  }
  return cached;
}

export function setConsent(choice: ConsentChoice) {
  cached = choice;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, serializeConsent(choice, Date.now()));
  } catch {
    // Blocked storage: the choice still applies to this page.
  }
  applyChange(choice);
}

/**
 * The order matters, here and when another tab changes the choice:
 *  1. switch Google Analytics off synchronously (its documented ga-disable
 *     flag), so a running tag cannot send anything in the gap before React
 *     re-renders;
 *  2. tell every subscriber (PostHog suspends at once; the GA component
 *     follows on its next render);
 *  3. only then delete the cookies and storage, so no live tag sees its
 *     cookie disappear and starts again.
 */
function applyChange(state: ConsentState) {
  if (state !== "accepted") disableGoogleAnalyticsNow();
  for (const listener of [...listeners]) listener();
  if (state === "rejected") clearAnalyticsStorage();
}

function disableGoogleAnalyticsNow() {
  if (GA_ID) (window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = true;
}

let followingOtherTabs = false;

/** One listener for choices made in other tabs of this site. */
function followOtherTabs() {
  if (followingOtherTabs) return;
  followingOtherTabs = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== CONSENT_STORAGE_KEY && event.key !== null) return;
    cached = null;
    applyChange(readConsent());
  });
}

/** For useSyncExternalStore and the analytics loaders. Also follows other tabs. */
export function subscribeConsent(listener: () => void): () => void {
  listeners.add(listener);
  followOtherTabs();
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Deletes what the analytics tools left in this browser: Google Analytics'
 * cookies on this host and its parent domains, and PostHog's storage keys.
 * The consent record itself stays, so the "no" is remembered.
 */
export function clearAnalyticsStorage() {
  try {
    const names = document.cookie
      .split(";")
      .map((part) => part.split("=")[0]?.trim() ?? "")
      .filter(isGoogleAnalyticsCookie);
    for (const name of names) {
      for (const domain of cookieDomainsFor(window.location.hostname)) {
        document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
      }
    }
  } catch {
    // Cookies unavailable: nothing to delete.
  }
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      for (const key of Object.keys(store)) if (isPostHogStorageKey(key)) store.removeItem(key);
    } catch {
      // Storage unavailable: nothing to delete.
    }
  }
}

/** Opens the choices panel (from "Analytics choices" in the footer). */
export const OPEN_CONSENT_EVENT = "cp:open-analytics-choices";
export function openConsentChoices() {
  window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
}
