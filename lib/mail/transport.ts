import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * The last hop, and the only part of this system that is somebody else's.
 *
 * Everything above it — the list, the consent record, the queue, the
 * unsubscribe — lives in our own database. This file is a pipe, configured by
 * four environment variables, so moving between a self-hosted Postfix, SES or
 * anything else is a deploy setting rather than a rewrite.
 *
 * With nothing configured it runs dry: messages are logged, never sent, and
 * reported as such all the way up to the panel. That is deliberate — the whole
 * flow can be rehearsed before a single DNS record exists.
 */

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** One-click unsubscribe, which Gmail and Yahoo require of bulk senders and
   *  which every reader deserves regardless. */
  unsubscribeUrl?: string;
};

export type SendOutcome =
  | { ok: true; dryRun: boolean; detail?: string }
  /** Permanent means the address is wrong or refuses us: never retry, and take
   *  it off the list. Transient means try again later. */
  | { ok: false; permanent: boolean; detail: string };

export const mailFrom = () =>
  process.env.MAIL_FROM ?? "CelebrityPersona <looks@celebritypersona.com>";

/** "Name <address>" split into the parts an HTTP API wants. */
function fromParts() {
  const raw = mailFrom();
  const match = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match
    ? { name: match[1] || "CelebrityPersona", email: match[2] }
    : { name: "CelebrityPersona", email: raw.trim() };
}

export const mailConfigured = () =>
  Boolean(process.env.BREVO_API_KEY || process.env.MAIL_HOST);

/**
 * Which way out.
 *
 * SMTP is the portable one and works anywhere. The HTTP API exists because
 * providers that allowlist SMTP by IP cannot be used from a deployed site at
 * all: a serverless platform calls from an address pool that changes by the
 * hour and cannot be enumerated, let alone registered. An API key is not tied
 * to a location, so it is what production uses.
 */
const via = () =>
  process.env.BREVO_API_KEY ? "api" : process.env.MAIL_HOST ? "smtp" : "dry";

let cached: Transporter | null = null;

function transport(): Transporter | null {
  if (!mailConfigured()) return null;
  if (cached) return cached;

  const port = Number(process.env.MAIL_PORT ?? 587);
  cached = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port,
    // 465 is implicit TLS; 587 and 25 start plain and upgrade with STARTTLS.
    secure: port === 465,
    auth: process.env.MAIL_USER
      ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS ?? "" }
      : undefined,
    // A stuck connection must not hold a batch open.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return cached;
}

/**
 * SMTP replies in the 5xx range are refusals that will not change: a mailbox
 * that does not exist, a domain that does not resolve, a server that has
 * decided against us. 4xx is a full mailbox or a busy server, and is worth
 * another attempt.
 */
function isPermanent(error: unknown): boolean {
  const code = (error as { responseCode?: number })?.responseCode;
  if (typeof code === "number") return code >= 500 && code < 600;
  const name = (error as { code?: string })?.code ?? "";
  // A domain that does not resolve is not going to start resolving.
  return name === "EENVELOPE" || name === "ENOTFOUND";
}

/** Brevo's transactional endpoint. Same message, no IP allowlist. */
async function sendViaApi(
  message: MailMessage,
  headers: Record<string, string> | undefined,
): Promise<SendOutcome> {
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY as string,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: fromParts(),
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
        ...(headers ? { headers } : {}),
      }),
    });

    if (response.ok) {
      const body = (await response.json().catch(() => ({}))) as { messageId?: string };
      return { ok: true, dryRun: false, detail: body.messageId };
    }

    const detail = await response.text().catch(() => response.statusText);
    // 400 is a rejected address or payload and will not improve on a retry.
    // 401 and 403 are a misconfigured key — also permanent, and worth shouting
    // about rather than retrying quietly into a rate limit.
    const permanent = response.status === 400 || response.status === 401 || response.status === 403;
    return { ok: false, permanent, detail: `${response.status} ${detail}`.slice(0, 300) };
  } catch (error) {
    return {
      ok: false,
      permanent: false,
      detail: error instanceof Error ? error.message : "Unknown API error",
    };
  }
}

export async function sendMail(message: MailMessage): Promise<SendOutcome> {
  const headers = message.unsubscribeUrl
    ? {
        "List-Unsubscribe": `<${message.unsubscribeUrl}>`,
        // RFC 8058. Without this header the one-click button does not appear.
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      }
    : undefined;

  if (via() === "api") return sendViaApi(message, headers);

  const post = transport();
  if (!post) {
    console.info(
      `[mail:dry-run] would send "${message.subject}" to ${message.to}`,
    );
    return { ok: true, dryRun: true, detail: "Dry run — no mail transport configured" };
  }

  try {
    const info = await post.sendMail({
      from: mailFrom(),
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      headers,
    });
    return { ok: true, dryRun: false, detail: info.messageId };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Unknown sending error";
    return { ok: false, permanent: isPermanent(error), detail };
  }
}
