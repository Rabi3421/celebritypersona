import Link from "next/link";
import {
  getCelebrities,
  getOccasions,
  getOutfits,
  getPriceReports,
} from "@/lib/db/content";
import { archiveTotals } from "@/lib/archive";
import { getDb } from "@/lib/mongodb";
import { grievanceOfficer, legalEntity, pending } from "@/lib/site-config";
import styles from "@/app/admin/panel.module.css";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

async function databaseStatus() {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return { label: "Connected", ok: true };
  } catch {
    return { label: "Unreachable", ok: false };
  }
}

export default async function Overview() {
  const [status, outfits, celebrities, occasions, priceReports] = await Promise.all([
    databaseStatus(),
    getOutfits(),
    getCelebrities(),
    getOccasions(),
    getPriceReports(),
  ]);

  // The same figures the public pages compute, so the panel and the site can
  // never disagree about what the archive holds.
  const totals = archiveTotals(outfits);

  const unfilledLegal = [
    legalEntity.name,
    legalEntity.address,
    legalEntity.cin,
    grievanceOfficer.name,
  ].filter(pending).length;

  return (
    <>
      {unfilledLegal > 0 ? (
        <div className={styles.notice}>
          <strong>
            {unfilledLegal} legal detail{unfilledLegal === 1 ? "" : "s"} still
            unfilled
          </strong>
          <p>
            The registered name, address and Grievance Officer are required on
            the public policy pages by the IT Rules, 2021, and currently render
            as amber placeholders. Fill them in{" "}
            <Link href="/admin/settings">Settings</Link>.
          </p>
        </div>
      ) : null}

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <span>Database</span>
          <b className={status.ok ? styles.ok : styles.bad}>{status.label}</b>
          <small>MongoDB Atlas</small>
        </div>
        <div className={styles.tile}>
          <span>Outfits</span>
          <b>{totals.looks}</b>
          <small>{totals.pieces} pieces identified</small>
        </div>
        <div className={styles.tile}>
          <span>Average saving</span>
          <b className={styles.ok}>
            {totals.averageSavingPct === null ? "—" : `${totals.averageSavingPct}%`}
          </b>
          <small>Across looks priced on both sides</small>
        </div>
        <div className={styles.tile}>
          <span>Cheapest look</span>
          <b>{totals.cheapestCompleteLook === null ? "—" : inr.format(totals.cheapestCompleteLook)}</b>
          <small>{totals.buyable} complete, every piece swapped</small>
        </div>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Recently decoded</h2>
          <Link href="/admin/outfits">All outfits →</Link>
        </div>
        <div className={styles.tableWrap}>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Celebrity</th>
                  <th>Event</th>
                  <th>Date</th>
                  <th>As worn</th>
                  <th>Swap</th>
                </tr>
              </thead>
              <tbody>
                {[...outfits]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 6)
                  .map((outfit) => (
                    <tr key={outfit.id}>
                      <td>{outfit.celebrity}</td>
                      <td className={styles.muted}>{outfit.event}</td>
                      <td className={`${styles.num} ${styles.muted}`}>
                        {outfit.date}
                      </td>
                      <td className={`${styles.num} ${styles.strike}`}>
                        {inr.format(outfit.worn)}
                      </td>
                      <td className={`${styles.num} ${styles.save}`}>
                        {inr.format(outfit.swap)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Not built yet</h2>
          <span>
            {celebrities.length} celebrities · {occasions.length} occasions ·{" "}
            {priceReports.length} reports
          </span>
        </div>
        <ul className={styles.todo}>
          <li>The weekly price re-check queue and its results.</li>
          <li>
            Posting the public report form to a collection so reports land in
            the inbox instead of email.
          </li>
        </ul>
      </section>
    </>
  );
}
