import type { LookJob } from "@/lib/look-jobs";
import { shareVersion } from "@/lib/share-text";
import { outfitSlug } from "@/lib/slugs";
import { isPublished, type Outfit } from "@/lib/types";

/**
 * What the monitoring Worker needs to post "draft ready" and "backup missed"
 * alerts to Slack: finished research jobs, and when the newest backup was
 * stored. Counts and names only; never research text, never a storage link.
 */

/** How far back finished jobs are reported. The Worker remembers what it already posted. */
export const EVENTS_WINDOW_HOURS = 72;

export type SiteEvents = {
  version: 1;
  generatedAt: string;
  lookJobs: {
    id: string;
    status: "drafted" | "failed";
    finishedAt: string;
    instagramUrl: string;
    outfitId: number | null;
    celebrity: string | null;
    event: string | null;
    checks: number;
    by: string[];
    error: string | null;
  }[];
  /** The scout's suggestions from the last 72 hours, still waiting or already decided. */
  suggestions?: { id: string; batch: string; celebrity: string; event: string; why: string; score: number; status: string }[];
  /** Looks published in the window, with what a Pinterest pin needs. */
  published?: { id: number; celebrity: string; event: string; publishedAt: string; url: string; pinImage: string; pinDescription: string }[];
  /** The newest weekly link check in the window: what changed, for a Slack to-do. */
  linkCheck?: {
    id: string;
    runAt: string;
    checked: number;
    skipped: number;
    changes: { outfitId: number; celebrity: string; event: string; piece: string; side: "original" | "swap"; from: string; to: string; reason: string }[];
  } | null;
  /** `latestAt` null means no backup exists at all; `error` means the store could not be read. */
  backup: { latestAt: string | null; count: number } | { error: string };
};

type OutfitName = { id: number; celebrity: string; event: string };

export function summariseLookJobs(jobs: LookJob[], outfits: OutfitName[]): SiteEvents["lookJobs"] {
  return jobs
    .filter((job): job is LookJob & { status: "drafted" | "failed"; finishedAt: string } =>
      (job.status === "drafted" || job.status === "failed") && Boolean(job.finishedAt),
    )
    .map((job) => {
      const outfit = job.outfitId ? outfits.find((item) => item.id === job.outfitId) : undefined;
      return {
        id: job.id,
        status: job.status,
        finishedAt: job.finishedAt,
        instagramUrl: job.instagramUrl,
        outfitId: job.outfitId ?? null,
        celebrity: outfit?.celebrity ?? null,
        event: outfit?.event ?? null,
        checks: job.findings?.checks.length ?? 0,
        by: job.findings?.by ?? [],
        error: job.status === "failed" ? (job.error ?? "No reason recorded.").slice(0, 300) : null,
      };
    });
}

export function latestBackup(blobs: { pathname: string; uploadedAt: Date | string }[]): { latestAt: string | null; count: number } {
  const times = blobs
    .filter((blob) => blob.pathname.endsWith(".gpg"))
    .map((blob) => new Date(blob.uploadedAt).getTime())
    .filter(Number.isFinite);
  return { latestAt: times.length ? new Date(Math.max(...times)).toISOString() : null, count: times.length };
}

/**
 * Looks published since `since`: the Slack "published" post carries the page,
 * its 1000×1500 pin image and a description, so pinning it is one tap.
 */
export function summarisePublished(
  outfits: (Pick<Outfit, "id" | "celebrity" | "event" | "date" | "items"> & Partial<Outfit>)[],
  since: Date,
  site: string,
): NonNullable<SiteEvents["published"]> {
  const base = site.replace(/\/+$/, "");
  return outfits
    .filter((outfit) => isPublished(outfit as Outfit) && outfit.publishedAt && Date.parse(outfit.publishedAt) >= since.getTime())
    .map((outfit) => {
      const path = `/outfits/${outfitSlug(outfit)}`;
      return {
        id: outfit.id,
        celebrity: outfit.celebrity,
        event: outfit.event,
        publishedAt: outfit.publishedAt!,
        url: `${base}${path}`,
        pinImage: `${base}${path}/pin.png?v=${shareVersion(outfit)}`,
        pinDescription: (outfit.seoDescription || `${outfit.celebrity}'s ${outfit.event} outfit, decoded: every piece, the price and a cheaper swap.`).slice(0, 480),
      };
    })
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
}
