import { NextResponse } from "next/server";
import { draftedLookJob, failLookJob, runningLookJob } from "@/lib/db/look-jobs";
import { createDraftFromResearch, DraftRefused } from "@/lib/look-drafts";
import { researchProblems, researchSchema } from "@/lib/look-research";
import { reportTokenValid } from "@/lib/report/report-auth";

/**
 * POST /api/runner/looks/<job id> — the runner reports how a job ended.
 *
 *   Authorization: Bearer <LOOKS_RUNNER_TOKEN>
 *   { "failed": "why" }                         → the job is marked failed
 *   { "research": {…}, "by": ["claude"] }       → checked, saved as a DRAFT outfit
 *
 * The research is untrusted: it is validated here, then again by the editor's
 * own outfit validation. A refusal comes back as 422 with every problem named,
 * and the job stays running so the runner can correct and resend. Nothing this
 * route does can publish a look.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
const reply = (status: number, body: unknown) => NextResponse.json(body, { status, headers: HEADERS });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!reportTokenValid(request.headers.get("authorization"), process.env.LOOKS_RUNNER_TOKEN)) {
    return new NextResponse("Not found", { status: 404, headers: HEADERS });
  }
  const { id } = await params;
  const job = await runningLookJob(id);
  // Cancelled by the editor, already finished, or never existed.
  if (!job) return reply(409, { error: "This job is not running any more." });

  let body: { failed?: unknown; research?: unknown; by?: unknown };
  try {
    body = await request.json();
  } catch {
    return reply(400, { error: "Send JSON." });
  }

  if (typeof body.failed === "string") {
    await failLookJob(id, body.failed);
    return reply(200, { status: "failed" });
  }

  const parsed = researchSchema.safeParse(body.research);
  if (!parsed.success) return reply(422, { problems: researchProblems(parsed.error) });

  try {
    const outfitId = await createDraftFromResearch(job, parsed.data);
    const by = Array.isArray(body.by) ? body.by.filter((name): name is string => typeof name === "string").slice(0, 4) : [];
    await draftedLookJob(id, outfitId, { evidence: parsed.data.evidence, checks: parsed.data.checks, by });
    return reply(200, { status: "drafted", outfitId });
  } catch (error) {
    if (error instanceof DraftRefused) return reply(422, { problems: [error.message] });
    throw error;
  }
}
