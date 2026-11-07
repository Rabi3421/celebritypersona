/**
 * PostHog in the browser: product analytics and error tracking only.
 *
 * Nothing loads without consent. `startPostHog()` (called from
 * instrumentation-client.ts) subscribes to the consent manager (lib/consent.ts)
 * and downloads posthog-js only once the reader has accepted analytics — on
 * this visit or an earlier one — and then only after the window `load` event
 * and an idle moment, so the library never competes with the hero image.
 *
 * Its queue is its own, separate from GA's in lib/analytics.ts, and it only
 * ever holds events raised after acceptance: nothing from before consent is
 * replayed. Withdrawing consent opts PostHog out, switches it to no persistence
 * (which deletes what it stored) and drops anything still queued.
 *
 * Enabled only for a Production deployment (VERCEL_ENV, inlined at build by
 * next.config.ts) that has a project key, or for an explicit local test build.
 */

import type { PostHog, CaptureResult } from "posthog-js";
import { clearAnalyticsStorage, readConsent, subscribeConsent } from "@/lib/consent";
import { DEPLOY_ENV, POSTHOG_ENABLED, POSTHOG_KEY, POSTHOG_LOCAL_TEST } from "./client-env";
import { isExcludedPath, isExtensionNoise, pathOf, sanitizeProperties } from "./privacy";

export { POSTHOG_ENABLED };

/** Events sent to GA only. A product click is one PostHog `affiliate_click`
 *  carrying `original_or_swap`; the paired GA event would count it twice. */
const GA_ONLY = new Set(["original_product_click", "swap_click"]);

type Queued =
  | { kind: "event"; name: string; properties: Record<string, unknown>; at: number }
  | { kind: "exception"; error: unknown; properties: Record<string, unknown>; at: number };

/**
 *   disabled   not this deployment, or a panel page: never loads
 *   idle       waiting for consent
 *   waiting    consent given; loading after `load` and idle
 *   ready      initialised and sending
 *   suspended  initialised, then consent withdrawn: sends nothing, stores nothing
 */
let state: "disabled" | "idle" | "waiting" | "ready" | "suspended" = POSTHOG_ENABLED ? "idle" : "disabled";
let instance: PostHog | null = null;
let started = false;

/** Capped: if loading fails or never happens, the queue must not grow. */
const MAX_QUEUED = 50;
const queue: Queued[] = [];

const consented = () => readConsent() === "accepted";

/** Drops anything without consent or on an excluded path; strips sensitive URL parts and emails. */
function beforeSend(event: CaptureResult | null): CaptureResult | null {
  if (!event || !consented()) return null;
  const properties = event.properties ?? {};
  const where = pathOf(String(properties.$current_url ?? "")) || window.location.pathname;
  if (isExcludedPath(where) || isExcludedPath(window.location.pathname)) return null;
  if (event.event === "$exception" && isExtensionNoise(properties)) return null;
  return {
    ...event,
    properties: sanitizeProperties(properties),
    ...(event.$set ? { $set: sanitizeProperties(event.$set) } : {}),
    ...(event.$set_once ? { $set_once: sanitizeProperties(event.$set_once) } : {}),
  };
}

function send(posthog: PostHog, item: Queued) {
  try {
    if (item.kind === "event") posthog.capture(item.name, item.properties, { timestamp: new Date(item.at) });
    else posthog.captureException(item.error, item.properties);
  } catch {
    // Analytics is optional; it must never interrupt the page.
  }
}

function whenLoadedAndIdle(run: () => void) {
  // Safari has no requestIdleCallback; a short delay serves the same purpose.
  const idle = () =>
    typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(run, { timeout: 4000 })
      : window.setTimeout(run, 1500);
  if (document.readyState === "complete") idle();
  else window.addEventListener("load", idle, { once: true });
}

