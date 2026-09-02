import "server-only";
import { site } from "@/lib/site-config";
import type { MailJob } from "@/lib/types";

/**
 * The two mails this site sends.
 *
 * Both are written twice — once in HTML and once in plain text — because a
 * text part is not a courtesy. A message without one scores worse with spam
 * filters, and some readers genuinely never render the HTML.
 *
 * Nothing that matters lives only inside an image: most clients block images
 * until a reader asks for them, so an image-only mail arrives blank.
 */

const inr = (value: number) => `₹${value.toLocaleString("en-IN")}`;

/** Anything interpolated into HTML has come from a database that an editor
 *  types into. It is escaped on the way out regardless. */
const esc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const SHELL = (body: string, footer: string) => `<!doctype html>
<html lang="en-IN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
</head>
<body style="margin:0;padding:0;background:#FBF9F5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF9F5;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E4DFD6;border-radius:14px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
${body}
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:20px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8A8E97;">
${footer}
</td></tr></table>
</td></tr></table>
</body></html>`;

/* ------------------------------------------------------- confirmation mail */

export function confirmEmail(confirmUrl: string) {
  const body = `
<tr><td style="padding:34px 34px 8px;">
  <p style="margin:0 0 6px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#E0006C;font-weight:600;">One more tap</p>
  <h1 style="margin:0 0 14px;font-size:26px;line-height:1.2;color:#16181D;">Confirm your email</h1>
  <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#3A3D45;">
    Somebody — we hope you — asked for the new looks from CelebrityPersona.
    Tap below and you are on the list. Ignore this and nothing happens.
  </p>
  <a href="${confirmUrl}" style="display:inline-block;background:#E0006C;color:#FFFFFF;text-decoration:none;font-size:16px;font-weight:600;padding:14px 26px;border-radius:8px;">Yes, add me</a>
</td></tr>
<tr><td style="padding:22px 34px 32px;">
  <p style="margin:0;font-size:13px;line-height:1.6;color:#71757E;">
    The link works for 48 hours. If the button does not open, copy this in:<br>
    <span style="word-break:break-all;color:#3A3D45;">${esc(confirmUrl)}</span>
  </p>
</td></tr>`;

  const footer = `You are receiving this only because this address was entered at ${esc(site.domain)}.
    No further mail is sent unless you confirm.`;

  const text = `Confirm your email

Somebody - we hope you - asked for the new looks from CelebrityPersona.
Open this link and you are on the list:

${confirmUrl}

The link works for 48 hours. Ignore this mail and nothing happens: no further
mail is sent unless you confirm.

${site.url}`;

  return {
    subject: "Confirm your email — CelebrityPersona",
    html: SHELL(body, footer),
    text,
  };
}

/* ----------------------------------------------------------- the new look */

export function lookEmail(job: MailJob, unsubscribeUrl: string) {
  const { look } = job;
  const price = look.worn ? `${inr(look.worn)} as worn` : "Priced piece by piece";
  const pieces = `${look.pieces} ${look.pieces === 1 ? "piece" : "pieces"} identified`;

  const image = look.image
    ? `<tr><td style="padding:0;">
        <a href="${look.url}"><img src="${esc(look.image)}" width="560" alt="${esc(look.celebrity)} at ${esc(look.event)}"
          style="display:block;width:100%;max-width:560px;height:auto;border:0;"></a>
      </td></tr>`
    : "";

  const body = `${image}
<tr><td style="padding:30px 34px 10px;">
  <p style="margin:0 0 6px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#E0006C;font-weight:600;">Decoded</p>
  <h1 style="margin:0 0 8px;font-size:26px;line-height:1.2;color:#16181D;">${esc(look.celebrity)}</h1>
  <p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#71757E;">${esc(look.event)}</p>
  <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#3A3D45;">
    ${esc(pieces)} — ${esc(price)}, with where to buy each one and what it would
    cost you instead.
  </p>
  <a href="${look.url}" style="display:inline-block;background:#E0006C;color:#FFFFFF;text-decoration:none;font-size:16px;font-weight:600;padding:14px 26px;border-radius:8px;">See the decode</a>
</td></tr>
<tr><td style="padding:24px 34px 30px;">
  <p style="margin:0;font-size:13px;line-height:1.6;color:#71757E;word-break:break-all;">${esc(look.url)}</p>
</td></tr>`;

  const footer = `You asked for these at ${esc(site.domain)}.
    <a href="${unsubscribeUrl}" style="color:#8A8E97;">Unsubscribe</a> — one tap, no questions, and it takes effect immediately.`;

  const text = `${look.celebrity} — ${look.event}

${pieces}, ${price}, with where to buy each one and what it would cost you
instead.

${look.url}

---
You asked for these at ${site.domain}.
Unsubscribe: ${unsubscribeUrl}`;

  return { html: SHELL(body, footer), text };
}

/**
 * The subject line, built from the look rather than fixed. Editors name events
 * freely — "Shaadi Season Look", "Mumbai Airport" — so the word "look" is only
 * added when the event has not already used it.
 */
export const lookSubject = (celebrity: string, event: string) => {
  const noun = /\blooks?\b/i.test(event) ? "" : " look";
  return `${celebrity}'s ${event}${noun}, decoded`;
};
