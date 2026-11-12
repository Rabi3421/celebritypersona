import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The bearer check for /api/internal/report/*.
 *
 * Fails closed: with no REPORT_API_TOKEN, or one shorter than 32 characters,
 * nothing is authorised (unlike a missing CRON_SECRET, which leaves the mail
 * cron open). Both sides are hashed so the comparison is constant-time and
 * does not reveal the token's length.
 */
export const MIN_TOKEN_LENGTH = 32;

const digest = (value: string) => createHash("sha256").update(value).digest();

export function reportTokenValid(authorization: string | null, configured: string | undefined): boolean {
  // Trimmed: a value pasted into a dashboard can carry a trailing newline.
  const expected = (configured ?? "").trim();
  if (expected.length < MIN_TOKEN_LENGTH) return false;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization ?? "");
  if (!match) return false;
  return timingSafeEqual(digest(match[1]), digest(expected));
}
