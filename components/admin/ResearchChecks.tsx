import { toggleResearchCheck } from "@/app/admin/preview/[id]/actions";
import { openChecks, type LookJob } from "@/lib/look-jobs";
import styles from "./review-checks.module.css";

const when = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * The research and Codex checks for a draft made from links, each confirmed
 * here by the editor. Publish refuses while any is open (see `reviewProblem`).
 */
export function ResearchChecks({ job, outfitId }: { job: LookJob; outfitId: number }) {
  const checks = job.findings?.checks ?? [];
  if (!checks.length) return null;
  const open = openChecks(job).length;
  const cleared = new Map((job.findings?.cleared ?? []).map((item) => [item.check, item]));
  return (
    <section className={styles.box} id="research-checks" aria-label="Research checks">
      <div className={styles.inner}>
        <div className={styles.head}>
          <strong>Before publishing: confirm each research check</strong>
          <span className={open ? styles.todo : styles.ok}>
            {open ? `${open} of ${checks.length} still open — Publish is blocked until they are done` : "All confirmed — ready to publish"}
          </span>
        </div>
        <ul className={styles.list}>
          {checks.map((check) => {
            const done = cleared.get(check);
            return (
              <li key={check} className={`${styles.row} ${done ? styles.done : ""}`}>
                <div>
                  <p>{check}</p>
                  {done ? <small>Confirmed by {done.by} · {when.format(new Date(done.at))}</small> : null}
                </div>
                <form action={toggleResearchCheck}>
                  <input type="hidden" name="jobId" value={job.id} />
                  <input type="hidden" name="outfitId" value={outfitId} />
                  <input type="hidden" name="check" value={check} />
                  <input type="hidden" name="cleared" value={done ? "0" : "1"} />
                  <button type="submit">{done ? "Reopen" : "Checked, done"}</button>
                </form>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
