import Link from "next/link";
import { outfitSlug } from "@/lib/slugs";
import styles from "@/app/admin/panel.module.css";
import { getOutfits } from "@/lib/db/content";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export default async function AdminOutfits() {
  const outfits = await getOutfits();

  const rows = [...outfits].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <div className={styles.listTop}>
        <p>{rows.length} decoded looks, newest first.</p>
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
                <th>Saving</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((outfit) => (
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
                  <td className={styles.num}>{outfit.items.length}</td>
                  <td className={`${styles.num} ${styles.strike}`}>
                    {inr.format(outfit.worn)}
                  </td>
                  <td className={`${styles.num} ${styles.save}`}>
                    {inr.format(outfit.swap)}
                  </td>
                  <td className={styles.num}>
                    {Math.floor(((outfit.worn - outfit.swap) / outfit.worn) * 100)}%
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
