import Link from "next/link";
import { celebrities, celebritySlug } from "@/lib/celebrities-content";
import { outfits } from "@/lib/outfits-content";
import styles from "@/app/admin/panel.module.css";

export default function AdminCelebrities() {
  return (
    <>
      <div className={styles.tableWrap}>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Published looks</th>
                <th>Decoded</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {celebrities.map((celebrity) => {
                const decoded = outfits.filter(
                  (outfit) => outfit.celebrity === celebrity.name,
                ).length;
                return (
                  <tr key={celebrity.name}>
                    <td>{celebrity.name}</td>
                    <td className={`${styles.num} ${styles.muted}`}>
                      {celebritySlug(celebrity)}
                    </td>
                    <td className={styles.num}>{celebrity.looks}</td>
                    <td className={styles.num}>
                      {decoded === 0 ? (
                        <span className={styles.chip}>none yet</span>
                      ) : (
                        decoded
                      )}
                    </td>
                    <td className={styles.num}>
                      <Link
                        href={`/celebrities/${celebritySlug(celebrity)}`}
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
