import type { ClickEnvironment } from "./types";

/**
 * Which deployment is recording an outbound click.
 *
 * Vercel sets VERCEL_ENV to "production", "preview" or "development" on every
 * build and function. Anywhere else (`next dev`, a local `next start`) it is
 * unset, which is "local". Anything unexpected is also "local", so a click can
 * only ever be counted as production when Vercel itself says so.
 *
 * No imports beyond a type, so the tests can load it directly.
 */
export function clickEnvironment(vercelEnv: string | undefined = process.env.VERCEL_ENV): ClickEnvironment {
  return vercelEnv === "production" || vercelEnv === "preview" || vercelEnv === "development" ? vercelEnv : "local";
}
