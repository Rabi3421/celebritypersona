"use client";

import { usePathname } from "next/navigation";
import { GoogleAnalytics } from "@next/third-parties/google";

/**
 * Google Analytics, everywhere except the panel.
 *
 * The tag is Next's own component rather than a pasted snippet: it loads
 * gtag.js after hydration so it stays off the critical path, and it reports
 * the client-side navigations a raw snippet misses — which on this site is
 * most of them, since every link is a client transition.
 *
 * The admin is excluded at the source. It is one person's working session,
 * repeated all day, against pages that are noindex and have no readers; left
 * in, it is indistinguishable from traffic in every report that matters.
 * Loading /admin directly loads no tag at all. Reaching it from a public page
 * leaves gtag already loaded, so exclude the admin's own IP in GA4 as well if
 * you want that last case covered.
 */
export function Analytics({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return <GoogleAnalytics gaId={gaId} />;
}
