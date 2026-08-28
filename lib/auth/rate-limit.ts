import "server-only";

/**
 * Throttles sign-in attempts per IP.
 *
 * In-memory on purpose: this guards a single-operator login, so the complexity
 * of a shared store is not worth it. The trade-off is that counters reset on
 * redeploy and are per-instance. Move to Redis or a Mongo collection if the
 * panel ever runs on more than one instance.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Bucket = { count: number; firstAt: number };

const globalForLimit = globalThis as typeof globalThis & {
  _adminLoginAttempts?: Map<string, Bucket>;
};

const attempts = (globalForLimit._adminLoginAttempts ??= new Map());

export type RateLimitResult = { ok: boolean; retryAfterMinutes: number };

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const bucket = attempts.get(key);

  if (!bucket || now - bucket.firstAt > WINDOW_MS) {
    return { ok: true, retryAfterMinutes: 0 };
  }
  if (bucket.count < MAX_ATTEMPTS) {
    return { ok: true, retryAfterMinutes: 0 };
  }
  return {
    ok: false,
    retryAfterMinutes: Math.ceil((WINDOW_MS - (now - bucket.firstAt)) / 60000),
  };
}

export function recordFailure(key: string) {
  const now = Date.now();
  const bucket = attempts.get(key);
  if (!bucket || now - bucket.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
    return;
  }
  bucket.count += 1;
}

export function clearAttempts(key: string) {
  attempts.delete(key);
}
