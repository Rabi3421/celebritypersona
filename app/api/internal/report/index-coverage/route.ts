import { NextResponse } from "next/server";
import { accessToken, inspectUrl, searchTotals, serviceAccount, type Inspection } from "@/lib/gsc";
import { reportTokenValid } from "@/lib/report/report-auth";
import { summariseCoverage } from "@/lib/report/index-coverage";
import { sitemapEntries } from "@/lib/sitemap";

/**
 * Google index coverage of every sitemap URL, for the monitor's weekly Slack
 * message.
 *
 *   GET /api/internal/report/index-coverage
 *   Authorization: Bearer <REPORT_API_TOKEN>
 *
 * Read only: one URL Inspection call per sitemap URL (Google allows 2,000 a
 * day) and two Search Analytics totals, with the read-only service account in
 * GSC_SERVICE_ACCOUNT_JSON. Without a valid token it is the same plain 404 as
 * any unknown path; without the service account it answers 503.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const HEADERS = { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" };
const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);

export async function GET(request: Request) {
  if (!reportTokenValid(request.headers.get("authorization"), process.env.REPORT_API_TOKEN)) {
    return new NextResponse("Not found", { status: 404, headers: HEADERS });
  }
  const account = serviceAccount();
  if (!account) return NextResponse.json({ error: "GSC_SERVICE_ACCOUNT_JSON is not set" }, { status: 503, headers: HEADERS });

  try {
    const token = await accessToken(account);
    const urls = (await sitemapEntries()).map((entry) => (entry.url.endsWith(".com") ? `${entry.url}/` : entry.url));

    // A few at a time: quick enough, and well inside Google's per-minute limit.
    const rows: Inspection[] = [];
    let errors = 0;
    for (let i = 0; i < urls.length; i += 5) {
      const batch = await Promise.allSettled(urls.slice(i, i + 5).map((url) => inspectUrl(token, url)));
      for (const result of batch) {
        if (result.status === "fulfilled") rows.push(result.value);
        else errors++;
      }
    }

    // Search data lags about two days; compare the last full week with the one before.
    const search = await Promise.all([searchTotals(token, day(9), day(3)), searchTotals(token, day(16), day(10))])
      .then(([last7, prev7]) => ({ last7, prev7 }))
      .catch(() => null);

    return NextResponse.json(summariseCoverage(rows, search, errors), { headers: HEADERS });
  } catch (error) {
    console.error("Index coverage failed", error instanceof Error ? error.message : "Unknown");
    return NextResponse.json({ error: "index coverage unavailable" }, { status: 503, headers: HEADERS });
  }
}
