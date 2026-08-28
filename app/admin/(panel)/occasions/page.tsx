import Link from "next/link";
import { occasions, occasionSlug } from "@/lib/occasions-content";
import { outfits } from "@/lib/outfits-content";
import styles from "@/app/admin/panel.module.css";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export default function AdminOccasions() {
  return (
    <>
      <div className={styles.tableWrap}>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Occasion</th>
                <th>Group</th>
                <th>Peak</th>
                <th>Published looks</th>
                <th>Decoded</th>
                <th>Swaps from</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {occasions.map((occasion) => {
                const decoded = outfits.filter(
                  (outfit) =>
                    outfit.occasion.toLowerCase() === occasion.name.toLowerCase(),
                ).length;
                return (
                  <tr key={occasion.id}>
                    <td>{occasion.name}</td>
                    <td>
                      <span className={styles.chip}>{occasion.group}</span>
                    </td>
                    <td className={styles.muted}>{occasion.peak}</td>
                    <td className={styles.num}>{occasion.looks}</td>
                    <td className={styles.num}>
                      {decoded === 0 ? (
                        <span className={styles.chip}>none yet</span>
                      ) : (
                        decoded
                      )}
                    </td>
                    <td className={`${styles.num} ${styles.save}`}>
                      {inr.format(occasion.swapFrom)}
                    </td>
                    <td className={styles.num}>
                      <Link
                        href={`/occasions/${occasionSlug(occasion)}`}
                        target="_blank"
                      >
                        View ↗
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
