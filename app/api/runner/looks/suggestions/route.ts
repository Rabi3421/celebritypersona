import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getCelebrityViews } from "@/lib/db/content";
import { queuedPosts } from "@/lib/db/look-jobs";
import { saveSuggestions, suggestedPosts } from "@/lib/db/look-suggestions";
import { istToday } from "@/lib/dates";
import { newLookJobId } from "@/lib/look-jobs";
import { cleanCandidates, scoutReplySchema } from "@/lib/look-suggestions";
import { reportTokenValid } from "@/lib/report/report-auth";

/**
 * The morning trend scout, for the runner on the editor's computer.
 *
 *   GET  /api/runner/looks/suggestions  what the scout must not suggest again,
 *                                       and the names already in the archive
 *   POST /api/runner/looks/suggestions  { candidates: [...] } → today's batch
 *
 *   Authorization: Bearer <LOOKS_RUNNER_TOKEN>
 *
 * The candidates are untrusted: cleaned and deduplicated by cleanCandidates,
 * at most five kept. Saving a suggestion starts nothing; the editor queues it.
 * Without a valid token it answers 404, as if it did not exist.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
const notFound = () => new NextResponse("Not found", { status: 404, headers: HEADERS });

async function covered() {
  const [queued, suggested] = await Promise.all([queuedPosts(), suggestedPosts()]);
  return [...new Set([...queued, ...suggested])];
}

export async function GET(request: Request) {
  if (!reportTokenValid(request.headers.get("authorization"), process.env.LOOKS_RUNNER_TOKEN)) return notFound();
  const [posts, celebrities] = await Promise.all([covered(), getCelebrityViews()]);
  return NextResponse.json(
    { today: istToday(), coveredPosts: posts, celebrities: celebrities.map((celebrity) => celebrity.name) },
    { headers: HEADERS },
  );
}

export async function POST(request: Request) {
  if (!reportTokenValid(request.headers.get("authorization"), process.env.LOOKS_RUNNER_TOKEN)) return notFound();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "body is not JSON" }, { status: 400, headers: HEADERS });
  }
  const parsed = scoutReplySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "expected { candidates: [...] }" }, { status: 422, headers: HEADERS });

  const { kept, dropped } = cleanCandidates(parsed.data.candidates, await covered());
  const saved = await saveSuggestions(istToday(), kept, () => newLookJobId((size) => randomBytes(size)));
  return NextResponse.json({ saved: saved.length, dropped }, { headers: HEADERS });
}
