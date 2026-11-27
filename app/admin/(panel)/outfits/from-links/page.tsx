import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { LinkedText } from "@/components/admin/LinkedText";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { LookFromLinksForm } from "@/components/admin/LookFromLinksForm";
import { PendingButton, PendingLink } from "@/components/admin/PendingButton";
import { getAllOutfits } from "@/lib/db/content";
import { listLookJobs, runnerLastSeen } from "@/lib/db/look-jobs";
import { canCancel, openChecks, type LookJob } from "@/lib/look-jobs";
import type { Outfit } from "@/lib/types";
import styles from "@/app/admin/panel.module.css";
import local from "@/components/admin/look-jobs.module.css";
import { cancelLookJobAction, removeLookJobAction, retryLookJobAction } from "./actions";

/**
 * New look from links, as three steps:
 *   1. Add the look (the form).
 *   2. Claude researches it on the editor's computer (npm run looks:runner).
 *   3. Review & publish: the draft's review page, where the checks are ticked
 *      off and Publish unlocks.
 * Every look on the page says which step it is at, in words, with one button.
 */

/** Always the queue as it stands; a cached list would hide the runner's progress. */
export const dynamic = "force-dynamic";

/** The runner asks for work about once a minute; silent longer than this means it is off. */
const RUNNER_SILENT_MS = 3 * 60_000;

const when = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const clock = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const byLabel = (by: string[]) => by.map((name) => name.charAt(0).toUpperCase() + name.slice(1)).join(" + ");

