import { NextResponse } from "next/server";
import { getAllOutfits, getCelebrityViews, getOccasionViews } from "@/lib/db/content";
import { claimLookJob } from "@/lib/db/look-jobs";
import { reportTokenValid } from "@/lib/report/report-auth";
import { outfitSlug } from "@/lib/slugs";

/**
 * POST /api/runner/looks/claim — for the research runner on the editor's computer.
 *
 *   Authorization: Bearer <LOOKS_RUNNER_TOKEN>
 *
 * Takes the oldest waiting "look from links" job, marks it running and returns
 * it with what the research needs to fit the archive: the names already in use
 * (so a celebrity is not filed twice under two spellings), the slugs taken, and
 * the keywords other looks already target. 204 when nothing is waiting.
 *
 * Without a valid token, or when LOOKS_RUNNER_TOKEN is not set (previews), it
 * answers 404, as if it did not exist.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

export async function POST(request: Request) {
  if (!reportTokenValid(request.headers.get("authorization"), process.env.LOOKS_RUNNER_TOKEN)) {
    return new NextResponse("Not found", { status: 404, headers: HEADERS });
  }
  const job = await claimLookJob();
  if (!job) return new NextResponse(null, { status: 204, headers: HEADERS });

  const [outfits, celebrities, occasions] = await Promise.all([getAllOutfits(), getCelebrityViews(), getOccasionViews()]);
  return NextResponse.json(
    {
      job,
      context: {
        celebrities: celebrities.map((celebrity) => celebrity.name),
        occasions: occasions.map((occasion) => occasion.name),
        takenSlugs: outfits.map(outfitSlug),
        keywordsInUse: outfits.map((outfit) => outfit.primaryKeyword).filter(Boolean),
      },
    },
    { headers: HEADERS },
  );
}
