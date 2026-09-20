"use client";

import { sendGAEvent } from "@next/third-parties/google";

export type AnalyticsValue = string | number | boolean | undefined;

/** Sends only when GA is configured on this page. */
export function trackEvent(name: string, parameters: Record<string, AnalyticsValue> = {}) {
  if (typeof window === "undefined" || !Array.isArray(window.dataLayer)) return;
  const clean = Object.fromEntries(
    Object.entries(parameters).filter((entry): entry is [string, string | number | boolean] =>
      entry[1] !== undefined,
    ),
  );
  try {
    sendGAEvent("event", name, clean);
  } catch {
    // Analytics is optional. A blocked or incomplete tag must never interrupt
    // rendering, saving, sharing, form success, or an outbound retailer click.
  }
}
