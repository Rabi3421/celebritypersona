import { isPostHogEnabled } from "./privacy";

/**
 * Build-time facts about PostHog in the browser, in their own module so the
 * consent manager (lib/consent.ts) and the PostHog client can both read them
 * without importing each other.
 */
export const POSTHOG_KEY = (process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "").trim();
export const DEPLOY_ENV = process.env.CP_DEPLOY_ENV || "local";
export const POSTHOG_LOCAL_TEST = process.env.CP_POSTHOG_LOCAL_TEST === "1";
export const POSTHOG_ENABLED = isPostHogEnabled(POSTHOG_KEY, DEPLOY_ENV, process.env.CP_POSTHOG_LOCAL_TEST);
