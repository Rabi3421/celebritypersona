import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";

/**
 * Formerly Google's search suggestions for the keyword box, fetched from an
 * unofficial endpoint. Switched off: autocomplete is not demand evidence, and
 * the endpoint is not a supported API. No request leaves this server; the
 * route stays only so an admin tab opened before the change gets a clean
 * answer instead of a 404. Signed-in editors only, as before.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await readSession())) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  return NextResponse.json({ suggestions: [], disabled: true }, { status: 410 });
}
