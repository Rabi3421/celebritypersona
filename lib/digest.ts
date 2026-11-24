import { outfitSlug } from "@/lib/slugs";
import { isPublished, outfitPhoto, pricing, type MailJob, type Outfit } from "@/lib/types";

/**
 * The weekly digest: every look published in the last 7 days, in one mail.
 * Pure, for tests. Sending is still a deliberate act on the Broadcasts page.
 */

/** At most this many looks in one mail; a longer list is a catalogue, not a digest. */
export const DIGEST_MAX_LOOKS = 8;

/** The ISO week a date falls in, e.g. "2026-W48". One digest per week. */
export function digestWeek(now: Date): string {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((day.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** The look as a mail shows it, frozen at queue time (the same shape an announcement uses). */
export function mailLook(outfit: Outfit, siteUrl: string): MailJob["look"] {
  const money = pricing(outfit);
  const slug = outfitSlug(outfit);
  return {
    celebrity: outfit.celebrity,
    event: outfit.event,
    slug,
    url: `${siteUrl}/outfits/${slug}`,
    image: outfitPhoto(outfit)?.url,
    pieces: money.pieces,
    worn: money.anyPriced ? money.wornTotal : undefined,
  };
}

/** Live looks published in the 7 days up to `now`, newest first. */
export function digestLooks(outfits: Outfit[], now: Date): Outfit[] {
  const from = new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  return outfits
    .filter((outfit) => isPublished(outfit) && outfit.publishedAt && outfit.publishedAt.slice(0, 10) >= from && outfit.publishedAt.slice(0, 10) <= to)
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") || b.id - a.id)
    .slice(0, DIGEST_MAX_LOOKS);
}

export const digestSubject = (count: number) => (count === 1 ? "This week's look, decoded" : `This week's ${count} looks, decoded`);
