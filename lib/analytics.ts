"use client";

import { sendGAEvent } from "@next/third-parties/google";
import { readConsent, subscribeConsent } from "@/lib/consent";
import { capturePostHogEvent } from "@/lib/posthog/client";

export type AnalyticsValue = string | number | boolean | undefined;

type CleanParameters = Record<string, string | number | boolean>;

/**
 * Events raised before the tag exists.
 *
 * components/site/Analytics.tsx mounts gtag only after the window `load`
 * event, but the view events (`outfit_view`, `celebrity_view`, `search`) fire
 * from effects at hydration, which is earlier. Dropping them meant the page a
 * reader landed on — every visit from search — never reported its own view;
 * only pages reached by a client transition did. They wait here instead and
 * `flushPendingEvents()` sends them, in order, right after `gtag('config')`.
 *
 * Capped, because with no measurement ID (local, preview) nothing ever
 * flushes and the queue should not grow for the life of the tab.
 *
 * Only events raised after the reader accepted analytics are held or sent
 * (lib/consent.ts). Anything raised before that is dropped on the spot, never
 * queued, so accepting can never replay what happened before it.
 */
const MAX_PENDING = 20;
const pending: [string, CleanParameters][] = [];

/** Set by components/site/Analytics.tsx once gtag('config') has run. */
let gaReady = false;

/**
 * Withdrawal (in this tab or another) empties this queue at once, in the same
 * synchronous notification that switches GA off, rather than waiting for the
 * Analytics component's next render. Nothing held here is ever sent after it.
 */
if (typeof window !== "undefined") {
  subscribeConsent(() => {
    if (readConsent() !== "accepted") stopGaEvents();
  });
}

function send(name: string, parameters: CleanParameters) {
  try {
    sendGAEvent("event", name, parameters);
  } catch {
    // Analytics is optional. A blocked or incomplete tag must never interrupt
    // rendering, saving, sharing, form success, or an outbound retailer click.
  }
}

/** Sends when GA is configured on this page, and holds the event until it is
 *  when the tag has not mounted yet. Also hands the event to PostHog, which
 *  keeps its own queue (lib/posthog/client.ts): neither waits on the other. */
export function trackEvent(name: string, parameters: Record<string, AnalyticsValue> = {}) {
  if (typeof window === "undefined") return;
  if (readConsent() !== "accepted") return;
  const clean = Object.fromEntries(
    Object.entries(parameters).filter((entry): entry is [string, string | number | boolean] =>
      entry[1] !== undefined,
    ),
  );
  try {
    capturePostHogEvent(name, clean);
  } catch {
    // Same rule as GA: analytics never interrupts the page.
  }
  if (!gaReady) {
    if (pending.length < MAX_PENDING) pending.push([name, clean]);
    return;
  }
  send(name, clean);
}

/** Sends everything raised (after consent) before the tag mounted. Called by
 *  the Analytics component once gtag's init script has run. */
export function flushPendingEvents() {
  if (typeof window === "undefined" || !Array.isArray(window.dataLayer)) return;
  gaReady = true;
  for (const [name, parameters] of pending.splice(0)) send(name, parameters);
}

/** Consent withdrawn: forget anything held and stop sending to GA. */
export function stopGaEvents() {
  gaReady = false;
  pending.length = 0;
}
