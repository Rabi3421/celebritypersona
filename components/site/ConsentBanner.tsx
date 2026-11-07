"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  ANALYTICS_AVAILABLE,
  OPEN_CONSENT_EVENT,
  readConsent,
  setConsent,
  subscribeConsent,
  type ConsentChoice,
  type ConsentState,
} from "@/lib/consent";

/** Nothing on the server or during hydration: the answer lives in the browser,
 *  and a reader who already chose must never see the banner flash. */
const unknownOnServer = (): ConsentState | "unknown" => "unknown";

/**
 * Asks once, and again whenever the reader opens "Analytics choices" in the
 * footer. Not modal: the page stays usable, and nothing is loaded or sent until
 * a choice is made. Accept and Reject look identical, side by side.
 *
 * Never shown in the panel, or on deployments with no analytics configured
 * (previews, local builds), where there is nothing to consent to.
 */
export function ConsentBanner() {
  const pathname = usePathname();
  const consent = useSyncExternalStore<ConsentState | "unknown">(subscribeConsent, readConsent, unknownOnServer);
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(OPEN_CONSENT_EVENT, open);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, open);
  }, []);

  if (!ANALYTICS_AVAILABLE || consent === "unknown" || pathname.startsWith("/admin")) return null;
  if (consent !== "undecided" && !reopened) return null;

  const choose = (choice: ConsentChoice) => {
    setConsent(choice);
    setReopened(false);
  };

  return (
    <section className="consent" role="region" aria-label="Analytics choices">
      <p>
        <b>Can we count your visit?</b> If you accept, we use Google Analytics and PostHog to see which
        looks and pages people use and to catch errors on the site. Nothing is loaded until you choose, and
        you can change your mind any time from the footer. <Link href="/privacy">Privacy</Link> ·{" "}
        <Link href="/cookies">Cookies</Link>
      </p>
      {reopened && consent !== "undecided" ? (
        <p className="consent-now">Analytics is currently {consent === "accepted" ? "on" : "off"}.</p>
      ) : null}
      {/* The same class for both: equal size, colour and weight, so neither
          answer is nudged. */}
      <div className="consent-actions">
        <button type="button" className="btn consent-choice" onClick={() => choose("rejected")}>
          <span>Reject analytics</span>
        </button>
        <button type="button" className="btn consent-choice" onClick={() => choose("accepted")}>
          <span>Accept analytics</span>
        </button>
        {reopened ? (
          <button type="button" className="consent-close" aria-label="Close analytics choices" onClick={() => setReopened(false)}>
            ×
          </button>
        ) : null}
      </div>
    </section>
  );
}

/** "Analytics choices" in the footer: reopens the banner to change or withdraw consent. */
export function AnalyticsChoicesButton() {
  const pathname = usePathname();
  if (!ANALYTICS_AVAILABLE || pathname.startsWith("/admin")) return null;
  return (
    <button
      type="button"
      className="fchoices"
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
    >
      Analytics choices
    </button>
  );
}
