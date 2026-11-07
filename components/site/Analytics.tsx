"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";
import { flushPendingEvents, stopGaEvents } from "@/lib/analytics";
import { readConsent, subscribeConsent, type ConsentState } from "@/lib/consent";

/** gtag() as Google defines it: gtag.js reads `arguments` objects, not arrays. */
function gtag(...args: unknown[]) {
  void args;
  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

/** Whether this page has already told gtag a consent state. */
let consentSent = false;

/**
 * Google's basic Consent Mode: the tag is not loaded at all until the reader
 * accepts analytics, and when it is, it is told analytics storage is granted
 * and every advertising signal is denied (with ad identifiers redacted from
 * what it sends). Advertising consent is never asked for or granted here.
 */
function grantAnalyticsOnly(gaId: string) {
  (window as unknown as Record<string, boolean>)[`ga-disable-${gaId}`] = false;
  gtag("consent", consentSent ? "update" : "default", {
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
  gtag("set", "ads_data_redaction", true);
  // Google signals and ad personalisation are advertising features: off.
  // (gtag may still attempt a cookieless www.google.com/g/collect ping while
  // ad consent is denied; the site's CSP does not allow that host, so it is
  // blocked in the browser and never sent.)
  gtag("set", { allow_google_signals: false, allow_ad_personalization_signals: false });
  consentSent = true;
}

/** Consent withdrawn on this page: Google's documented opt-out switch, plus a denied update. */
function revokeAnalytics(gaId: string) {
  // Read the store itself: during hydration the component sees the server
  // snapshot ("undecided") for one render, and that is not a withdrawal.
  if (readConsent() === "accepted") return;
  stopGaEvents();
  if (!consentSent) return;
  (window as unknown as Record<string, boolean>)[`ga-disable-${gaId}`] = true;
  gtag("consent", "update", { analytics_storage: "denied" });
}

/** Runs in a layout effect, so the consent state reaches dataLayer before
 *  <GoogleAnalytics>'s own effects append gtag('js') and gtag('config'). */
function ConsentDefaults({ gaId }: { gaId: string }) {
  useLayoutEffect(() => grantAnalyticsOnly(gaId), [gaId]);
  return null;
}

const consentOnServer = (): ConsentState => "undecided";

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
 * gtag.js after hydration so it stays off the critical path. It does not
 * itself report client-side navigations — which on this site is most of them,
 * since every link is a client transition. Those page_views come from GA4's
 * Enhanced Measurement "Page changes based on browser history events"
 * setting, so that setting must stay on in the property.
 *
 * The admin is excluded at the source. It is one person's working session,
 * repeated all day, against pages that are noindex and have no readers; left
 * in, it is indistinguishable from traffic in every report that matters.
 * Loading /admin directly loads no tag at all. Reaching it from a public page
 * leaves gtag already loaded, so exclude the admin's own IP in GA4 as well if
 * you want that last case covered.
 *
 * Nothing loads without consent (lib/consent.ts). Accepting mounts the tag on
 * this page, with its page_view for the page the reader accepted on; a later
 * visit with consent already given mounts it after `load` as before.
 * Withdrawing stops it on this page and the consent manager deletes its cookies.
 */
export function Analytics({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  const consent = useSyncExternalStore(subscribeConsent, readConsent, consentOnServer);

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
  const active = ready && !pathname.startsWith("/admin") && consent === "accepted";

  /**
   * The view events of the landing page fired before `load` and are waiting
   * in lib/analytics.ts (only ever events raised after consent). Child effects
   * run first, so by now `<GoogleAnalytics>` has appended its inline init
   * script — which runs on insertion — and `gtag('config')` is already queued
   * ahead of them.
   */
  useEffect(() => {
    if (active) flushPendingEvents();
  }, [active]);

  useEffect(() => {
    if (consent !== "accepted") revokeAnalytics(gaId);
  }, [consent, gaId]);

  if (!active) return null;
  return (
    <>
      <ConsentDefaults gaId={gaId} />
      <GoogleAnalytics gaId={gaId} />
    </>
  );
}
