import { NextResponse, type NextRequest } from "next/server";
import {
  claimMailJob,
  finishMailJob,
  nextRecipients,
  recordDelivery,
  stopSubscriber,
} from "@/lib/db/mutations";
import { getSubscriberByEmail } from "@/lib/db/content";
import { lookEmail } from "@/lib/mail/templates";
import { mailConfigured, sendMail } from "@/lib/mail/transport";
import { site } from "@/lib/site-config";

/**
 * The sender. Called on a schedule, never from an admin request.
 *
 * It takes one job, writes to a batch of addresses, records every attempt and
 * returns. Whatever is left waits for the next call. Nothing here loops until
 * a list is exhausted: a serverless request has a time limit, and a send that
 * dies halfway through must be resumable rather than restarted.
 *
 * Because every attempt is written to the delivery ledger before the next one
 * begins, a run that is killed mid-batch resumes exactly where it stopped and
 * nobody is written to twice.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** An upper bound on one run. The real limit is the clock below — a batch
 *  stops early rather than being cut off mid-send by the platform. */
const BATCH = 60;

/**
 * How long a run may take before it stops and leaves the rest for next time.
 *
 * A serverless function is killed at its limit with no warning, and a send cut
 * off mid-message is a message whose outcome nobody recorded. Real SMTP takes
 * anywhere from a tenth of a second to two seconds per message, so a fixed
 * count is a guess; a clock is not. Well inside the 60s cap on Vercel's
 * smallest plan, with room for the last message to finish.
 */
const TIME_BUDGET_MS = 40_000;

/** Nobody wants a fashion newsletter at four in the morning. IST, because
 *  that is where the readers are. */
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
  // Vercel signs its own cron calls; anything else must carry the secret.
  if (!secret) return true;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const job = await claimMailJob();
  if (!job) return NextResponse.json({ idle: true });

  const hour = istHour();
  const force = request.nextUrl.searchParams.get("force") === "1";
  if (!force && (hour < OPENS_AT || hour >= CLOSES_AT)) {
    return NextResponse.json({ job: job.id, held: "outside sending hours", hour });
  }

  const recipients = await nextRecipients(job.id, BATCH);
  if (recipients.length === 0) {
    await finishMailJob(job.id, "Sent");
    return NextResponse.json({ job: job.id, finished: true, sent: job.sent, failed: job.failed });
  }

  let sent = 0;
  let failed = 0;
  let stopped = 0;
  let ranOut = false;
  const startedAt = Date.now();

  for (const email of recipients) {
    // Whatever is left is still in the queue, and the ledger already knows who
    // has been written to, so the next run picks up exactly here.
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      ranOut = true;
      break;
    }
    // Re-read the row rather than trust the list: the unsubscribe token may
    // have been used while this very batch was running.
    const subscriber = await getSubscriberByEmail(email);
    if (!subscriber || subscriber.status !== "Active") {
      await recordDelivery({
        jobId: job.id,
        email,
        status: "Skipped",
        at: new Date().toISOString(),
        detail: `No longer active (${subscriber?.status ?? "removed"})`,
      });
      stopped += 1;
      continue;
    }

    const unsubscribeUrl = `${site.url}/api/unsubscribe?token=${subscriber.unsubscribeToken}`;
    const mail = lookEmail(job, unsubscribeUrl);
    const outcome = await sendMail({
      to: email,
      subject: job.subject,
      html: mail.html,
      text: mail.text,
      unsubscribeUrl,
    });

    if (outcome.ok) {
      sent += 1;
      await recordDelivery({
        jobId: job.id,
        email,
        status: "Sent",
        at: new Date().toISOString(),
        detail: outcome.dryRun ? "Dry run" : undefined,
      });
      continue;
    }

    failed += 1;
    await recordDelivery({
      jobId: job.id,
      email,
      status: "Failed",
      at: new Date().toISOString(),
      detail: outcome.detail,
    });

    // A refusal that will not change means the address is wrong. Close it —
    // writing to it again is what ruins a sending reputation.
    if (outcome.permanent) {
      await stopSubscriber(email, "Bounced", outcome.detail);
      stopped += 1;
    }
  }

  return NextResponse.json({
    job: job.id,
    batch: recipients.length,
    sent,
    failed,
    stopped,
    // True when the clock ran out before the batch did. Not an error — the
    // rest goes on the next run.
    ...(ranOut ? { paused: "time budget reached, resuming next run" } : {}),
    dryRun: !mailConfigured(),
  });
}
