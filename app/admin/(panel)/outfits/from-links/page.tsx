import Link from "next/link";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { LookFromLinksForm } from "@/components/admin/LookFromLinksForm";
import { getAllOutfits } from "@/lib/db/content";
import { listLookJobs } from "@/lib/db/look-jobs";
import { canCancel, STATUS_LABEL, type LookJob } from "@/lib/look-jobs";
import styles from "@/app/admin/panel.module.css";
import local from "@/components/admin/look-jobs.module.css";
import { listSuggestions } from "@/lib/db/look-suggestions";
import type { LookSuggestion } from "@/lib/look-suggestions";
import { cancelLookJobAction, dismissSuggestionAction, queueSuggestionAction, removeLookJobAction } from "./actions";

function SuggestionRow({ suggestion }: { suggestion: LookSuggestion }) {
  return (
    <li className={local.job} id={`suggestion-${suggestion.id}`}>
      <span className={`${local.thumb} ${local.thumbEmpty}`}>{suggestion.score}/10</span>
      <div className={local.jobMain}>
        <strong>
          {suggestion.celebrity} · {suggestion.event}
        </strong>
        <div className={local.jobMeta}>
          {suggestion.date} · {suggestion.why}
        </div>
        <div className={local.jobMeta}>
          <a href={suggestion.instagramUrl} target="_blank" rel="noreferrer">
            Instagram post ↗
          </a>
          {suggestion.buyUrls.map((url) => (
            <span key={url}>
              {" · "}
              <a href={url} target="_blank" rel="noreferrer">
                {host(url)} ↗
              </a>
            </span>
          ))}
        </div>
      </div>
      <div className={local.jobActions}>
        <form action={queueSuggestionAction}>
          <input type="hidden" name="id" value={suggestion.id} />
          <button type="submit" className={styles.newButton}>
            Queue research
          </button>
        </form>
        <form action={dismissSuggestionAction}>
          <input type="hidden" name="id" value={suggestion.id} />
          <button type="submit" className={styles.ghost}>
            Dismiss
          </button>
        </form>
      </div>
    </li>
  );
}

/** Always the queue as it stands; a cached list would hide the runner's progress. */
export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

