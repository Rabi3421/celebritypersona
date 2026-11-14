import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "@/lib/auth/session";
import { overviewCsv } from "@/lib/bi/csv";
import { loadOverview } from "@/lib/bi/overview";

/**
 * The Overview's daily figures as CSV, for the signed-in admin only. Same
 * period rules and sources as the page (PostHog served from the same cache),
 * aggregates only.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await readSession())) return NextResponse.json({ error: "signed-out" }, { status: 401, headers: { "cache-control": "no-store" } });
  const q = request.nextUrl.searchParams;
  const o = await loadOverview({ range: q.get("range") ?? undefined, from: q.get("from") ?? undefined, to: q.get("to") ?? undefined });
  return new NextResponse(overviewCsv(o.period, o.clicks, await o.traffic), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="celebritypersona-overview-${o.period.from}-to-${o.period.to}.csv"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
