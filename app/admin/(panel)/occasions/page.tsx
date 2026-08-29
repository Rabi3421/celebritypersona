import Link from "next/link";
import { occasionSlug } from "@/lib/slugs";
import styles from "@/app/admin/panel.module.css";
import { getOccasions, getOutfits } from "@/lib/db/content";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export default async function AdminOccasions() {
  const occasions = await getOccasions();
  const outfits = await getOutfits();

  return (
    <>
      <div className={styles.listTop}>
        <p>{`${occasions.length} occasions.`}</p>
        <Link className={styles.newButton} href="/admin/occasions/new">
          New occasion
        </Link>
      </div>

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
                      <span className={styles.rowActions}>
                        <Link href={`/admin/occasions/${occasion.id}`}>Edit</Link>
                        <Link
                          href={`/occasions/${occasionSlug(occasion)}`}
                          target="_blank"
                        >
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
    </>
  );
}
