import Link from "next/link";
import { ReportRowActions } from "@/components/admin/ReportRowActions";
import { contacts } from "@/lib/site-config";
import styles from "@/app/admin/panel.module.css";
import { getPriceReports } from "@/lib/db/content";

export default async function AdminReports() {
  const priceReports = await getPriceReports();

  return (
    <>
      {priceReports.length === 0 ? (
        <div className={styles.empty}>
          <strong>Nothing here yet</strong>
          <p>
            The public form composes an email to {contacts.corrections} rather
            than posting to the database, so reports are arriving in your inbox
            and not this screen. Point the form at a collection and they will
            land here instead.{" "}
            <Link href="/report-a-price" target="_blank">
              See the public form ↗
            </Link>
          </p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Outfit</th>
                  <th>Issue</th>
                  <th>Detail</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {priceReports.map((report) => (
                  <tr key={report.id}>
                    <td className={`${styles.num} ${styles.muted}`}>
                      {report.receivedAt}
                    </td>
                    <td>{report.outfitSlug}</td>
                    <td>
                      <span className={styles.chip}>{report.issue}</span>
                    </td>
                    <td className={styles.muted}>{report.detail}</td>
                    <td>
                      <ReportRowActions report={report} />
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
