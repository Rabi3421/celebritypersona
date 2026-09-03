import "server-only";
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
 * Works through whatever is queued, until the queue is empty or the clock runs
 * out.
 *
 * Called from two places that want the same thing for different reasons: the
 * panel, immediately after somebody announces a look, so the mail leaves while
 * they are still looking at the screen; and a scheduler, as the safety net that
 * picks up anything the first attempt could not finish.
 *
 * Both are safe to run at once. Every attempt is written to the delivery ledger
 * before the next begins, and the ledger's unique (jobId, email) pair is what
 * stops two runners mailing the same person twice.
 */

/** An upper bound on one pass; the clock below is the real limit. */
const BATCH = 60;

export type DrainSummary = {
  ran: boolean;
  sent: number;
  failed: number;
  stopped: number;
  closed: { job: string; sent: number; failed: number }[];
  paused?: string;
  dryRun: boolean;
};

export async function drainQueue(budgetMs: number): Promise<DrainSummary> {
  const startedAt = Date.now();
  const budgetLeft = () => Date.now() - startedAt < budgetMs;

  const closed: DrainSummary["closed"] = [];
  let sent = 0;
  let failed = 0;
  let stopped = 0;

  while (budgetLeft()) {
    const job = await claimMailJob();
    if (!job) break;

    const recipients = await nextRecipients(job.id, BATCH);
    if (recipients.length === 0) {
      await finishMailJob(job.id, "Sent");
      closed.push({ job: job.id, sent: job.sent, failed: job.failed });
      continue;
    }

    for (const email of recipients) {
      // Whatever is left stays queued, and the ledger already knows who has
      // been written to, so the next run resumes exactly here.
      if (!budgetLeft()) break;

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
  }

  return {
    ran: closed.length > 0 || sent + failed + stopped > 0,
    sent,
    failed,
    stopped,
    closed,
    ...(budgetLeft() ? {} : { paused: "time budget reached, resuming next run" }),
    dryRun: !mailConfigured(),
  };
}
