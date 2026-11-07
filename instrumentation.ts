import type { Instrumentation } from "next";

/**
 * Server errors (Server Components, Route Handlers, Server Actions) go to
 * PostHog Error Tracking. lib/posthog/server.ts decides whether to send and
 * strips anything sensitive; it is imported only when an error happens, and
 * only in the Node.js runtime.
 *
 * Errors raised in proxy.ts or in after() callbacks do not reach this hook.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { captureServerException } = await import("./lib/posthog/server");
    await captureServerException(error, {
      path: request.path,
      method: request.method,
      routerKind: context.routerKind,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
    });
  } catch {
    // Reporting must never turn one error into two.
  }
};
