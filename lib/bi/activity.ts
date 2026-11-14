/**
 * Recent activity, read back from what records already store. There is no
 * audit log, so this is not one: it lists only events whose date is a stored
 * field, says when that date is a day rather than a time, and shows counts
 * (never addresses or identifiers) for subscribers and clicks.
 */

import { istDay } from "@/lib/bi/period";
import { outfitSlug } from "@/lib/slugs";
import { pieceLink, type MailJob, type Outfit, type Subscriber } from "@/lib/types";

export type ActivityItem = {
  /** YYYY-MM-DD, or a full ISO timestamp when the record holds one. */
  at: string;
  day: string;
  kind: "published" | "saved" | "links" | "mail" | "subscribers" | "clicks";
  text: string;
  href?: string;
};

export const ACTIVITY_LIMIT = 12;
const dayOf = (value: string) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : Number.isNaN(Date.parse(value)) ? "" : istDay(Date.parse(value)));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function recentActivity(input: {
  outfits: Outfit[];
  mailJobs: Pick<MailJob, "createdAt" | "status" | "subject" | "sent" | "finishedAt">[];
  subscribers: Pick<Subscriber, "joinedAt">[];
  clickDays: { day: string; total: number }[];
}): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const outfit of input.outfits) {
    const name = `${outfit.celebrity} · ${outfit.event}`;
    if (outfit.publishedAt) items.push({ at: outfit.publishedAt, day: dayOf(outfit.publishedAt), kind: "published", text: `Published ${name}`, href: `/outfits/${outfitSlug(outfit)}` });
    if (outfit.pricesCheckedAt) items.push({ at: outfit.pricesCheckedAt, day: dayOf(outfit.pricesCheckedAt), kind: "saved", text: `Saved ${name}`, href: `/admin/outfits/${outfit.id}` });
  }

  // Link checks: one line per day, not one per link.
  const checks = new Map<string, number>();
  for (const outfit of input.outfits)
    for (const item of outfit.items)
      for (const link of [pieceLink(item, "original"), pieceLink(item, "swap")])
        if (link?.checkedAt) {
          const day = dayOf(link.checkedAt);
          if (day) checks.set(day, (checks.get(day) ?? 0) + 1);
        }
  for (const [day, n] of checks) items.push({ at: day, day, kind: "links", text: `${plural(n, "shop link")} checked` });

  for (const job of input.mailJobs) {
    const at = job.finishedAt || job.createdAt;
    const what = job.status === "Sent" ? `Announcement sent to ${plural(job.sent, "subscriber")}` : `Announcement ${String(job.status).toLowerCase()}`;
    items.push({ at, day: dayOf(at), kind: "mail", text: `${what}: “${job.subject}”`, href: "/admin/broadcasts" });
  }

  const joins = new Map<string, number>();
  for (const sub of input.subscribers) {
    const day = dayOf(sub.joinedAt);
    if (day) joins.set(day, (joins.get(day) ?? 0) + 1);
  }
  for (const [day, n] of joins) items.push({ at: day, day, kind: "subscribers", text: `${plural(n, "new subscriber")}`, href: "/admin/subscribers" });

  for (const { day, total } of input.clickDays) if (total > 0) items.push({ at: day, day, kind: "clicks", text: `${plural(total, "production shop click")}` });

  return items
    .filter((i) => i.day)
    .sort((a, b) => b.day.localeCompare(a.day) || b.at.localeCompare(a.at))
    .slice(0, ACTIVITY_LIMIT);
}
