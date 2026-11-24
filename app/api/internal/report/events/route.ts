import { NextResponse } from "next/server";
import { list } from "@vercel/blob";
import { PREFIX } from "@/lib/backup/core";
import { getAllOutfits } from "@/lib/db/content";
import { finishedLookJobs } from "@/lib/db/look-jobs";
import { latestLinkCheck } from "@/lib/db/link-checks";
import { suggestionsSince } from "@/lib/db/look-suggestions";
import { reportTokenValid } from "@/lib/report/report-auth";
import { EVENTS_WINDOW_HOURS, latestBackup, summariseLookJobs, type SiteEvents } from "@/lib/report/site-events";

/**
 * Events for the monitoring Worker's Slack alerts.
 *
 *   GET /api/internal/report/events
 *   Authorization: Bearer <REPORT_API_TOKEN>
 *
 * Read only: research jobs that finished in the last 72 hours (so Slack can
 * say a draft is ready to review, or that research failed) and when the
 * newest nightly backup was stored (so Slack can say one was missed).
 *
 * Without a valid token, or when REPORT_API_TOKEN is not set (previews and
 * local builds), the answer is the same plain 404 as any unknown path.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" };

async function backupState(): Promise<SiteEvents["backup"]> {
  if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) return { error: "no Blob store connected" };
  try {
    const blobs = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
      blobs.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return latestBackup(blobs);
  } catch (error) {
    console.error("Backup listing failed", error instanceof Error ? error.name : "Unknown");
    return { error: "backup store could not be read" };
  }
}

export async function GET(request: Request) {
  if (!reportTokenValid(request.headers.get("authorization"), process.env.REPORT_API_TOKEN)) {
    return new NextResponse("Not found", { status: 404, headers: HEADERS });
  }
  try {
    const since = new Date(Date.now() - EVENTS_WINDOW_HOURS * 3_600_000);
    const [jobs, outfits, backup, scouted, links] = await Promise.all([
      finishedLookJobs(since),
      getAllOutfits(),
      backupState(),
      suggestionsSince(since),
      latestLinkCheck(since).catch(() => null),
    ]);
    const body: SiteEvents = {
      version: 1,
      generatedAt: new Date().toISOString(),
      lookJobs: summariseLookJobs(jobs, outfits),
      suggestions: scouted.map(({ id, batch, celebrity, event, why, score, status }) => ({ id, batch, celebrity, event, why, score, status })),
      linkCheck: links
        ? {
            id: links.id,
            runAt: links.runAt,
            checked: links.checked,
            skipped: links.skipped,
            // No product URLs: Slack links to the editor instead.
            changes: links.changes.map(({ outfitId, celebrity, event, piece, side, from, to, reason }) => ({ outfitId, celebrity, event, piece, side, from, to, reason })),
          }
        : null,
      backup,
    };
    return NextResponse.json(body, { headers: HEADERS });
  } catch (error) {
    console.error("Site events failed", error instanceof Error ? error.name : "Unknown");
    return NextResponse.json({ error: "events unavailable" }, { status: 503, headers: HEADERS });
  }
}
