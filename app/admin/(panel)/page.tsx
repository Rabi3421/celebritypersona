import Link from "next/link";
import {
  getCelebrities,
  getOccasions,
  getOutfits,
  getPriceReports,
} from "@/lib/db/content";
import { isFullySwapped } from "@/lib/types";
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

  const averageSaving = Math.round(
    outfits.reduce((sum, o) => sum + (o.worn - o.swap) / o.worn, 0) /
      outfits.length *
      100,
  );
  const buyable = outfits.filter(isFullySwapped);
  const cheapest = buyable.length ? Math.min(...buyable.map((o) => o.swap)) : 0;
  const freshCount = outfits.filter((o) => o.isNew).length;

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
          <b>{outfits.length}</b>
          <small>{freshCount} marked new</small>
        </div>
        <div className={styles.tile}>
          <span>Average saving</span>
          <b className={styles.ok}>{averageSaving}%</b>
          <small>Across every decoded look</small>
        </div>
        <div className={styles.tile}>
          <span>Cheapest look</span>
          <b>{inr.format(cheapest)}</b>
          <small>Complete outfit, swapped</small>
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
          <li>Moving outfits, celebrities and occasions into MongoDB.</li>
          <li>Create, edit and delete screens for each of those.</li>
          <li>Image uploads, replacing the placeholder photo service.</li>
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
