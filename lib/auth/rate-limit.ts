import "server-only";

/**
 * Throttles repeated attempts per IP: sign-ins, and the public report form.
 *
 * In-memory on purpose: this guards a single-operator login and a low-traffic
 * form, so the complexity of a shared store is not worth it. The trade-off is
 * that counters reset on redeploy and are per-instance. Move to Redis or a
 * Mongo collection if this ever runs on more than one instance.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export type RateLimitOptions = { windowMs?: number; max?: number };

type Bucket = { count: number; firstAt: number };

const globalForLimit = globalThis as typeof globalThis & {
  _adminLoginAttempts?: Map<string, Bucket>;
};

const attempts = (globalForLimit._adminLoginAttempts ??= new Map());

export type RateLimitResult = { ok: boolean; retryAfterMinutes: number };

export function checkRateLimit(
  key: string,
  { windowMs = WINDOW_MS, max = MAX_ATTEMPTS }: RateLimitOptions = {},
): RateLimitResult {
  const now = Date.now();
  const bucket = attempts.get(key);

  if (!bucket || now - bucket.firstAt > windowMs) {
    return { ok: true, retryAfterMinutes: 0 };
  }
  if (bucket.count < max) {
    return { ok: true, retryAfterMinutes: 0 };
  }
  return {
    ok: false,
    retryAfterMinutes: Math.ceil((windowMs - (now - bucket.firstAt)) / 60000),
  };
}

export function recordFailure(key: string, { windowMs = WINDOW_MS }: RateLimitOptions = {}) {
  const now = Date.now();
  const bucket = attempts.get(key);
  if (!bucket || now - bucket.firstAt > windowMs) {
    attempts.set(key, { count: 1, firstAt: now });
    return;
  }
  bucket.count += 1;
}

/** The caller's IP, as far as the platform will say. Falls back to a single
 *  shared bucket rather than letting an unknown client bypass the limit. */
export async function clientKey(headerList: Headers) {
  return (
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerList.get("x-real-ip") ||
    "unknown"
  );
}

export function clearAttempts(key: string) {
  attempts.delete(key);
}
