"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";

/**
 * "Has the page finished loading", as a store React can read.
 *
 * `useSyncExternalStore` rather than an effect that sets state: the answer is
 * owned by the document, not by this component, and on a page that was already
 * complete before hydration the effect version would set state during the
 * first commit and render twice.
 *
 * The server snapshot is `false` unconditionally, which is the whole point —
 * it is what keeps the analytics tag, and the preload it drags with it, out of
 * the server-rendered HTML.
 */
function subscribeToLoad(onChange: () => void) {
  window.addEventListener("load", onChange, { once: true });
  return () => window.removeEventListener("load", onChange);
}

const loadedNow = () => document.readyState === "complete";
const loadedOnServer = () => false;

/**
 * Google Analytics, everywhere except the panel, and never during the paint.
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

  /**
   * Why this waits for the load event rather than rendering straight away.
   *
   * `<GoogleAnalytics>` executes gtag.js after hydration, but it still renders
   * on the server, and rendering it makes React emit
   * `<link rel="preload" href="…/gtag/js?id=…" as="script">` into the static
   * HTML. So the served page asked the browser to open a connection to
   * googletagmanager.com and fetch the tag during the LCP window — competing
   * with the hero image for the early connection budget — to satisfy a script
   * that would not run until long after. The preload was the whole cost of the
   * tag, paid at the worst possible moment, for no benefit.
   *
   * Mounting it only after the load event means nothing about analytics is in
   * the server HTML at all: no preload, no connection, no contention. The tag
   * then loads once the page is done, which is when it was going to run
   * anyway.
   *
   * The trade is that a visitor who leaves before `load` fires is not counted.
   * That is a real cost and it is the right one: those sessions are worth less
   * than the LCP of every session that stays.
   */
  const ready = useSyncExternalStore(subscribeToLoad, loadedNow, loadedOnServer);

  if (!ready) return null;
  if (pathname.startsWith("/admin")) return null;
  return <GoogleAnalytics gaId={gaId} />;
}
