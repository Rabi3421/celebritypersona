import Link from "next/link";
import { contacts } from "@/lib/site-config";
import styles from "./editorial.module.css";

const checks = [
  {
    what: "Swap prices",
    how: "Re-read from the retailer's live listing",
    when: "Weekly",
  },
  {
    what: "Outbound links",
    how: "Requested and checked for a live product page",
    when: "Weekly",
  },
  {
    what: "Stock status",
    how: "Sold out is labelled, not hidden",
    when: "Weekly",
  },
  {
    what: "Original prices",
    how: "Brand listing, or archived listing where discontinued",
    when: "On publish",
  },
  {
    what: "Piece identification",
    how: "Confirmed against the photograph by a person",
    when: "On publish",
  },
  {
    what: "Photo licence and credit",
    how: "Checked against the agency terms",
    when: "On publish",
  },
];

export const howWeWorkFaqs = [
  {
    q: "Do you use AI to identify the clothes?",
    a: "No. A person looks at each photograph and works out what the pieces are. Image recognition is confidently wrong too often for a site whose entire value is being right about the brand.",
  },
  {
    q: "Is a swap a fake or a first copy?",
    a: "Neither, and we will not link to either. A swap is a genuine product from a different brand, sold openly by a real retailer, that happens to be close in cut and fabric. Counterfeits are illegal and we have no interest in them.",
  },
  {
    q: "Why is the original price sometimes missing?",
    a: "Because we could not confirm it. Plenty of couture is never publicly listed. When that happens we say the price is unconfirmed rather than inventing a plausible number.",
  },
  {
    q: "How current are the prices?",
    a: "Every outfit page carries the date its prices were last verified. We re-check weekly, but retailers change prices whenever they like, so always confirm on the retailer's own page before buying.",
  },
];

export function HowWeWorkPage() {
  return (
    <main className={styles.page}>
      <header className={styles.band}>
        <div className={styles.shell}>
          <nav className={styles.crumb}>
            <Link href="/">Home</Link>
            <i>›</i>
            <span>How we work</span>
          </nav>
          <p className={styles.eyebrow}>Method</p>
          <h1>How a look gets decoded</h1>
          <p className={styles.lede}>
            Five steps, done by people, in this order. If any step fails we
            publish the gap rather than filling it with a guess.
          </p>
        </div>
      </header>

      <div className={styles.shell}>
        <section className={styles.section}>
          <div className={styles.steps}>
            <div className={styles.step}>
              <b>01</b>
              <div>
                <h3>Source the photograph</h3>
                <p>
                  We licence event and street photography from the agency that
                  shot it. Nothing is lifted from a search engine and hoped for
                  the best, and every image carries its credit on the picture.
                </p>
              </div>
            </div>
            <div className={styles.step}>
              <b>02</b>
              <div>
                <h3>Identify every piece</h3>
                <p>
                  A person works through the outfit and names each item: the
                  brand, the specific product, the season where it matters. We
                  cross-check against runway galleries, brand listings and the
                  stylist&apos;s own posts.
                </p>
                <ul>
                  <li>Confirmed means we can point at the product.</li>
                  <li>
                    Attributed means the brand is certain but the exact style
                    code is not.
                  </li>
                  <li>
                    Unidentified means we could not confirm it, and it stays
                    unidentified until we can.
                  </li>
                </ul>
              </div>
            </div>
            <div className={styles.step}>
              <b>03</b>
              <div>
                <h3>Price the original</h3>
                <p>
                  Taken from the brand&apos;s own listing wherever one exists, in
                  rupees, including duties where the piece is sold in India. If
                  the item is archive or couture and was never publicly priced,
                  we mark it unconfirmed instead of estimating.
                </p>
              </div>
            </div>
            <div className={styles.step}>
              <b>04</b>
              <div>
                <h3>Find the swap</h3>
                <p>
                  The part that takes the longest. We look for the closest thing
                  you can order, judged in this order:
                </p>
                <ul>
                  <li>Cut and silhouette, because that is what reads first.</li>
                  <li>Fabric and drape, because that is what reads second.</li>
                  <li>Colour and detail.</li>
                  <li>
                    Whether the retailer actually ships across India and takes
                    returns.
                  </li>
                </ul>
              </div>
            </div>
            <div className={styles.step}>
              <b>05</b>
              <div>
                <h3>Check it, then keep checking it</h3>
                <p>
                  Before publishing we open every link ourselves. After
                  publishing we re-check weekly, because a dead link on a
                  shopping site is worse than no link at all.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.heading}>
            <p>Verification</p>
            <h2>What we check, and how often</h2>
          </div>
          <div className={styles.table}>
            <div className={styles.tableRow}>
              <strong>What</strong>
              <span>How</span>
              <b>Frequency</b>
            </div>
            {checks.map((check) => (
              <div className={styles.tableRow} key={check.what}>
                <strong>{check.what}</strong>
                <span>{check.how}</span>
                <b>{check.when}</b>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.heading}>
            <p>Limits</p>
            <h2>What we will not do</h2>
          </div>
          <div className={styles.never}>
            <div>
              <strong>Link to counterfeits</strong>
              <p>
                No first copies, no replicas, no sellers trading on a fake
                label. A swap is a real product from a real brand.
              </p>
            </div>
            <div>
              <strong>Let commission pick the swap</strong>
              <p>
                The match decides, not the rate. We link to retailers we earn
                nothing from whenever they have the better option.
              </p>
            </div>
            <div>
              <strong>Imply an endorsement</strong>
              <p>
                Reporting what someone wore is not the same as saying they back
                our alternative. No celebrity on this site has approved a swap.
              </p>
            </div>
            <div>
              <strong>Guess a price to fill a gap</strong>
              <p>
                An unconfirmed price is published as unconfirmed. A plausible
                invented number is just a lie with a decimal point.
              </p>
            </div>
            <div>
              <strong>Hide a dead link</strong>
              <p>
                Sold out gets labelled sold out. We do not quietly delete the
                row and pretend the piece was never there.
              </p>
            </div>
            <div>
              <strong>Edit a correction away</strong>
              <p>
                Mistakes get fixed in the open, with a note saying what changed.
                Silent edits are how trust dies.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.heading}>
            <p>Questions</p>
            <h2>Things people ask about the method</h2>
          </div>
          <div className={styles.prose}>
            {howWeWorkFaqs.map((faq) => (
              <div key={faq.q}>
                <p>
                  <strong>{faq.q}</strong>
                </p>
                <p>{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.callout}>
            <h2>Spotted something wrong?</h2>
            <p>
              A wrong price or a dead link is a bug, and we would rather hear
              about it from you than leave it up. Reporting one takes about
              thirty seconds.
            </p>
            <dl className={styles.calloutRows}>
              <div>
                <dt>Wrong price or dead link</dt>
                <dd>
                  <Link href="/report-a-price">Report it →</Link>
                </dd>
              </div>
              <div>
                <dt>Anything else</dt>
                <dd>{contacts.corrections}</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </main>
  );
}
