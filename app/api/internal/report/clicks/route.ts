import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { clickPipeline, parseSummaryRequest, summariseClicks, summaryRange, type ClickGroup } from "@/lib/report/click-summary";
import { reportTokenValid } from "@/lib/report/report-auth";

/**
 * Shop-click totals for the daily production report.
 *
 *   GET /api/internal/report/clicks?date=YYYY-MM-DD&days=2
 *   Authorization: Bearer <REPORT_API_TOKEN>
 *
 * Read only: one aggregation over `linkClicks`, which returns counts and
 * nothing that identifies a click. Only the monitoring Worker calls it, so
 * the database credentials never leave Vercel.
 *
 * Without a valid token, or when REPORT_API_TOKEN is not set (previews and
 * local builds), the answer is the same plain 404 as any unknown path.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" };

const notFound = () => new NextResponse("Not found", { status: 404, headers: HEADERS });

export async function GET(request: Request) {
  if (!reportTokenValid(request.headers.get("authorization"), process.env.REPORT_API_TOKEN)) return notFound();

  const parsed = parseSummaryRequest(new URL(request.url).searchParams);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: HEADERS });

  try {
    const db = await getDb();
    const rows = await db
      .collection("linkClicks")
      .aggregate<{ _id: Omit<ClickGroup, "clicks">; clicks: number }>(clickPipeline(summaryRange(parsed.value)), { maxTimeMS: 8_000 })
      .toArray();
    const groups: ClickGroup[] = rows.map(({ _id, clicks }) => ({ ..._id, clicks }));
    return NextResponse.json(summariseClicks(groups, parsed.value, new Date().toISOString()), { headers: HEADERS });
  } catch (error) {
    // The Worker reports clicks as unavailable; it never reads this as zero.
    console.error("Click summary failed", error instanceof Error ? error.name : "Unknown");
    return NextResponse.json({ error: "click summary unavailable" }, { status: 503, headers: HEADERS });
  }
}
