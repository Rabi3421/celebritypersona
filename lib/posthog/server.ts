import "server-only";
import { isExcludedPath, isPostHogEnabled, pathOf, sanitizeProperties, sanitizeUrl } from "./privacy";

/**
 * Server errors to PostHog Error Tracking (called from instrumentation.ts).
 *
 * Same gate as the browser: a Production deployment with a project key, or an
 * explicit local test. Requests go straight to PostHog's ingestion host; the
 * /ingest proxy exists for browsers. A client is created per error and shut
 * down before returning, because a serverless function may be frozen as soon
 * as the response is done (PostHog's guidance: flushAt 1, flushInterval 0,
 * await shutdown).
 *
 * Nothing from the request is sent except its sanitized path and method: no
 * headers (they carry the admin session cookie), no body, no IP.
 */

const INGEST_HOST = "https://us.i.posthog.com";

export function serverCaptureEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isPostHogEnabled(env.NEXT_PUBLIC_POSTHOG_KEY, env.VERCEL_ENV, env.CP_POSTHOG_LOCAL_TEST);
}

export type ServerErrorContext = {
  path: string;
  method: string;
  routerKind?: string;
  routePath?: string;
  routeType?: string;
  renderSource?: string;
};

export async function captureServerException(error: unknown, context: ServerErrorContext): Promise<void> {
  if (!serverCaptureEnabled() || isExcludedPath(pathOf(context.path))) return;
  const { PostHog } = await import("posthog-node");
  const client = new PostHog((process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "").trim(), {
    host: INGEST_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
  const digest =
    typeof error === "object" && error !== null && "digest" in error ? String((error as { digest: unknown }).digest) : undefined;
  const localTest = process.env.CP_POSTHOG_LOCAL_TEST === "1";
  // Local test builds log each delivery, so the test can see it happened.
  if (localTest) client.debug(true);
  try {
    client.captureException(
      error,
      undefined,
      sanitizeProperties({
        $process_person_profile: false,
        source: "server",
        path: sanitizeUrl(context.path),
        method: context.method,
        router_kind: context.routerKind,
        route_path: context.routePath,
        route_type: context.routeType,
        render_source: context.renderSource,
        digest,
        cp_env: localTest ? "local-test" : (process.env.VERCEL_ENV ?? "local"),
        ...(localTest ? { cp_test: true } : {}),
      }),
    );
  } finally {
    await client.shutdown();
  }
}
