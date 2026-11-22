import { z } from "zod";
import { cleanUrl, instagramPostUrl, MAX_BUY_URLS } from "@/lib/look-jobs";

/**
 * The morning trend scout's suggestions.
 *
 * Every morning the runner on the editor's computer asks Claude for the
 * Indian celebrity fashion moments of the last 48 hours worth decoding, each
 * with its Instagram post and at least one page that sells the piece. The
 * best five are kept here as suggestions; the editor queues the ones they
 * want, and only then does research start. Nothing is researched, drafted or
 * published without that tap.
 *
 * The scout's reply is untrusted input: checked here, links normalised the
 * same way as the "New look from links" form, and anything already covered or
 * already suggested is dropped. No imports beyond zod and the job rules, so the
 * runner and tests load it too.
 */

export const SUGGESTIONS_PER_DAY = 5;

export const SUGGESTION_STATUSES = ["suggested", "queued", "dismissed"] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export type LookSuggestion = {
  id: string;
  /** The IST day the scout ran, YYYY-MM-DD; one batch per day. */
  batch: string;
  celebrity: string;
  event: string;
  /** The day it was worn or posted, YYYY-MM-DD. */
  date: string;
  instagramUrl: string;
  buyUrls: string[];
  /** One sentence for the editor: why this look, why now. */
  why: string;
  /** 1–10, the scout's own estimate of search interest and fit. */
  score: number;
  sources: string[];
  status: SuggestionStatus;
  jobId?: string;
  createdAt: string;
  updatedAt: string;
};

const httpsUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  });

export const scoutCandidateSchema = z.object({
  celebrity: z.string().trim().min(2).max(80),
  event: z.string().trim().min(2).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  instagramUrl: z.string().trim().max(500),
  buyUrls: z.array(z.string().trim().max(2000)).max(MAX_BUY_URLS),
  // A long reason is shortened, not a reason to throw a good look away.
  why: z.string().trim().min(10).max(1000).transform((value) => (value.length > 300 ? `${value.slice(0, 299).trimEnd()}…` : value)),
  score: z.number().min(1).max(10),
  sources: z.array(httpsUrl).max(5).default([]),
});

export const scoutReplySchema = z.object({ candidates: z.array(z.unknown()).max(15) });

export type ScoutCandidate = Omit<LookSuggestion, "id" | "batch" | "status" | "jobId" | "createdAt" | "updatedAt">;

/**
 * Cleans the scout's candidates: each must name one real Instagram post and
 * at least one https buying link; links lose their tracking tags; a post that
 * is already covered (a job or an earlier suggestion) is dropped; the best
 * `SUGGESTIONS_PER_DAY` by score are kept. Returns what was dropped and why,
 * for the runner's log.
 */
export function cleanCandidates(
  raw: unknown[],
  alreadyCovered: Iterable<string>,
): { kept: ScoutCandidate[]; dropped: string[] } {
  const covered = new Set(alreadyCovered);
  const kept: ScoutCandidate[] = [];
  const dropped: string[] = [];
  for (const item of raw) {
    const parsed = scoutCandidateSchema.safeParse(item);
    if (!parsed.success) {
      dropped.push(`not in the expected shape (${parsed.error.issues[0]?.path.join(".") || "?"})`);
      continue;
    }
    const candidate = parsed.data;
    const post = instagramPostUrl(candidate.instagramUrl);
    if (!post) {
      dropped.push(`${candidate.celebrity}: not a single Instagram post`);
      continue;
    }
    if (covered.has(post)) {
      dropped.push(`${candidate.celebrity}: already covered`);
      continue;
    }
    const buyUrls = [
      ...new Set(
        candidate.buyUrls
          .filter((url) => httpsUrl.safeParse(url).success)
          .map(cleanUrl)
          .filter((url) => !/instagram\.com/i.test(url)),
      ),
    ];
    if (!buyUrls.length) {
      dropped.push(`${candidate.celebrity}: no page that sells the piece`);
      continue;
    }
    covered.add(post);
    kept.push({ ...candidate, instagramUrl: post, buyUrls });
  }
  kept.sort((a, b) => b.score - a.score);
  return { kept: kept.slice(0, SUGGESTIONS_PER_DAY), dropped };
}
