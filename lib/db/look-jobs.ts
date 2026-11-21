import "server-only";
import { deleteObject, ref } from "firebase/storage";
import { uploaderStorage } from "@/lib/firebase";
import { getDb } from "@/lib/mongodb";
import { storageDeleteAllowed } from "@/lib/db-guard";
import { canCancel, INBOX_PHOTO, STALE_RUNNING_MS, type LookJob, type NewLookJob } from "@/lib/look-jobs";

/**
 * The queue behind "New look from links". One document per job in
 * `lookJobs`, keyed by its own random `id`. Nothing here touches outfits: the
 * runner creates the draft through its own route, and only after research.
 */
const jobs = async () => (await getDb()).collection<LookJob>("lookJobs");

export async function createLookJob(input: NewLookJob, createdBy: string): Promise<LookJob> {
  const now = new Date().toISOString();
  const job: LookJob = { ...input, status: "queued", createdAt: now, updatedAt: now, createdBy };
  const collection = await jobs();
  await collection.createIndex({ id: 1 }, { unique: true });
  await collection.insertOne({ ...job });
  return job;
}

/** Newest first; the page shows the most recent ones. */
export async function listLookJobs(limit = 50): Promise<LookJob[]> {
  return (await jobs()).find({}, { sort: { createdAt: -1 }, limit, projection: { _id: 0 } }).toArray();
}

/** Stops a job the runner has not finished. A finished job is left alone. */
export async function cancelLookJob(id: string): Promise<boolean> {
  const now = new Date().toISOString();
  const result = await (await jobs()).updateOne(
    { id, status: { $in: ["queued", "running"] } },
    { $set: { status: "cancelled", updatedAt: now, finishedAt: now } },
  );
  return result.modifiedCount === 1;
}

/**
 * Removes a job from the list, and its inbox photo with it unless a draft was
 * made from the job (the draft may still be using that photo). Refuses a job
 * that is still waiting or running: cancel it first.
 */
export async function removeLookJob(id: string): Promise<boolean> {
  const collection = await jobs();
  const job = await collection.findOne({ id });
  if (!job || canCancel(job.status)) return false;
  await collection.deleteOne({ id });
  const path = job.photo?.path;
  if (path && !job.outfitId && INBOX_PHOTO.test(path) && storageDeleteAllowed(path)) {
    try {
      await deleteObject(ref(await uploaderStorage(), path));
    } catch {
      // Already gone; an orphaned inbox photo is untidy, not harmful.
    }
  }
  return true;
}

/**
 * For the runner: takes the oldest waiting job (or one a runner claimed long
 * ago and never finished) and marks it running, atomically, so two runners
 * can never research the same look.
 */
export async function claimLookJob(now = new Date()): Promise<LookJob | null> {
  const at = now.toISOString();
  const stale = new Date(now.getTime() - STALE_RUNNING_MS).toISOString();
  return (await jobs()).findOneAndUpdate(
    { $or: [{ status: "queued" }, { status: "running", startedAt: { $lt: stale } }] },
    { $set: { status: "running", startedAt: at, updatedAt: at }, $unset: { error: "" } },
    { sort: { createdAt: 1 }, returnDocument: "after", projection: { _id: 0 } },
  );
}

/** The job, if it is still running — the editor may have cancelled it meanwhile. */
export async function runningLookJob(id: string): Promise<LookJob | null> {
  return (await jobs()).findOne({ id, status: "running" }, { projection: { _id: 0 } });
}

export async function failLookJob(id: string, error: string) {
  const now = new Date().toISOString();
  await (await jobs()).updateOne(
    { id, status: "running" },
    { $set: { status: "failed", error: error.slice(0, 500), updatedAt: now, finishedAt: now } },
  );
}

export async function draftedLookJob(id: string, outfitId: number, findings: NonNullable<LookJob["findings"]>) {
  const now = new Date().toISOString();
  await (await jobs()).updateOne(
    { id },
    { $set: { status: "drafted", outfitId, findings, updatedAt: now, finishedAt: now } },
  );
}
