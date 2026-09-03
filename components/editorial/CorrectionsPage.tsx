import Link from "next/link";
import { contacts, grievanceOfficer } from "@/lib/site-config";
import { DetailRow } from "./Pending";
import styles from "./editorial.module.css";

/** Published corrections, newest first. Add an entry every time a live page
 *  changes in a way that alters what a reader would have believed. */
export const corrections: {
  date: string;
  severity: "Price" | "Attribution" | "Link" | "Credit";
  page: string;
  what: string;
}[] = [];

export function CorrectionsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.band}>
        <div className={styles.shell}>
          <nav className={styles.crumb}>
            <Link href="/">Home</Link>
            <i>›</i>
            <span>Corrections</span>
          </nav>
          <p className={styles.eyebrow}>Accuracy</p>
          <h1>We publish our mistakes</h1>
          <p className={styles.lede}>
            A site about honest pricing does not get to quietly edit a wrong
            number out of existence. Every correction that changes what a reader
            would have believed gets logged here.
          </p>
        </div>
      </header>

      <div className={styles.shell}>
        <section className={styles.section}>
          <div className={styles.heading}>
            <p>Policy</p>
            <h2>What counts as a correction</h2>
            <span>
              Not every edit. Fixing a typo is housekeeping. Changing a fact
              someone might have acted on is a correction, and it gets a note.
            </span>
          </div>
          <div className={styles.never}>
            <div>
              <strong>Price</strong>
              <p>
                We published the wrong figure for an original or a swap, beyond
                the normal drift a retailer causes between weekly checks.
              </p>
            </div>
            <div>
              <strong>Attribution</strong>
              <p>
                We named the wrong brand, the wrong designer, or the wrong piece
                in a look.
              </p>
            </div>
            <div>
              <strong>Link</strong>
              <p>
                A link pointed at the wrong product, or stayed up after the item
                went permanently unavailable.
              </p>
            </div>
            <div>
              <strong>Credit</strong>
              <p>
                A photograph carried the wrong photographer or agency credit, or
                none at all.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.heading}>
            <p>How it works</p>
            <h2>What happens when we get it wrong</h2>
          </div>
          <div className={styles.steps}>
            <div className={styles.step}>
              <b>01</b>
              <div>
                <h3>We fix the page</h3>
                <p>
                  The error is corrected as soon as we have confirmed it, not at
                  the end of a review cycle.
                </p>
              </div>
            </div>
            <div className={styles.step}>
              <b>02</b>
              <div>
                <h3>We mark the page</h3>
                <p>
                  The affected outfit page carries a note saying what changed and
                  when, so a returning reader can see the difference rather than
                  wondering whether they misremembered.
                </p>
              </div>
            </div>
            <div className={styles.step}>
              <b>03</b>
              <div>
                <h3>We log it here</h3>
                <p>
                  With the date, the page and a plain description. The log is
                  never pruned. An old mistake staying visible is the point.
                </p>
              </div>
            </div>
            <div className={styles.step}>
              <b>04</b>
              <div>
                <h3>We answer you</h3>
                <p>
                  If you reported it, you get a reply telling you what we did,
                  including when we decided you were wrong.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.heading}>
            <p>The log</p>
            <h2>Corrections so far</h2>
          </div>
          {corrections.length === 0 ? (
            <div className={styles.empty}>
              <strong>Nothing logged yet</strong>
              <p>
                The site is new and no correction has been needed. That will not
                stay true, and when it changes the entry appears here rather than
                nowhere.
              </p>
            </div>
          ) : (
            <div className={styles.log}>
              {corrections.map((item) => (
                <article className={styles.logItem} key={`${item.date}-${item.page}`}>
                  <span>
                    {item.date} · {item.severity}
                  </span>
                  <h3>{item.page}</h3>
                  <p>{item.what}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.callout}>
            <h2>Tell us we got it wrong</h2>
            <p>
              The fastest route for a wrong price or a dead link is the report
              form. For anything else, email works. Complaints that are not about
              accuracy go to our Grievance Officer, who answers within{" "}
              {grievanceOfficer.acknowledgeWithin} and resolves within{" "}
              {grievanceOfficer.resolveWithin}.
            </p>
            <dl className={styles.calloutRows}>
              <div>
                <dt>Wrong price or link</dt>
                <dd>
                  <Link href="/report-a-price">Report a price →</Link>
                </dd>
              </div>
              <div>
                <dt>Editorial correction</dt>
                <dd>{contacts.corrections}</dd>
              </div>
              <DetailRow label="Grievance Officer" value={grievanceOfficer.name} />
              <div>
                <dt>Grievance email</dt>
                <dd>{grievanceOfficer.email}</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </main>
  );
}
