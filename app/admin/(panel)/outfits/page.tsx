import Link from "next/link";
import { outfitSlug } from "@/lib/slugs";
import styles from "@/app/admin/panel.module.css";
import { getOutfits } from "@/lib/db/content";
import { Pagination } from "@/components/admin/Pagination";
import { paginate, readPerPage } from "@/lib/pagination";
import { pricing } from "@/lib/types";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export default async function AdminOutfits({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; per?: string }>;
}) {
  const [outfits, query] = await Promise.all([getOutfits(), searchParams]);
  const perPage = readPerPage(query.per);

  const sorted = [...outfits].sort((a, b) => b.date.localeCompare(a.date));
  const paged = paginate(sorted, query.page, perPage);
  const rows = paged.rows;

  return (
    <>
      <div className={styles.listTop}>
        <p>{paged.total} decoded looks, newest first.</p>
        <Link className={styles.newButton} href="/admin/outfits/new">
          New outfit
        </Link>
      </div>

      <div className={styles.tableWrap}>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Celebrity</th>
                <th>Event</th>
                <th>Occasion</th>
                <th>Date</th>
                <th>Pieces</th>
                <th>As worn</th>
                <th>Swap</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((outfit) => {
                const money = pricing(outfit);
                const pending = money.pieces - money.swapped;
                return (
                <tr key={outfit.id}>
                  <td>
                    {outfit.celebrity}
                    {outfit.isNew ? (
                      <> <span className={`${styles.chip} ${styles.new}`}>New</span></>
                    ) : null}
                  </td>
                  <td className={styles.muted}>{outfit.event}</td>
                  <td>
                    <span className={styles.chip}>{outfit.occasion}</span>
                  </td>
                  <td className={`${styles.num} ${styles.muted}`}>{outfit.date}</td>
                  <td className={styles.num}>
                    {money.pieces}
                    {pending > 0 ? (
                      <>
                        {" "}
                        <span className={styles.chip}>
                          {pending} pending
                        </span>
                      </>
                    ) : null}
                  </td>
                  {/* Only strike a figure the swap actually replaces. */}
                  <td
                    className={`${styles.num} ${
                      money.allSwapped && money.anyPriced ? styles.strike : styles.muted
                    }`}
                  >
                    {money.anyPriced ? inr.format(money.wornTotal) : "Unconfirmed"}
                    {money.anyPriced && !money.allPriced ? (
                      <>
                        {" "}
                        <span className={styles.chip}>
                          {money.priced} of {money.pieces} priced
                        </span>
                      </>
                    ) : null}
                  </td>
                  <td className={styles.num}>
                    {money.anySwapped ? (
                      <span className={styles.swapCell}>
                        <b className={styles.save}>{inr.format(money.swapTotal)}</b>
                        {money.savingPct === null ? null : (
                          <small>{money.savingPct}% less</small>
                        )}
                      </span>
                    ) : (
                      <span className={`${styles.muted} ${styles.swapCell}`}>None yet</span>
                    )}
                  </td>
                  <td className={styles.num}>
                    <span className={styles.rowActions}>
                      <Link href={`/admin/outfits/${outfit.id}`}>Edit</Link>
                      <Link href={`/outfits/${outfitSlug(outfit)}`} target="_blank">
                        View ↗
                      </Link>
                    </span>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination paged={paged} basePath="/admin/outfits" label="looks" />
    </>
  );
}
