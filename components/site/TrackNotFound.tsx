"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

/**
 * Records that a reader landed on a page this site does not serve, so the
 * daily report can name the missing addresses: an old Pinterest pin, a
 * renamed look, a mistyped link from another site. Path only, never the
 * query string; and like every event, only after the reader accepted analytics.
 */
export function TrackNotFound() {
  useEffect(() => {
    trackEvent("page_not_found", { path: window.location.pathname.slice(0, 120) });
  }, []);
  return null;
}
