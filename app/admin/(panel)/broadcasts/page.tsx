import Link from "next/link";
import { AnnounceForm } from "@/components/admin/AnnounceForm";
import { stopBroadcast } from "./actions";
import { getMailJobs, getOutfits, getSubscribers } from "@/lib/db/content";
import { mailConfigured } from "@/lib/mail/transport";
import { outfitSlug } from "@/lib/slugs";
import { isMailable } from "@/lib/types";
import styles from "@/app/admin/panel.module.css";

const when = new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
});
const asWhen = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : when.format(parsed);
};

export default async function AdminBroadcasts() {
  const [jobs, outfits, subscribers] = await Promise.all([
    getMailJobs(),
    getOutfits(),
    getSubscribers(),
  ]);

  const audience = subscribers.filter(isMailable).length;
  const pending = subscribers.filter((one) => one.status === "Pending").length;
  const announced = new Set(jobs.map((job) => job.outfitId));
  // Newest first, and only what has not already gone out.
  const candidates = [...outfits]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((outfit) => !announced.has(outfit.id))
    .slice(0, 12)
    .map((outfit) => ({
      id: outfit.id,
      label: `${outfit.celebrity} — ${outfit.event}`,
      slug: outfitSlug(outfit),
    }));

  return (
    <>
      {mailConfigured() ? null : (
        <div className={styles.notice}>
          <strong>Running dry — nothing will actually be sent</strong>
          <p>
            MAIL_HOST is not set, so the sender writes each message to the server
            log and marks it delivered. The whole flow works; the mail simply
            does not leave. Set the four MAIL_ variables when your sending domain
            is ready.
          </p>
        </div>
      )}

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <span>Confirmed readers</span>
          <b className={audience ? styles.ok : undefined}>{audience}</b>
          <small>Who an announcement reaches</small>
        </div>
        <div className={styles.tile}>
          <span>Waiting to confirm</span>
          <b>{pending}</b>
          <small>Asked, but have not clicked the link</small>
        </div>
        <div className={styles.tile}>
          <span>Announced</span>
          <b>{jobs.length}</b>
          <small>One announcement per look, ever</small>
        </div>
      </div>

      <AnnounceForm outfits={candidates} audience={audience} />

      {jobs.length === 0 ? (
        <div className={styles.empty}>
          <strong>Nothing has been announced</strong>
          <p>
            Publishing a look never mails anybody — announcing is a separate,
            deliberate act. Pick a look above when one is worth sending.
          </p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Look</th>
                  <th>Queued</th>
                  <th>Progress</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <Link href={`/outfits/${job.look.slug}`} target="_blank">
                        {job.look.celebrity} — {job.look.event} ↗
                      </Link>
                      {job.error ? (
                        <small className={styles.muted}> · {job.error}</small>
                      ) : null}
                    </td>
                    <td className={`${styles.num} ${styles.muted}`}>{asWhen(job.createdAt)}</td>
                    <td className={styles.num}>
                      {job.sent} sent
                      {job.failed ? ` · ${job.failed} failed` : ""}
                      <small className={styles.muted}> of {job.audience}</small>
                    </td>
                    <td>
                      <span
                        className={`${styles.status} ${
                          job.status === "Sent"
                            ? styles.good
                            : job.status === "Failed" || job.status === "Cancelled"
                              ? styles.missing
                              : ""
                        }`}
                      >
                        {job.status}
                      </span>
                      {job.status === "Queued" || job.status === "Sending" ? (
                        <form action={stopBroadcast} style={{ display: "inline" }}>
                          <input type="hidden" name="id" value={job.id} />
                          <button className={styles.rowButton} type="submit">
                            Stop
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
