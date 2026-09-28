import { NextResponse } from "next/server";
import { readSession, renewSession } from "@/lib/auth/session";

/**
 * "Am I still signed in?" — and, if so, keep me signed in.
 *
 * The panel's own heartbeat calls this while an editor is working in an open
 * tab, and the upload and save paths call it once before giving up on a
 * refused request. A live session is renewed on the way out, so the answer
 * is also the extension. Never cached.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ signedIn: false, code: "signed-out" }, { status: 401 });
  }
  await renewSession(session);
  return NextResponse.json(
    { signedIn: true },
    { headers: { "cache-control": "no-store" } },
  );
}
