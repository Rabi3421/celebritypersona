/**
 * PostHog in the browser: product analytics and error tracking only.
 *
 * Loaded the way GA is (components/site/Analytics.tsx): nothing on the
 * critical path. `startPostHog()` (called from instrumentation-client.ts) waits
 * for the window `load` event and then for an idle moment before it even
 * downloads posthog-js, so the library never competes with the hero image.
 *
 * Its queue is its own. lib/analytics.ts hands every event to both GA and
 * PostHog; each holds what arrives before it is ready, so neither one's
 * loading, blocking or absence can delay or drop the other's events.
 *
 * Enabled only for a Production deployment (VERCEL_ENV, inlined at build by
 * next.config.ts) that has a project key, or for an explicit local test build.
 * Preview deployments and `next dev` ship no PostHog code path that runs.
 */

import type { PostHog, CaptureResult } from "posthog-js";
import { isExcludedPath, isExtensionNoise, isPostHogEnabled, pathOf, sanitizeProperties } from "./privacy";

const KEY = (process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "").trim();
const DEPLOY_ENV = process.env.CP_DEPLOY_ENV || "local";
const LOCAL_TEST = process.env.CP_POSTHOG_LOCAL_TEST === "1";

export const POSTHOG_ENABLED = isPostHogEnabled(KEY, DEPLOY_ENV, process.env.CP_POSTHOG_LOCAL_TEST);

/** Events sent to GA only. A product click is one PostHog `affiliate_click`
 *  carrying `original_or_swap`; the paired GA event would count it twice. */
const GA_ONLY = new Set(["original_product_click", "swap_click"]);

type Queued =
  | { kind: "event"; name: string; properties: Record<string, unknown>; at: number }
  | { kind: "exception"; error: unknown; properties: Record<string, unknown>; at: number };

/** Capped: if loading fails or never happens, the queue must not grow. */
const MAX_QUEUED = 50;
const queue: Queued[] = [];
let state: "idle" | "waiting" | "ready" | "off" = POSTHOG_ENABLED ? "idle" : "off";
let instance: PostHog | null = null;

function enqueue(item: Queued) {
  if (state === "off") return;
  if (queue.length < MAX_QUEUED) queue.push(item);
}

/** Drops anything on an excluded path; strips sensitive URL parts and emails. */
function beforeSend(event: CaptureResult | null): CaptureResult | null {
  if (!event) return null;
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

function flush() {
  if (!instance) return;
  for (const item of queue.splice(0)) send(instance, item);
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

/** Called once, from instrumentation-client.ts. */
export function startPostHog() {
  if (state !== "idle" || typeof window === "undefined") return;
  // A page load inside the panel never starts PostHog at all.
  if (isExcludedPath(window.location.pathname)) {
    state = "off";
    queue.length = 0;
    return;
  }
  state = "waiting";
  whenLoadedAndIdle(() => {
    import("posthog-js")
      .then(({ default: posthog }) => {
        posthog.init(KEY, {
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
          disable_compression: LOCAL_TEST,
          loaded: (ph) => {
            ph.register({ cp_env: LOCAL_TEST ? "local-test" : DEPLOY_ENV, ...(LOCAL_TEST ? { cp_test: true } : {}) });
          },
        });
        instance = posthog;
        state = "ready";
        flush();
      })
      .catch(() => {
        state = "off";
        queue.length = 0;
      });
  });
}

/** A named product event (from lib/analytics.ts). */
export function capturePostHogEvent(name: string, properties: Record<string, string | number | boolean>) {
  if (state === "off" || GA_ONLY.has(name)) return;
  const item: Queued = { kind: "event", name, properties, at: Date.now() };
  if (state === "ready" && instance) send(instance, item);
  else enqueue(item);
}

/** An error caught by an error boundary (app/error.tsx, app/global-error.tsx). */
export function capturePostHogException(error: unknown, properties: Record<string, string | undefined> = {}) {
  if (state === "off") return;
  const clean = Object.fromEntries(Object.entries(properties).filter(([, v]) => v !== undefined));
  const item: Queued = { kind: "exception", error, properties: clean, at: Date.now() };
  if (state === "ready" && instance) send(instance, item);
  else enqueue(item);
}
