import "server-only";
import { getDb } from "@/lib/mongodb";
import type { LookSuggestion, ScoutCandidate, SuggestionStatus } from "@/lib/look-suggestions";

/**
 * The scout's suggestions, one document each in `lookSuggestions`, keyed by
 * a random `id`. A suggestion becomes a research job only when the editor
 * queues it (see the "New look from links" page).
 */
const suggestions = async () => (await getDb()).collection<LookSuggestion>("lookSuggestions");

/** Saves a day's batch. A second run on the same day adds to it rather than replacing it. */
export async function saveSuggestions(batch: string, candidates: ScoutCandidate[], makeId: () => string): Promise<LookSuggestion[]> {
  if (!candidates.length) return [];
  const now = new Date().toISOString();
  const docs: LookSuggestion[] = candidates.map((candidate) => ({
    ...candidate,
    id: makeId(),
    batch,
    status: "suggested",
    createdAt: now,
    updatedAt: now,
  }));
  const collection = await suggestions();
  await collection.createIndex({ id: 1 }, { unique: true });
  await collection.insertMany(docs.map((doc) => ({ ...doc })));
  return docs;
}

/** Newest first. */
export async function listSuggestions(limit = 30): Promise<LookSuggestion[]> {
  return (await suggestions()).find({}, { sort: { createdAt: -1 }, limit, projection: { _id: 0 } }).toArray();
}

export async function getSuggestion(id: string): Promise<LookSuggestion | null> {
  return (await suggestions()).findOne({ id }, { projection: { _id: 0 } });
}

export async function setSuggestionStatus(id: string, status: SuggestionStatus, jobId?: string) {
  await (await suggestions()).updateOne(
    { id, status: "suggested" },
    { $set: { status, ...(jobId ? { jobId } : {}), updatedAt: new Date().toISOString() } },
  );
}

/** Every Instagram post ever suggested, so the scout never suggests one twice. */
export async function suggestedPosts(): Promise<string[]> {
  return (await suggestions()).distinct("instagramUrl");
}

/** Suggestions created since `since`, for the Slack alert. */
export async function suggestionsSince(since: Date): Promise<LookSuggestion[]> {
  return (await suggestions())
    .find({ createdAt: { $gte: since.toISOString() } }, { sort: { createdAt: 1 }, limit: 30, projection: { _id: 0 } })
    .toArray();
}
