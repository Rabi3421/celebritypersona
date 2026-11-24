import type { LookJob } from "@/lib/look-jobs";

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
