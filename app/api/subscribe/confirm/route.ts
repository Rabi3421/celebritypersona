import { NextResponse, type NextRequest } from "next/server";
import { confirmSubscriber } from "@/lib/db/mutations";
import { site } from "@/lib/site-config";

/**
 * The link in the confirmation mail.
 *
 * A GET, because that is what a mail client can follow — which also means it
 * can be followed by a scanner or a prefetcher that the reader never saw. The
 * work it does is therefore idempotent, and every outcome lands on a page that
 * reads as an answer rather than an error.
 */

export const dynamic = "force-dynamic";

const page = (title: string, body: string, tone: "ok" | "warn") => `<!doctype html>
<html lang="en-IN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — CelebrityPersona</title>
<style>
  :root{color-scheme:light dark}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#FBF9F5;color:#16181D;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;padding:24px}
  .card{max-width:440px;background:#fff;border:1px solid #E4DFD6;border-radius:16px;padding:38px 34px;text-align:center}
  .mark{font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:600;
    color:${tone === "ok" ? "#0F7A5A" : "#9A6400"};margin:0 0 10px}
  h1{font-size:26px;line-height:1.2;margin:0 0 12px}
  p{font-size:15.5px;line-height:1.65;color:#3A3D45;margin:0 0 24px}
  a{display:inline-block;background:#E0006C;color:#fff;text-decoration:none;font-weight:600;
    padding:13px 24px;border-radius:8px}
  @media (prefers-color-scheme:dark){
    body{background:#131418;color:#F2EFE9}
    .card{background:#1A1C21;border-color:#2C2F36}
    p{color:#C8C4BC}
  }
</style></head>
<body><div class="card">
  <p class="mark">${tone === "ok" ? "Confirmed" : "Nothing to confirm"}</p>
  <h1>${title}</h1>
  <p>${body}</p>
  <a href="${site.url}">Browse the decodes</a>
</div></body></html>`;

const html = (markup: string) =>
  new NextResponse(markup, {
    headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" },
  });

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return html(page("That link is incomplete", "Open the link from the mail again, or sign up once more.", "warn"));
  }

  const result = await confirmSubscriber(token);

  if (result === "confirmed") {
    return html(page("You're on the list", "Two mails a week, the best decodes and the biggest price gaps. Every one has an unsubscribe link that works in one tap.", "ok"));
  }
  if (result === "already") {
    return html(page("You were already on the list", "Nothing more to do — the next look will reach you.", "ok"));
  }
  if (result === "expired") {
    return html(page("That link has expired", "Confirmation links last 48 hours. Sign up again and we will send a fresh one.", "warn"));
  }
  // Unknown covers a token that was never issued and one already spent. Both
  // get the same answer: saying which would tell a stranger whether an address
  // is on the list.
  return html(page("That link is no longer valid", "It may already have been used. If you are not sure, sign up again — signing up twice does no harm.", "warn"));
}
