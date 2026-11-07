import { startPostHog } from "@/lib/posthog/client";

/**
 * Runs before the app is interactive, so it only schedules work: PostHog is
 * downloaded and started after the window `load` event and an idle moment
 * (see lib/posthog/client.ts). On preview deployments, `next dev`, and any
 * /admin page load it does nothing at all.
 */
try {
  startPostHog();
} catch {
  // Analytics must never stop the app from starting.
}