function JobRow({ job }: { job: LookJob }) {
  return (
    <li className={local.job}>
      {job.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={local.thumb} src={job.photo.url} alt="" />
      ) : (
        <span className={`${local.thumb} ${local.thumbEmpty}`}>no photo</span>
      )}
      <div className={local.jobMain}>
        <a href={job.instagramUrl} target="_blank" rel="noreferrer">
          {job.instagramUrl.replace("https://www.", "")}
        </a>
        <div className={local.jobMeta}>
          {job.buyUrls.map(host).join(" · ")} · added {when.format(new Date(job.createdAt))}
        </div>
        {job.note ? <div className={local.jobMeta}>“{job.note}”</div> : null}
        {job.error ? <div className={local.jobError}>{job.error}</div> : null}
        {job.findings ? (
          <details className={local.findings} open={job.status === "drafted"}>
            <summary>
              {job.findings.checks.length
                ? `${job.findings.checks.length} thing${job.findings.checks.length === 1 ? "" : "s"} to check before publishing`
                : "Nothing flagged"}{" "}
              · {job.findings.evidence.length} sourced facts
              {job.findings.by.length ? ` · researched by ${job.findings.by.join(" + ")}` : ""}
            </summary>
            {job.findings.checks.length ? (
              <ol className={local.checks}>
                {job.findings.checks.map((check) => (
                  <li key={check}>{check}</li>
                ))}
              </ol>
            ) : null}
            <ul className={local.evidence}>
              {job.findings.evidence.map((item) => (
                <li key={item.claim}>
                  <span className={local[`c_${item.confidence}`]}>{item.confidence}</span> {item.claim}{" "}
                  {item.sources.map((source, index) => (
                    <a href={source} key={source} rel="noreferrer" target="_blank">
                      [{index + 1}]
                    </a>
                  ))}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
      <div className={local.jobActions}>
        <span className={`${local.badge} ${local[job.status]}`}>{STATUS_LABEL[job.status]}</span>
        {job.status === "drafted" && job.outfitId ? (
          <Link href={`/admin/preview/${job.outfitId}`}>Review draft →</Link>
        ) : null}
        {canCancel(job.status) ? (
          <form action={cancelLookJobAction}>
            <input type="hidden" name="id" value={job.id} />
            <ConfirmButton
              className={styles.ghost}
              title="Cancel this research?"
              message="The runner skips it, or stops before saving a draft if it has already started."
              confirmLabel="Cancel research"
              pendingLabel="Cancelling…"
            >
              Cancel
            </ConfirmButton>
          </form>
        ) : (
          <form action={removeLookJobAction}>
            <input type="hidden" name="id" value={job.id} />
            <ConfirmButton
              className={styles.ghost}
              title="Remove from this list?"
              message={
                job.outfitId
                  ? "Only the job is removed. The draft outfit and its photo stay."
                  : "The job and its uploaded photo are removed."
              }
              confirmLabel="Remove"
              pendingLabel="Removing…"
            >
              Remove
            </ConfirmButton>
          </form>
        )}
      </div>
    </li>
  );
}

export default async function LookFromLinksPage({
  searchParams,
}: {
  searchParams: Promise<{ queued?: string }>;
}) {
  const [{ queued }, allJobs, outfits, allSuggestions] = await Promise.all([
    searchParams,
    listLookJobs(),
    getAllOutfits(),
    listSuggestions(),
  ]);
  // Only what still waits for a decision, newest batch first.
  const suggestions = allSuggestions.filter((suggestion) => suggestion.status === "suggested");
  // A job's work is done once the editor publishes its draft: it leaves the
  // queue. (The job record stays, so the research behind a look is kept.)
  const published = new Set(outfits.filter((outfit) => outfit.status === "published").map((outfit) => outfit.id));
  const jobs = allJobs.filter((job) => !(job.outfitId && published.has(job.outfitId)));
  const done = allJobs.length - jobs.length;
  const waiting = jobs.filter((job) => job.status === "queued").length;

  return (
    <>
      {queued ? (
        <div className={styles.notice} role="status">
          <strong>Research queued.</strong>
          <p>
            The runner on your computer picks it up and saves a draft outfit; you review it before anything is
            published. Add the next look whenever you like.
          </p>
        </div>
      ) : null}

      {suggestions.length ? (
        <section className={styles.section} id="suggestions">
          <div className={styles.sectionHead}>
            <h2>Suggested by the morning scout</h2>
            <p className={local.jobMeta}>
              Recent celebrity looks worth decoding, found by Claude each morning. Nothing is researched until you queue it.
            </p>
          </div>
          <ul className={local.jobs}>
            {suggestions.map((suggestion) => (
              <SuggestionRow suggestion={suggestion} key={suggestion.id} />
            ))}
          </ul>
        </section>
      ) : null}

      {/* Keyed by the job just queued, so the next look starts with an empty form. */}
      <LookFromLinksForm key={queued ?? "new"} />

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Research queue</h2>
          <p className={local.jobMeta}>
            {waiting
              ? `${waiting} waiting. Jobs run while the runner is on: npm run looks:runner`
              : "Jobs run while the runner on your computer is on."}
          </p>
        </div>
        {jobs.length ? (
          <ul className={local.jobs}>
            {jobs.map((job) => (
              <JobRow job={job} key={job.id} />
            ))}
          </ul>
        ) : (
          <div className={styles.empty}>
            {done ? "Nothing waiting or to review. Paste the next look above." : "No looks queued yet. Paste the first one above."}
          </div>
        )}
        {done ? (
          <p className={local.jobMeta} style={{ marginTop: 12 }}>
            {done} researched look{done === 1 ? " is" : "s are"} published and no longer listed here.
          </p>
        ) : null}
      </section>
    </>
  );
}