/** What a job is about: the draft's names once researched, else the name typed in the form. */
function jobTitle(job: LookJob, outfit?: Outfit): { title: string; sub?: string } {
  if (outfit) return { title: outfit.celebrity, sub: outfit.event };
  const scout = job.note?.match(/^Scout: (.+?), (.+?)(?: \(\d{4}-\d{2}-\d{2}\))?\.?$/);
  if (scout) return { title: scout[1], sub: scout[2] };
  const post = job.instagramUrl.match(/instagram\.com\/(?:[^/]+\/)?(p|reel)\/([^/?#]+)/);
  const kind = post ? `Instagram ${post[1] === "reel" ? "reel" : "post"}` : "Instagram post";
  return job.celebrity ? { title: job.celebrity, sub: kind } : { title: post ? `${kind} ${post[2]}` : kind };
}

function Thumb({ src, label }: { src?: string; label: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={local.thumb} src={src} alt="" />
  ) : (
    <span className={`${local.thumb} ${local.thumbEmpty}`} aria-hidden="true">
      {label.split(/\s+/).slice(0, 2).map((word) => word.charAt(0)).join("").toUpperCase()}
    </span>
  );
}

function Links({ job }: { job: LookJob }) {
  return (
    <div className={local.links}>
      <a href={job.instagramUrl} target="_blank" rel="noreferrer">
        Instagram post ↗
      </a>
      {job.buyUrls.map((url) => (
        <a key={url} href={url} target="_blank" rel="noreferrer">
          {host(url)} ↗
        </a>
      ))}
      {(job.alternateUrls ?? []).map((url) => (
        <a key={url} href={url} target="_blank" rel="noreferrer">
          alternate: {host(url)} ↗
        </a>
      ))}
    </div>
  );
}

function RemoveButton({ job }: { job: LookJob }) {
  return (
    <form action={removeLookJobAction}>
      <input type="hidden" name="id" value={job.id} />
      <ConfirmButton
        className={local.textButton}
        title="Remove from this list?"
        message={job.outfitId ? "Only the entry here is removed. The draft look stays in Outfits." : "The entry and its uploaded photo are removed."}
        confirmLabel="Remove"
        pendingLabel="Removing…"
      >
        Remove
      </ConfirmButton>
    </form>
  );
}

/** Step 3: a draft ready for the editor. One way in: Review & publish. */
function ReviewCard({ job, outfit }: { job: LookJob; outfit?: Outfit }) {
  const { title, sub } = jobTitle(job, outfit);
  const total = job.findings?.checks.length ?? 0;
  const open = openChecks(job).length;
  const photo = outfit?.images?.[0]?.url ?? outfit?.image?.url ?? job.photo?.url;
  return (
    <li className={local.card}>
      <Thumb src={photo} label={title} />
      <div className={local.body}>
        <h3 className={local.title}>
          {title}
          {sub ? <span> · {sub}</span> : null}
        </h3>
        <p className={`${local.state} ${local.stateReady}`}>
          Ready to review{open ? ` · ${plural(open, "thing")} to check before publishing` : " · nothing left to check"}
        </p>
        <p className={local.meta}>
          {job.findings?.by.length ? `Researched by ${byLabel(job.findings.by)} · ` : ""}
          ready {when.format(new Date(job.finishedAt ?? job.updatedAt))}
          {total && open < total ? ` · ${total - open} of ${total} checked` : ""}
        </p>
        <Links job={job} />
      </div>
      <div className={local.actions}>
        {job.outfitId ? (
          <PendingLink href={`/admin/preview/${job.outfitId}`} className={`${styles.newButton} ${local.primary}`} pendingLabel="Opening…">
            Review &amp; publish →
          </PendingLink>
        ) : null}
        <RemoveButton job={job} />
      </div>
    </li>
  );
}

/** Step 2: waiting for, or with, Claude. Says why it is waiting. */
function ProgressCard({ job, runnerOn }: { job: LookJob; runnerOn: boolean }) {
  const { title, sub } = jobTitle(job);
  const running = job.status === "running";
  return (
    <li className={`${local.card} ${local.compact}`}>
      <span className={`${local.dot} ${running ? local.dotLive : ""}`} aria-hidden="true" />
      <div className={local.body}>
        <h3 className={local.title}>
          {title}
          {sub ? <span> · {sub}</span> : null}
        </h3>
        {running ? (
          <>
            <p className={`${local.state} ${local.stateLive}`}>Claude is researching · started {clock.format(new Date(job.startedAt ?? job.updatedAt))} · usually 5–10 minutes</p>
            <div className={local.live} aria-hidden="true">
              <span />
            </div>
          </>
        ) : (
          <p className={`${local.state} ${local.stateWait}`}>
            {runnerOn ? "Waiting to start · it starts within a minute" : "Waiting to start · the research computer is off (see above)"}
          </p>
        )}
        <p className={local.meta}>Added {when.format(new Date(job.createdAt))}</p>
        <Links job={job} />
      </div>
      <div className={local.actions}>
        {canCancel(job.status) ? (
          <form action={cancelLookJobAction}>
            <input type="hidden" name="id" value={job.id} />
            <ConfirmButton
              className={local.textButton}
              title="Cancel this research?"
              message="It is skipped, or stopped before a draft is saved if it has already started."
              confirmLabel="Cancel research"
              pendingLabel="Cancelling…"
            >
              Cancel
            </ConfirmButton>
          </form>
        ) : null}
      </div>
    </li>
  );
}

/** Failed or cancelled: why, and one way to run it again. */
function ProblemCard({ job }: { job: LookJob }) {
  const { title, sub } = jobTitle(job);
  const failed = job.status === "failed";
  return (
    <li className={`${local.card} ${local.compact}`}>
      <span className={`${local.dot} ${failed ? local.dotBad : ""}`} aria-hidden="true" />
      <div className={local.body}>
        <h3 className={local.title}>
          {title}
          {sub ? <span> · {sub}</span> : null}
        </h3>
        <p className={`${local.state} ${local.stateBad}`}>{failed ? "Research didn't finish" : "Cancelled"}</p>
        {failed ? (
          <p className={local.error}>
            <LinkedText className={local.inlineLink} text={job.error ?? "No reason recorded."} />
          </p>
        ) : null}
        <p className={local.meta}>{when.format(new Date(job.finishedAt ?? job.updatedAt))}</p>
        <Links job={job} />
      </div>
      <div className={local.actions}>
        <form action={retryLookJobAction}>
          <input type="hidden" name="id" value={job.id} />
          <PendingButton className={`${styles.newButton} ${local.primary}`} pendingLabel="Starting again…">
            Try again
          </PendingButton>
        </form>
        <RemoveButton job={job} />
      </div>
    </li>
  );
}

function Section({ id, title, note, count, children }: { id: string; title: string; note?: string; count?: number; children: React.ReactNode }) {
  return (
    <section className={local.section} id={id} aria-labelledby={`${id}-title`}>
      <div className={local.sectionHead}>
        <h2 id={`${id}-title`}>
          {title}
          {count ? <span className={local.count}>{count}</span> : null}
        </h2>
        {note ? <p>{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default async function LookFromLinksPage({ searchParams }: { searchParams: Promise<{ queued?: string }> }) {
  const [{ queued }, allJobs, outfits, lastSeen] = await Promise.all([searchParams, listLookJobs(), getAllOutfits(), runnerLastSeen().catch(() => null)]);
  const byId = new Map(outfits.map((outfit) => [outfit.id, outfit]));
  // A look leaves this page once its draft is published (the research record is kept).
  const isPublished = (job: LookJob) => job.outfitId !== undefined && byId.get(job.outfitId)?.status === "published";
  const jobs = allJobs.filter((job) => !isPublished(job));
  const done = allJobs.length - jobs.length;

  const review = jobs.filter((job) => job.status === "drafted");
  const inProgress = jobs.filter((job) => canCancel(job.status)).reverse(); // oldest first: the order they run
  const problems = jobs.filter((job) => job.status === "failed" || job.status === "cancelled");
  const running = inProgress.some((job) => job.status === "running");
  const waiting = inProgress.some((job) => job.status === "queued");
  // eslint-disable-next-line react-hooks/purity -- a server render; "now" is when the page was asked for
  const runnerOn = lastSeen !== null && Date.now() - lastSeen.getTime() < RUNNER_SILENT_MS;
  const justQueued = queued ? jobs.find((job) => job.id === queued) : undefined;

  const step = review.length ? 3 : inProgress.length ? 2 : 1;
  const steps = [
    { n: 1, title: "Add the look", text: "Fill in the form below and press Start research." },
    { n: 2, title: "Claude researches it", text: "About 5–10 minutes, on your computer (npm run looks:runner)." },
    { n: 3, title: "Review & publish", text: "Check the draft, add the real photo, press Publish." },
  ];

  return (
    <div className={local.page}>
      {inProgress.length ? <AutoRefresh seconds={15} /> : null}

      <ol className={local.steps} aria-label="How a new look is made">
        {steps.map((s) => (
          <li key={s.n} className={`${local.step} ${s.n === step ? local.stepActive : ""}`} aria-current={s.n === step ? "step" : undefined}>
            <b>{s.n}</b>
            <span>
              <strong>{s.title}</strong>
              <small>{s.text}</small>
            </span>
          </li>
        ))}
      </ol>

      {waiting && !running && !runnerOn ? (
        <div className={local.banner} role="status">
          <span aria-hidden="true">⏸</span>
          <span>
            <strong>Research hasn&apos;t started: the research computer is off.</strong> On the computer where Claude Code is signed in, open
            the project folder and run <code>npm run looks:runner</code>. Waiting looks start within a minute.
            {lastSeen ? ` Last seen ${when.format(lastSeen)}.` : ""}
          </span>
        </div>
      ) : justQueued && canCancel(justQueued.status) ? (
        <div className={`${local.banner} ${local.bannerOk}`} role="status">
          <span aria-hidden="true">✓</span>
          <span>
            <strong>Research started for {jobTitle(justQueued).title}.</strong> This page updates by itself, and Slack tells you in #look-scout when the
            draft is ready.
          </span>
        </div>
      ) : null}

      {review.length ? (
        <Section id="review" title="Ready to review" count={review.length} note="Open each draft, check what Claude flagged, add the real photo, then publish.">
          <ul className={local.list}>
            {review.map((job) => (
              <ReviewCard key={job.id} job={job} outfit={job.outfitId ? byId.get(job.outfitId) : undefined} />
            ))}
          </ul>
        </Section>
      ) : null}

      {problems.length ? (
        <Section id="problems" title="Didn't work" count={problems.length} note="Try again, or remove it.">
          <ul className={local.list}>
            {problems.map((job) => (
              <ProblemCard key={job.id} job={job} />
            ))}
          </ul>
        </Section>
      ) : null}

      {inProgress.length ? (
        <Section id="progress" title="Being researched" count={inProgress.length} note="This list updates by itself.">
          <ul className={local.list}>
            {inProgress.map((job) => (
              <ProgressCard key={job.id} job={job} runnerOn={runnerOn || running} />
            ))}
          </ul>
        </Section>
      ) : null}

      <Section id="add" title="Add a look" note="The same fields as your sheet. Only the celebrity, the original outfit link and the Instagram post are required.">
        <div className={local.formBox}>
          {/* Keyed by the look just queued, so the next one starts with an empty form. */}
          <LookFromLinksForm key={queued ?? "new"} />
        </div>
      </Section>

      {done ? (
        <p className={local.footnote}>
          {plural(done, "researched look")} {done === 1 ? "is" : "are"} published and no longer listed here.
        </p>
      ) : null}
    </div>
  );
}
