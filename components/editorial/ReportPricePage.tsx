import Link from "next/link";
import { ReportPriceForm, type ReportPrefill } from "./ReportPriceForm";
import { grievanceOfficer } from "@/lib/site-config";
import styles from "./editorial.module.css";

export function ReportPricePage({ prefill }: { prefill?: ReportPrefill }) {
  return (
    <main className={styles.page}>
      <header className={styles.band}>
        <div className={styles.shell}>
          <nav className={styles.crumb}>
            <Link href="/">Home</Link>
            <i>›</i>
            <span>Report a price</span>
          </nav>
          <p className={styles.eyebrow}>Help us stay right</p>
          <h1>Found a price that has moved?</h1>
          <p className={styles.lede}>
            Retailers change prices without telling anyone, and things sell out
            in hours. If you have spotted a number that no longer holds, this is
            the fastest way to get it fixed.
          </p>
        </div>
      </header>

      <div className={styles.shell}>
        <section className={styles.section}>
          <div className={styles.narrow}>
            <ReportPriceForm prefill={prefill} />
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.narrow}>
            <div className={styles.heading}>
              <p>Next</p>
              <h2>What happens to your report</h2>
            </div>
            <div className={styles.steps}>
              <div className={styles.step}>
                <b>01</b>
                <div>
                  <h3>We check it against the shop</h3>
                  <p>
                    Usually the same day. A link to the product page makes this
                    take seconds rather than an afternoon.
                  </p>
                </div>
              </div>
              <div className={styles.step}>
                <b>02</b>
                <div>
                  <h3>We update the page</h3>
                  <p>
                    The price changes, or the item gets labelled sold out. We do
                    not delete the row and pretend the piece was never there.
                  </p>
                </div>
              </div>
              <div className={styles.step}>
                <b>03</b>
                <div>
                  <h3>We log it if it was our error</h3>
                  <p>
                    Ordinary price drift is not a correction. Us publishing the
                    wrong figure is, and it goes in the{" "}
                    <Link href="/corrections">corrections log</Link>.
                  </p>
                </div>
              </div>
              <div className={styles.step}>
                <b>04</b>
                <div>
                  <h3>We reply, if you asked us to</h3>
                  <p>
                    Including when we looked and decided the price was right
                    after all. Complaints go to our Grievance Officer, answered
                    within {grievanceOfficer.acknowledgeWithin}.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
