import "server-only";
import { getDb } from "@/lib/mongodb";
import type { CheckableOutfit, LinkChange, LinkCheckRun } from "@/lib/link-check";
import type { LinkStatus } from "@/lib/types";

/**
 * The weekly link check's record: one document per run in `linkChecks`, so
 * Slack can say what changed (via /api/internal/report/events), and the new
 * statuses written onto the outfits themselves.
 */

export type LinkCheckRecord = {
  id: string;
  runAt: string;
  checked: number;
  skipped: number;
  tally: Record<LinkStatus, number>;
  changes: LinkChange[];
};

const runs = async () => (await getDb()).collection<LinkCheckRecord>("linkChecks");

export async function outfitsToCheck(): Promise<CheckableOutfit[]> {
  return (await getDb())
    .collection<CheckableOutfit>("outfits")
    .find({}, { projection: { _id: 0, id: 1, celebrity: 1, event: 1, status: 1, items: 1 } })
    .toArray();
}

/**
 * Writes only `items` (each link's status and checked date) on the outfits
 * that were read, and `contentChangedAt` only where a status actually moved:
 * that is what moves the sitemap's lastmod, and a re-read is not a change.
 */
export async function saveLinkCheck(run: LinkCheckRun, runAt: Date): Promise<LinkCheckRecord> {
  const db = await getDb();
  const today = runAt.toISOString().slice(0, 10);
  for (const update of run.updates) {
    await db
      .collection("outfits")
      .updateOne({ id: update.id }, { $set: { items: update.items, ...(update.moved ? { contentChangedAt: today } : {}) } });
  }
  const record: LinkCheckRecord = {
    id: runAt.toISOString(),
    runAt: runAt.toISOString(),
    checked: run.checked,
    skipped: run.skipped,
    tally: run.tally,
    changes: run.changes,
  };
  await (await runs()).insertOne({ ...record });
  return record;
}

/** The newest run since `since`, or null. */
export async function latestLinkCheck(since: Date): Promise<LinkCheckRecord | null> {
  return (await runs()).findOne({ runAt: { $gte: since.toISOString() } }, { sort: { runAt: -1 }, projection: { _id: 0 } });
}
