import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the public site after something changed the database from outside
 * Next.
 *
 * Saving a look in the panel already revalidates, because that runs inside the
 * app. The maintenance scripts do not: `check:links`, `migrate:links`,
 * `seed:content` and the purges all talk to MongoDB directly, so a link that
 * has just been marked dead, or a look whose pieces have just been removed,
 * keeps being served from the last render until the page's own TTL lapses.
 * That is an hour at worst on a busy route, and rather longer on a quiet one:
 * a stale page is only regenerated when somebody asks for it, so a route
 * nobody visits stays one visit behind indefinitely.
 *
 * This is the hook those scripts call when they are done.
 *
 *     curl -X POST https://www.celebritypersona.com/api/revalidate \
 *          -H "Authorization: Bearer $CRON_SECRET"
 *
 * It takes no path from the caller, by design. An endpoint that revalidates
 * whatever it is handed is a cheap way to make somebody else's origin do work,
 * and there is no reason a caller should need to name a page: there is exactly
 * one thing to do here, which is to make the site agree with the database.
 */

export const dynamic = "force-dynamic";

/**
 * The route handlers that live outside the root layout and therefore are not
 * covered by the layout-wide sweep below. Every page is.
 */
const STANDALONE = ["/sitemap.xml", "/llms.txt", "/api/search-index"];

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  /**
   * Fails closed, unlike the mail cron, which treats a missing secret as "no
   * protection configured, carry on". That is defensible for a job that only
   * sends what somebody already queued. It is not defensible here: without the
   * secret this would be an unauthenticated way to make the origin rebuild
   * every page on the site, over and over.
   */
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on this deployment." },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  // Every page under the root layout, which is all of them.
  revalidatePath("/", "layout");
  for (const path of STANDALONE) revalidatePath(path);

  return NextResponse.json({
    revalidated: true,
    scope: ["/ (layout)", ...STANDALONE],
    at: new Date().toISOString(),
  });
}