function load() {
  // Consent may have been withdrawn while we waited for `load` or idle.
  if (state !== "waiting") return;
  if (!consented()) {
    state = "idle";
    return;
  }
  import("posthog-js")
    .then(({ default: posthog }) => {
      if (state !== "waiting" || !consented()) {
        state = state === "waiting" ? "idle" : state;
        return;
      }
      posthog.init(POSTHOG_KEY, {
        api_host: "/ingest",
        ui_host: "https://us.posthog.com",
        defaults: "2026-08-30",
        // Anonymous, personless events only; no cookies.
        person_profiles: "never",
        persistence: "localStorage",
        // Pageviews on load and on every client navigation, exactly once each.
        capture_pageview: "history_change",
        capture_pageleave: true,
        // Only the named events in lib/analytics.ts; nothing inferred from clicks.
        autocapture: false,
        rageclick: false,
        capture_dead_clicks: false,
        capture_heatmaps: false,
        capture_performance: false,
        capture_exceptions: true,
        // Off: replay, surveys, tours, experiments, feature flags.
        disable_session_recording: true,
        disable_surveys: true,
        disable_product_tours: true,
        disable_web_experiments: true,
        advanced_disable_flags: true,
        // Campaign click IDs (gclid, fbclid…) masked; sensitive params stripped in beforeSend.
        mask_personal_data_properties: true,
        before_send: beforeSend,
        // Local test builds send uncompressed so payloads can be inspected.
        disable_compression: POSTHOG_LOCAL_TEST,
        loaded: (ph) => {
          ph.register({ cp_env: POSTHOG_LOCAL_TEST ? "local-test" : DEPLOY_ENV, ...(POSTHOG_LOCAL_TEST ? { cp_test: true } : {}) });
        },
      });
      instance = posthog;
      state = "ready";
      for (const item of queue.splice(0)) send(posthog, item);
    })
    .catch(() => {
      state = "idle";
      queue.length = 0;
    });
}

/** Brings PostHog in line with the current consent. */
function sync() {
  if (state === "disabled") return;
  if (consented()) {
    if (state === "idle") {
      state = "waiting";
      whenLoadedAndIdle(load);
    } else if (state === "suspended" && instance) {
      try {
        instance.set_config({ disable_persistence: false });
        instance.opt_in_capturing({ captureEventName: false });
      } catch {
        // Keep going: beforeSend still follows consent.
      }
      state = "ready";
    }
    return;
  }
  // Undecided or rejected: send nothing, keep nothing.
  queue.length = 0;
  if (state === "waiting") state = "idle";
  if (state === "ready" && instance) {
    try {
      instance.opt_out_capturing();
      // Stops PostHog writing to the browser and deletes what it stored.
      instance.set_config({ disable_persistence: true });
    } catch {
      // beforeSend refuses every event without consent regardless.
    }
    state = "suspended";
    // opt_out_capturing() records its own opt-out flag in localStorage; the
    // consent record already remembers the "no", so remove that too.
    clearAnalyticsStorage();
  }
}

/** Called once, from instrumentation-client.ts. */
export function startPostHog() {
  if (started || typeof window === "undefined") return;
  started = true;
  // A page load inside the panel never starts PostHog at all.
  if (state === "disabled" || isExcludedPath(window.location.pathname)) {
    state = "disabled";
    return;
  }
  subscribeConsent(sync);
  sync();
}

function capture(item: Queued) {
  if (state === "disabled" || state === "suspended" || !consented()) return;
  if (state === "ready" && instance) send(instance, item);
  else if (queue.length < MAX_QUEUED) queue.push(item);
}

/** A named product event (from lib/analytics.ts). */
export function capturePostHogEvent(name: string, properties: Record<string, string | number | boolean>) {
  if (GA_ONLY.has(name)) return;
  capture({ kind: "event", name, properties, at: Date.now() });
}

/** An error caught by an error boundary (app/error.tsx, app/global-error.tsx). */
export function capturePostHogException(error: unknown, properties: Record<string, string | undefined> = {}) {
  const clean = Object.fromEntries(Object.entries(properties).filter(([, v]) => v !== undefined));
  capture({ kind: "exception", error, properties: clean, at: Date.now() });
}
