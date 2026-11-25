import Link from "next/link";
import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { LinkedText } from "@/components/admin/LinkedText";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { LookFromLinksForm } from "@/components/admin/LookFromLinksForm";
import { getAllOutfits } from "@/lib/db/content";
import { listLookJobs } from "@/lib/db/look-jobs";
import { listSuggestions } from "@/lib/db/look-suggestions";
import { canCancel, openChecks, type LookJob } from "@/lib/look-jobs";
import type { LookSuggestion } from "@/lib/look-suggestions";
import type { Outfit } from "@/lib/types";
import styles from "@/app/admin/panel.module.css";
import local from "@/components/admin/look-jobs.module.css";
import {
  cancelLookJobAction,
  dismissSuggestionAction,
  queueSuggestionAction,
  removeLookJobAction,
  retryLookJobAction,
} from "./actions";

/** Always the queue as it stands; a cached list would hide the runner's progress. */
export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});
const day = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short" });

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const byLabel = (by: string[]) => by.map((name) => name.charAt(0).toUpperCase() + name.slice(1)).join(" + ");

/** What a job is about, before and after research: the draft's names, else the scout's note, else the post. */
function jobTitle(job: LookJob, outfit?: Outfit): { title: string; sub?: string } {
  if (outfit) return { title: outfit.celebrity, sub: outfit.event };
  const scout = job.note?.match(/^Scout: (.+?), (.+?)(?: \(\d{4}-\d{2}-\d{2}\))?\.?$/);
  if (scout) return { title: scout[1], sub: scout[2] };
  const post = job.instagramUrl.match(/instagram\.com\/(?:[^/]+\/)?(p|reel)\/([^/?#]+)/);
  if (job.celebrity) return { title: job.celebrity, sub: post ? `Instagram ${post[1] === "reel" ? "reel" : "post"}` : job.note };
  return { title: post ? `Instagram ${post[1] === "reel" ? "reel" : "post"} ${post[2]}` : "Instagram post", sub: job.note };
}

function Thumb({ src, label }: { src?: string; label: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={local.thumb} src={src} alt="" />
  ) : (
    <span className={`${local.thumb} ${local.thumbEmpty}`} aria-hidden="true">
      {label
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word.charAt(0))
        .join("")
        .toUpperCase()}
    </span>
  );
}

function Links({ job }: { job: Pick<LookJob, "instagramUrl" | "buyUrls" | "celebrityInstagram" | "labelUrl" | "alternateUrls"> }) {
  return (
    <div className={local.links}>
      <a href={job.instagramUrl} target="_blank" rel="noreferrer">
        Instagram ↗
      </a>
      {job.buyUrls.map((url) => (
        <a key={url} href={url} target="_blank" rel="noreferrer">
          {host(url)} ↗
        </a>
      ))}
      {job.celebrityInstagram ? (
        <a href={job.celebrityInstagram} target="_blank" rel="noreferrer">
          @{job.celebrityInstagram.replace(/^https:\/\/www\.instagram\.com\/|\/$/g, "")} ↗
        </a>
      ) : null}
      {job.labelUrl && !job.buyUrls.some((url) => host(url) === host(job.labelUrl!)) ? (
        <a href={job.labelUrl} target="_blank" rel="noreferrer">
          {host(job.labelUrl)} ↗
        </a>
      ) : null}
      {(job.alternateUrls ?? []).map((url) => (
        <a key={url} href={url} target="_blank" rel="noreferrer">
          alt: {host(url)} ↗
        </a>
      ))}
    </div>
  );
}

function RemoveButton({ job, label = "Remove" }: { job: LookJob; label?: string }) {
  return (
    <form action={removeLookJobAction}>
      <input type="hidden" name="id" value={job.id} />
      <ConfirmButton
        className={local.textButton}
        title="Remove from this list?"
        message={job.outfitId ? "Only the job is removed. The draft outfit and its photo stay." : "The job and its uploaded photo are removed."}
        confirmLabel="Remove"
        pendingLabel="Removing…"
      >
        {label}
      </ConfirmButton>
    </form>
  );
}

/** A draft waiting for the editor: who, how much is left to check, one clear way in. */
function ReviewCard({ job, outfit }: { job: LookJob; outfit?: Outfit }) {
  const { title, sub } = jobTitle(job, outfit);
  const checks = job.findings?.checks ?? [];
  const open = openChecks(job);
  const evidence = job.findings?.evidence ?? [];
  const confirmed = evidence.filter((item) => item.confidence === "confirmed").length;
  const photo = outfit?.images?.[0]?.url ?? outfit?.image?.url ?? job.photo?.url;
  const href = job.outfitId ? `/admin/preview/${job.outfitId}` : null;
  return (
    <li className={local.card}>
      <Thumb src={photo} label={title} />
      <div className={local.body}>
        <h3 className={local.title}>
          {title}
          {sub ? <span> · {sub}</span> : null}
        </h3>
        <p className={local.meta}>
          {job.findings?.by.length ? `Researched by ${byLabel(job.findings.by)} · ` : ""}
          ready {when.format(new Date(job.finishedAt ?? job.updatedAt))}
        </p>
        <div className={local.chips}>
          {checks.length ? (
            open.length ? (
              <span className={`${local.chip} ${local.chipWarn}`}>
                {open.length === checks.length
                  ? `${plural(checks.length, "check")} to do`
                  : `${open.length} of ${plural(checks.length, "check")} left`}
              </span>
            ) : (
              <span className={`${local.chip} ${local.chipOk}`}>All checks done</span>
            )
          ) : (
            <span className={`${local.chip} ${local.chipOk}`}>Nothing flagged</span>
          )}
          {photo ? null : <span className={local.chip}>Needs the real photo</span>}
          {evidence.length ? (
            <span className={local.chip}>
              {plural(evidence.length, "sourced fact")} · {confirmed} confirmed
            </span>
          ) : null}
        </div>
        {checks.length && open.length < checks.length ? (
          <div className={local.progress} aria-hidden="true">
            <span style={{ width: `${((checks.length - open.length) / checks.length) * 100}%` }} />
          </div>
        ) : null}
        {open.length ? (
          <details className={local.more}>
            <summary>What to check ({open.length})</summary>
            <ol className={local.checks}>
              {open.map((check) => (
                <li key={check}>
                  <LinkedText className={local.inlineLink} text={check} />
                </li>
              ))}
            </ol>
            <p className={local.hint}>You tick these off on the review page; Publish unlocks when all are done.</p>
          </details>
        ) : null}
        {evidence.length ? (
          <details className={local.more}>
            <summary>Sourced facts ({evidence.length})</summary>
            <ul className={local.evidence}>
              {evidence.map((item) => (
                <li key={item.claim}>
                  <span className={local[`c_${item.confidence}`]}>{item.confidence}</span> {item.claim}{" "}
                  {item.sources.map((source, index) => (
                    <a href={source} key={source} rel="noreferrer" target="_blank" title={host(source)}>
                      [{index + 1}]
                    </a>
                  ))}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <Links job={job} />
      </div>
      <div className={local.actions}>
        {href ? (
          <Link href={href} className={`${styles.newButton} ${local.primary}`}>
            Review draft →
          </Link>
        ) : null}
        <RemoveButton job={job} label="Remove from list" />
      </div>
    </li>
  );
}

/** Waiting for, or with, the runner. */
function ProgressCard({ job }: { job: LookJob }) {
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
        <p className={local.meta}>
          {running
            ? `Researching since ${when.format(new Date(job.startedAt ?? job.updatedAt))} · usually 5–10 minutes`
            : `Waiting for the runner · added ${when.format(new Date(job.createdAt))}`}
        </p>
        <Links job={job} />
      </div>
      <div className={local.actions}>
        {canCancel(job.status) ? (
          <form action={cancelLookJobAction}>
            <input type="hidden" name="id" value={job.id} />
            <ConfirmButton
              className={local.textButton}
              title="Cancel this research?"
              message="The runner skips it, or stops before saving a draft if it has already started."
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

/** Failed or cancelled: say why, offer to run it again. */
function ProblemCard({ job }: { job: LookJob }) {
  const { title, sub } = jobTitle(job);
  return (
    <li className={`${local.card} ${local.compact}`}>
      <span className={`${local.dot} ${job.status === "failed" ? local.dotBad : ""}`} aria-hidden="true" />
      <div className={local.body}>
        <h3 className={local.title}>
          {title}
          {sub ? <span> · {sub}</span> : null}
        </h3>
        <p className={job.status === "failed" ? local.error : local.meta}>
          {job.status === "failed" ? <LinkedText className={local.inlineLink} text={job.error ?? "No reason recorded."} /> : "Cancelled"}
          {" · "}
          {when.format(new Date(job.finishedAt ?? job.updatedAt))}
        </p>
        <Links job={job} />
      </div>
      <div className={local.actions}>
        <form action={retryLookJobAction}>
          <input type="hidden" name="id" value={job.id} />
          <button type="submit" className={styles.ghost}>
            Try again
          </button>
        </form>
        <RemoveButton job={job} />
      </div>
    </li>
  );
}

function SuggestionCard({ suggestion }: { suggestion: LookSuggestion }) {
  return (
    <li className={local.card} id={`suggestion-${suggestion.id}`}>
      <span className={`${local.thumb} ${local.score}`}>
        <b>{suggestion.score}</b>
        <small>/10</small>
      </span>
      <div className={local.body}>
        <h3 className={local.title}>
          {suggestion.celebrity}
          <span> · {suggestion.event}</span>
        </h3>
        <p className={local.meta}>Worn {day.format(new Date(`${suggestion.date}T00:00:00Z`))}</p>
        <p className={local.why}>{suggestion.why}</p>
        <Links job={suggestion} />
      </div>
      <div className={local.actions}>
        <form action={queueSuggestionAction}>
          <input type="hidden" name="id" value={suggestion.id} />
          <button type="submit" className={`${styles.newButton} ${local.primary}`}>
            Research this look
          </button>
        </form>
        <form action={dismissSuggestionAction}>
          <input type="hidden" name="id" value={suggestion.id} />
          <button type="submit" className={local.textButton}>
            Not this one
          </button>
        </form>
      </div>
    </li>
  );
}

function Section({
  id,
  title,
  note,
  count,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  count?: number;
  children: React.ReactNode;
}) {
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
  const suggestions = allSuggestions.filter((suggestion) => suggestion.status === "suggested");
  const byId = new Map(outfits.map((outfit) => [outfit.id, outfit]));
  // A job's work is done once the editor publishes its draft: it leaves the
  // queue. (The job record stays, so the research behind a look is kept.)
  const isPublished = (job: LookJob) => job.outfitId !== undefined && byId.get(job.outfitId)?.status === "published";
  const jobs = allJobs.filter((job) => !isPublished(job));
  const done = allJobs.length - jobs.length;

  const review = jobs.filter((job) => job.status === "drafted");
  // Oldest first: that is the order the runner takes them.
  const inProgress = jobs.filter((job) => canCancel(job.status)).reverse();
  const problems = jobs.filter((job) => job.status === "failed" || job.status === "cancelled");
  const running = inProgress.some((job) => job.status === "running");

  const summary = [
    review.length ? { href: "#review", label: `${review.length} to review`, tone: local.sumWarn } : null,
    suggestions.length ? { href: "#suggestions", label: `${suggestions.length} suggested`, tone: "" } : null,
    inProgress.length ? { href: "#progress", label: running ? `${inProgress.length} researching` : `${inProgress.length} waiting`, tone: "" } : null,
    problems.length ? { href: "#problems", label: `${problems.length} failed`, tone: local.sumBad } : null,
  ].filter((item) => item !== null);

  return (
    <div className={local.page}>
      {inProgress.length ? <AutoRefresh seconds={20} /> : null}

      {queued ? (
        <div className={styles.notice} role="status">
          <strong>Research queued.</strong>
          <p>
            The runner on your computer picks it up and saves a draft (usually 5–10 minutes). This page updates by itself, and
            Slack tells you in #look-scout when it is ready.
          </p>
        </div>
      ) : null}

      <nav className={local.summary} aria-label="Queue summary">
        {summary.length ? (
          summary.map((item) => (
            <a key={item.href} href={item.href} className={`${local.sum} ${item.tone}`}>
              {item.label}
            </a>
          ))
        ) : (
          <span className={local.sumQuiet}>All clear: nothing to review or waiting.</span>
        )}
        <a href="#add" className={local.sumAdd}>
          + Add a look
        </a>
      </nav>

      {review.length ? (
        <Section
          id="review"
          title="Ready to review"
          count={review.length}
          note="Open each draft, tick off the checks, add the real photo, then publish."
        >
          <ul className={local.list}>
            {review.map((job) => (
              <ReviewCard key={job.id} job={job} outfit={job.outfitId ? byId.get(job.outfitId) : undefined} />
            ))}
          </ul>
        </Section>
      ) : null}

      {suggestions.length ? (
        <Section
          id="suggestions"
          title="Suggested by the morning scout"
          count={suggestions.length}
          note="Fresh looks found by Claude this morning. Nothing is researched until you choose it."
        >
          <ul className={local.list}>
            {suggestions.map((suggestion) => (
              <SuggestionCard suggestion={suggestion} key={suggestion.id} />
            ))}
          </ul>
        </Section>
      ) : null}

      {inProgress.length ? (
        <Section
          id="progress"
          title="Being researched"
          count={inProgress.length}
          note="Runs while the runner on your computer is on (npm run looks:runner). This list updates by itself."
        >
          <ul className={local.list}>
            {inProgress.map((job) => (
              <ProgressCard key={job.id} job={job} />
            ))}
          </ul>
        </Section>
      ) : null}

      <Section id="add" title="Add a look yourself" note="The same fields as your sheet.">
        <div className={local.formBox}>
          {/* Keyed by the job just queued, so the next look starts with an empty form. */}
          <LookFromLinksForm key={queued ?? "new"} />
        </div>
      </Section>

      {problems.length ? (
        <Section id="problems" title="Didn't work" count={problems.length} note="Try again, or remove it.">
          <ul className={local.list}>
            {problems.map((job) => (
              <ProblemCard key={job.id} job={job} />
            ))}
          </ul>
        </Section>
      ) : null}

      {done ? (
        <p className={local.footnote}>
          {plural(done, "researched look")} {done === 1 ? "is" : "are"} published and no longer listed here.
        </p>
      ) : null}
    </div>
  );
}
