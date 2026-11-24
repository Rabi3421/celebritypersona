import { NextResponse, type NextRequest } from "next/server";
import { runLinkCheck } from "@/lib/link-check";
import { outfitsToCheck, saveLinkCheck } from "@/lib/db/link-checks";
import { revalidatePublicSite } from "@/lib/revalidation";

/**
 * The weekly product-link check (vercel.json: Monday 00:30 UTC = 06:00 IST,
 * before the reports). Reads every product link on every look, least
 * recently checked first, and stores what it learned (lib/link-check.ts).
 * A link the shop would not let us read keeps the status it had.
 *
 * What changed is saved in `linkChecks`; the monitor posts it to Slack from
 * /api/internal/report/events. Nothing is ever unpublished: a look whose links
 * died is still a decoded look, and what to do about it is the editor's call.
 *
 * It fails closed: no CRON_SECRET → 503, wrong secret → 401, outside
 * Production → 404.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/** Stop starting checks with time left to save; the rest wait a week, oldest first. */
const BUDGET_MS = 240_000;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return NextResponse.json({ error: "Production only" }, { status: 404 });

  const started = new Date();
  const run = await runLinkCheck(await outfitsToCheck(), { budgetMs: BUDGET_MS });
  const record = await saveLinkCheck(run, started);
  // A link marked dead keeps its Buy button until its page is rendered again.
  if (run.changes.length) revalidatePublicSite();

  return NextResponse.json({
    ok: true,
    checked: record.checked,
    skipped: record.skipped,
    tally: record.tally,
    changes: record.changes.length,
    seconds: Math.round((Date.now() - started.getTime()) / 100) / 10,
  });
}
