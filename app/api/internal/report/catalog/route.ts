import { NextResponse } from "next/server";
import { getAllOutfits } from "@/lib/db/content";
import { getDb } from "@/lib/mongodb";
import { catalogRange, parseCatalogRequest, summariseCatalog, type ClickGroup } from "@/lib/report/catalog-summary";
import { clickPipeline } from "@/lib/report/click-summary";
import { reportTokenValid } from "@/lib/report/report-auth";
import { outfitSlug } from "@/lib/slugs";
import { isBuyable, isMonetised, isPublished, pieceLink } from "@/lib/types";

/**
 * Catalogue and shop-click totals for the weekly growth report.
 *
 *   GET /api/internal/report/catalog?week=YYYY-MM-DD (a Monday)&weeks=4
 *   Authorization: Bearer <REPORT_API_TOKEN>
 *
 * Read only, and aggregates only: counts of outfits, pieces, product links and
 * clicks, public outfit slugs, and counts (never text) of reader requests and
 * price reports. Same token and the same plain 404 as /api/internal/report/clicks.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" };

const notFound = () => new NextResponse("Not found", { status: 404, headers: HEADERS });

async function countsByStatus(collection: string): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db
    .collection(collection)
    .aggregate<{ _id: unknown; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }], { maxTimeMS: 8_000 })
    .toArray();
  return Object.fromEntries(rows.map((r) => [typeof r._id === "string" ? r._id : "(none)", r.n]));
}

export async function GET(request: Request) {
  if (!reportTokenValid(request.headers.get("authorization"), process.env.REPORT_API_TOKEN)) return notFound();

  const parsed = parseCatalogRequest(new URL(request.url).searchParams);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: HEADERS });

  try {
    const range = catalogRange(parsed.value);
    const weekFrom = new Date(Date.parse(range.to) - 7 * 86_400_000).toISOString();
    const db = await getDb();
    const [outfits, clickRows, requestsByStatus, priceReportsByStatus, activeSubscribers, activeSubscribersJoinedThisWeek] = await Promise.all([
      getAllOutfits(),
      db
        .collection("linkClicks")
        .aggregate<{ _id: Omit<ClickGroup, "clicks">; clicks: number }>(clickPipeline(range), { maxTimeMS: 8_000 })
        .toArray(),
      countsByStatus("celebrityRequests"),
      countsByStatus("priceReports"),
      db.collection("subscribers").countDocuments({ status: "Active" }, { maxTimeMS: 8_000 }),
      db.collection("subscribers").countDocuments({ status: "Active", joinedAt: { $gte: weekFrom, $lt: range.to } }, { maxTimeMS: 8_000 }),
    ]);
    const summary = summariseCatalog(
      {
        outfits,
        clickGroups: clickRows.map(({ _id, clicks }) => ({ ..._id, clicks })),
        requestsByStatus,
        priceReportsByStatus,
        activeSubscribers,
        activeSubscribersJoinedThisWeek,
      },
      parsed.value,
      { isPublished, pieceLink, isBuyable, isMonetised, slugOf: outfitSlug },
      new Date().toISOString(),
    );
    return NextResponse.json(summary, { headers: HEADERS });
  } catch (error) {
    // The Worker reports these figures as unavailable; it never reads this as zero.
    console.error("Catalog summary failed", error instanceof Error ? error.name : "Unknown");
    return NextResponse.json({ error: "catalog summary unavailable" }, { status: 503, headers: HEADERS });
  }
}
