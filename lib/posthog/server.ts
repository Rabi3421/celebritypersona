import "server-only";
import { isExcludedPath, isPostHogEnabled, localTestFlag, pathOf, redactServerText, sanitizeProperties } from "./privacy";

/**
 * Server errors to PostHog Error Tracking (called from instrumentation.ts).
 *
 * Operational reports, sent whatever the reader chose about analytics, so they
 * must hold nothing about the reader: no identifier (each report gets a random
 * one), no headers (they carry the admin session cookie), no body, no IP, no
 * query string. The path is sent without its query. Every string in the final
 * event — the error message, the stack, every property — passes through
 * `before_send` in server mode, which strips credentials in URIs, bearer
 * tokens, JWTs, secret-looking assignments, email addresses, and every query
 * string and fragment.
 *
 * Same gate as the browser: a Production deployment with a project key, or an
 * explicit local test (never honoured on Vercel). Requests go straight to
 * PostHog's ingestion host; the /ingest proxy exists for browsers. A client is
 * created per error and shut down before returning, because a serverless
 * function may be frozen as soon as the response is done.
 */

const INGEST_HOST = "https://us.i.posthog.com";

const localTest = () => localTestFlag(process.env.CP_POSTHOG_LOCAL_TEST, process.env.VERCEL) === "1";

export function serverCaptureEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isPostHogEnabled(env.NEXT_PUBLIC_POSTHOG_KEY, env.VERCEL_ENV, localTestFlag(env.CP_POSTHOG_LOCAL_TEST, env.VERCEL));
}

export type ServerErrorContext = {
  path: string;
  method: string;
  routerKind?: string;
  routePath?: string;
  routeType?: string;
  renderSource?: string;
};

/** A copy of the error whose message and stack are already redacted (belt and braces with before_send). */
function redactedError(error: unknown): Error {
  if (error instanceof Error) {
    const copy = new Error(redactServerText(error.message));
    copy.name = error.name;
    copy.stack = error.stack ? redactServerText(error.stack) : undefined;
    return copy;
  }
  return new Error(redactServerText(typeof error === "string" ? error : "Non-Error value thrown"));
}

export async function captureServerException(error: unknown, context: ServerErrorContext): Promise<void> {
  if (!serverCaptureEnabled() || isExcludedPath(pathOf(context.path))) return;
  const test = localTest();
  const { PostHog } = await import("posthog-node");
  const client = new PostHog((process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "").trim(), {
    host: INGEST_HOST,
    flushAt: 1,
    flushInterval: 0,
    // The final event, after posthog-node has built it from the error.
    before_send: (event) => (event ? { ...event, properties: sanitizeProperties(event.properties ?? {}, "", "server") } : event),
    // Local test builds only: send uncompressed and print exactly what leaves
    // the server, so the test can check it. Never active on Vercel.
    ...(test
      ? {
          disableCompression: true,
          fetch: async (url: string, options: Parameters<typeof fetch>[1] & { body?: unknown }) => {
            console.log(`[cp-posthog-sent] ${typeof options?.body === "string" ? options.body : "(binary)"}`);
            return fetch(url, options as RequestInit) as never;
          },
        }
      : {}),
  });
  const digest =
    typeof error === "object" && error !== null && "digest" in error ? String((error as { digest: unknown }).digest) : undefined;
  try {
    client.captureException(redactedError(error), undefined, {
      $process_person_profile: false,
      source: "server",
      path: pathOf(context.path),
      method: context.method,
      router_kind: context.routerKind,
      route_path: context.routePath,
      route_type: context.routeType,
      render_source: context.renderSource,
      digest,
      cp_env: test ? "local-test" : (process.env.VERCEL_ENV ?? "local"),
      ...(test ? { cp_test: true } : {}),
    });
  } finally {
    await client.shutdown();
  }
}
