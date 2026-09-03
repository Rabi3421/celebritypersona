import { NextResponse, type NextRequest } from "next/server";
import { drainQueue } from "@/lib/mail/drain";

/**
 * The safety net.
 *
 * Announcing a look already sends it, in the background, moments after the
 * button is pressed. This exists for what that pass could not finish: a list
 * too long for one request, a provider that was briefly down, a deploy that
 * cut a run short. It is the same work, on a timer.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TIME_BUDGET_MS = 40_000;

/** Nobody wants a fashion newsletter at four in the morning. IST, because that
 *  is where the readers are. */
const OPENS_AT = 8;
const CLOSES_AT = 21;

const istHour = () =>
  Number(
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );

function authorised(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const hour = istHour();
  if (request.nextUrl.searchParams.get("force") !== "1" && (hour < OPENS_AT || hour >= CLOSES_AT)) {
    return NextResponse.json({ held: "outside sending hours", hour });
  }

  return NextResponse.json(await drainQueue(TIME_BUDGET_MS));
}
