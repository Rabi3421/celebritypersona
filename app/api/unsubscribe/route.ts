import { NextResponse, type NextRequest } from "next/server";
import { unsubscribeByToken } from "@/lib/db/mutations";
import { site } from "@/lib/site-config";

/**
 * Leaving, in one tap and without signing in to anything.
 *
 * Two verbs, both required. Gmail and Yahoo look for a POST endpoint declared
 * by `List-Unsubscribe-Post` and call it themselves when a reader presses the
 * unsubscribe button in the client — no page is ever shown. The GET is for the
 * link in the footer, which a person clicks and expects an answer from.
 *
 * An unrecognised token still reports success. Telling a stranger whether an
 * address is on the list is worse than being over-agreeable, and a reader
 * trying to leave must never meet an error.
 */

export const dynamic = "force-dynamic";

/** RFC 8058: the one-click POST, answered as fast as possible. */
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token) await unsubscribeByToken(token, "One-click unsubscribe");
  return new NextResponse(null, { status: 200 });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token) await unsubscribeByToken(token, "Unsubscribe link");

  return new NextResponse(
    `<!doctype html>
<html lang="en-IN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribed — CelebrityPersona</title>
<style>
  :root{color-scheme:light dark}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#FBF9F5;color:#16181D;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;padding:24px}
  .card{max-width:440px;background:#fff;border:1px solid #E4DFD6;border-radius:16px;padding:38px 34px;text-align:center}
  .mark{font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:600;color:#71757E;margin:0 0 10px}
  h1{font-size:26px;line-height:1.2;margin:0 0 12px}
  p{font-size:15.5px;line-height:1.65;color:#3A3D45;margin:0 0 24px}
  a{display:inline-block;background:#E0006C;color:#fff;text-decoration:none;font-weight:600;
    padding:13px 24px;border-radius:8px}
  @media (prefers-color-scheme:dark){
    body{background:#131418;color:#F2EFE9}.card{background:#1A1C21;border-color:#2C2F36}p{color:#C8C4BC}
  }
</style></head>
<body><div class="card">
  <p class="mark">Done</p>
  <h1>You're unsubscribed</h1>
  <p>No more mail from us. The site is still here whenever you want it, and you can sign up again any time.</p>
  <a href="${site.url}">Browse the decodes</a>
</div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" } },
  );
}
